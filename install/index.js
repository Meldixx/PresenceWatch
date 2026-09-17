(() => {
    const storage = vendetta.plugin.storage;
    const React = vendetta.metro.common.React;
    const RN = vendetta.metro.common.ReactNative;
    const FluxDispatcher = vendetta.metro.common.FluxDispatcher;
    const previousStatuses = new Map();

    storage.userIds ??= "";
    storage.notifyOffline ??= false;
    storage.notifyStatusChanges ??= false;

    function parseIds(value) {
        return new Set(String(value || "").match(/\d{15,22}/g) || []);
    }

    function normalizeStatus(value) {
        const status = String(value == null ? "offline" : value).toLowerCase();
        return status === "online" || status === "idle" || status === "dnd" ? status : "offline";
    }

    function statusLabel(status) {
        if (status === "online") return "в сети";
        if (status === "idle") return "неактивен";
        if (status === "dnd") return "не беспокоить";
        return "не в сети";
    }

    function getPresenceStore() {
        try { return vendetta.metro.findByStoreName("PresenceStore"); }
        catch (_) { return null; }
    }

    function getUserStore() {
        try { return vendetta.metro.findByStoreName("UserStore"); }
        catch (_) { return null; }
    }

    function getStoreStatus(userId) {
        try {
            const store = getPresenceStore();
            const direct = store?.getStatus?.(userId);
            if (direct != null) return normalizeStatus(direct);
            const presence = store?.getPresence?.(userId);
            if (presence?.status != null) return normalizeStatus(presence.status);
        } catch (_) {}
        return "offline";
    }

    function payloadUserId(payload) {
        const value = payload?.user?.id ?? payload?.userId ?? payload?.user_id ?? payload?.presence?.user?.id ?? payload?.id;
        return value == null ? "" : String(value);
    }

    function payloadStatus(payload, userId) {
        const explicit = payload?.status ?? payload?.presence?.status ?? payload?.user?.status;
        if (explicit != null) return normalizeStatus(explicit);

        const clients = payload?.clientStatus ?? payload?.client_status;
        if (clients && typeof clients === "object") {
            const values = Object.values(clients).map(normalizeStatus);
            if (values.includes("online")) return "online";
            if (values.includes("dnd")) return "dnd";
            if (values.includes("idle")) return "idle";
        }
        return getStoreStatus(userId);
    }

    function displayName(payload, userId) {
        const direct = payload?.user?.globalName ?? payload?.user?.global_name ?? payload?.user?.username;
        if (direct) return direct;
        try {
            const user = getUserStore()?.getUser?.(userId);
            return user?.globalName ?? user?.username ?? userId;
        } catch (_) {
            return userId;
        }
    }

    function notify(message) {
        try {
            const push = RN?.NativeModules?.PushNotificationAndroid;
            if (push?.presentLocalNotification) {
                push.presentLocalNotification({
                    alertTitle: "PresenceWatch",
                    alertBody: message,
                    message
                });
                return;
            }
        } catch (_) {}

        try { vendetta.ui.toasts.showToast("PresenceWatch: " + message); }
        catch (_) {}
    }

    function primeStatuses() {
        const ids = parseIds(storage.userIds);
        for (const id of ids) {
            if (!previousStatuses.has(id)) previousStatuses.set(id, getStoreStatus(id));
        }
        for (const id of Array.from(previousStatuses.keys())) {
            if (!ids.has(id)) previousStatuses.delete(id);
        }
    }

    function onPresence(payload) {
        const userId = payloadUserId(payload);
        if (!userId || !parseIds(storage.userIds).has(userId)) return;

        const next = payloadStatus(payload, userId);
        const prev = previousStatuses.has(userId) ? previousStatuses.get(userId) : getStoreStatus(userId);
        previousStatuses.set(userId, next);
        if (prev === next) return;

        const name = displayName(payload, userId);
        if (prev === "offline" && next !== "offline") {
            notify("🟢 " + name + " " + statusLabel(next));
        } else if (prev !== "offline" && next === "offline" && storage.notifyOffline) {
            notify("⚫ " + name + " вышел из сети");
        } else if (prev !== "offline" && next !== "offline" && storage.notifyStatusChanges) {
            notify("🟡 " + name + ": " + statusLabel(next));
        }
    }

    function Settings() {
        vendetta.storage.useProxy(storage);
        const [idsText, setIdsText] = React.useState(storage.userIds || "");

        const saveIds = () => {
            const cleaned = Array.from(parseIds(idsText)).join(", ");
            storage.userIds = cleaned;
            setIdsText(cleaned);
            primeStatuses();
        };

        const h = React.createElement;
        const s = {
            page: { padding: 16, gap: 12 },
            card: { backgroundColor: "#202225", borderRadius: 14, padding: 16, gap: 10 },
            title: { color: "#fff", fontSize: 22, fontWeight: "700" },
            label: { color: "#f2f3f5", fontSize: 15, fontWeight: "600" },
            hint: { color: "#949ba4", fontSize: 12, lineHeight: 17 },
            input: { backgroundColor: "#111214", color: "#fff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
            row: { flexDirection: "row", alignItems: "center", gap: 12 },
            rowText: { flex: 1, gap: 4 },
            button: { backgroundColor: "#5865F2", borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: "center" },
            buttonText: { color: "#fff", fontWeight: "700" }
        };

        return h(RN.ScrollView, { contentContainerStyle: s.page },
            h(RN.View, { style: s.card },
                h(RN.Text, { style: s.title }, "PresenceWatch"),
                h(RN.Text, { style: s.hint }, "Отслеживает presence-события, которые получает твой Discord-клиент.")
            ),
            h(RN.View, { style: s.card },
                h(RN.Text, { style: s.label }, "Discord ID"),
                h(RN.TextInput, {
                    style: s.input,
                    value: idsText,
                    onChangeText: setIdsText,
                    onBlur: saveIds,
                    onSubmitEditing: saveIds,
                    placeholder: "123456789012345678",
                    placeholderTextColor: "#777"
                }),
                h(RN.Text, { style: s.hint }, "Можно указать несколько ID через запятую или с новой строки."),
                h(RN.Pressable, { style: s.button, onPress: saveIds },
                    h(RN.Text, { style: s.buttonText }, "Сохранить ID")
                )
            ),
            h(RN.View, { style: s.card },
                h(RN.View, { style: s.row },
                    h(RN.View, { style: s.rowText },
                        h(RN.Text, { style: s.label }, "Уведомлять о выходе"),
                        h(RN.Text, { style: s.hint }, "Уведомление при переходе в offline.")
                    ),
                    h(RN.Switch, {
                        value: !!storage.notifyOffline,
                        onValueChange: v => storage.notifyOffline = v
                    })
                ),
                h(RN.View, { style: s.row },
                    h(RN.View, { style: s.rowText },
                        h(RN.Text, { style: s.label }, "Online / Idle / DND"),
                        h(RN.Text, { style: s.hint }, "Уведомлять при смене активного статуса.")
                    ),
                    h(RN.Switch, {
                        value: !!storage.notifyStatusChanges,
                        onValueChange: v => storage.notifyStatusChanges = v
                    })
                )
            ),
            h(RN.Pressable, { style: s.button, onPress: () => notify("🟢 Тестовое уведомление работает") },
                h(RN.Text, { style: s.buttonText }, "Проверить уведомление")
            ),
            h(RN.Text, { style: s.hint }, "Invisible определить нельзя: Discord показывает его как offline.")
        );
    }

    return {
        onLoad() {
            primeStatuses();
            FluxDispatcher.subscribe("PRESENCE_UPDATE", onPresence);
        },
        onUnload() {
            try { FluxDispatcher.unsubscribe("PRESENCE_UPDATE", onPresence); } catch (_) {}
            previousStatuses.clear();
        },
        settings: Settings
    };
})()
