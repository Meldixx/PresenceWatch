var plugin = definePlugin((() => {
    const DEFAULTS = {
        userIds: "",
        notifyOffline: false,
        notifyStatusChanges: false
    };

    let liveSettings = { ...DEFAULTS };
    let storage = null;
    let removeFlux = null;
    const previousStatuses = new Map();

    const React = bunny.metro.common.React;
    const RN = bunny.metro.common.ReactNative;

    function parseIds(value) {
        return new Set(String(value || "").match(/\d{15,22}/g) || []);
    }

    function normalizeStatus(value) {
        const status = String(value == null ? "offline" : value).toLowerCase();
        if (status === "online" || status === "idle" || status === "dnd") return status;
        return "offline";
    }

    function statusLabel(status) {
        if (status === "online") return "в сети";
        if (status === "idle") return "неактивен";
        if (status === "dnd") return "не беспокоить";
        return "не в сети";
    }

    function getPresenceStore() {
        try {
            return bunny.metro.findExports(bunny.metro.filters.byStoreName("PresenceStore"));
        } catch (_) {
            return null;
        }
    }

    function getUserStore() {
        try {
            return bunny.metro.findExports(bunny.metro.filters.byStoreName("UserStore"));
        } catch (_) {
            return null;
        }
    }

    function getStoreStatus(userId) {
        try {
            const store = getPresenceStore();
            const direct = store && store.getStatus && store.getStatus(userId);
            if (direct != null) return normalizeStatus(direct);
            const presence = store && store.getPresence && store.getPresence(userId);
            if (presence && presence.status != null) return normalizeStatus(presence.status);
        } catch (_) {}
        return "offline";
    }

    function getPayloadUserId(payload) {
        const value = payload && (
            (payload.user && payload.user.id) ||
            payload.userId ||
            payload.user_id ||
            (payload.presence && payload.presence.user && payload.presence.user.id) ||
            payload.id
        );
        return value == null ? "" : String(value);
    }

    function getPayloadStatus(payload, userId) {
        const explicit = payload && (
            payload.status ||
            (payload.presence && payload.presence.status) ||
            (payload.user && payload.user.status)
        );
        if (explicit != null) return normalizeStatus(explicit);

        const clientStatus = payload && (payload.clientStatus || payload.client_status);
        if (clientStatus && typeof clientStatus === "object") {
            const values = Object.values(clientStatus).map(normalizeStatus);
            if (values.includes("online")) return "online";
            if (values.includes("dnd")) return "dnd";
            if (values.includes("idle")) return "idle";
        }

        return getStoreStatus(userId);
    }

    function getDisplayName(payload, userId) {
        const fromPayload = payload && payload.user && (
            payload.user.globalName || payload.user.global_name || payload.user.username
        );
        if (fromPayload) return fromPayload;

        try {
            const store = getUserStore();
            const user = store && store.getUser && store.getUser(userId);
            return (user && (user.globalName || user.username)) || userId;
        } catch (_) {
            return userId;
        }
    }

    function systemNotify(title, message) {
        try {
            const nativeModules = RN && RN.NativeModules;
            const push = nativeModules && nativeModules.PushNotificationAndroid;
            if (push && typeof push.presentLocalNotification === "function") {
                push.presentLocalNotification({
                    alertTitle: title,
                    alertBody: message,
                    message: message
                });
                return;
            }
        } catch (_) {}

        try {
            bunny.metro.common.toasts.open({
                key: "PRESENCEWATCH_" + Date.now(),
                content: title + ": " + message
            });
        } catch (_) {}
    }

    function primeStatuses() {
        const ids = parseIds(liveSettings.userIds);
        for (const id of ids) {
            if (!previousStatuses.has(id)) previousStatuses.set(id, getStoreStatus(id));
        }
        for (const id of Array.from(previousStatuses.keys())) {
            if (!ids.has(id)) previousStatuses.delete(id);
        }
    }

    function ensureStorage() {
        if (!storage) storage = bunny.plugin.createStorage();
        let attempts = 0;
        const read = () => {
            try {
                liveSettings = {
                    ...DEFAULTS,
                    userIds: storage.userIds || "",
                    notifyOffline: !!storage.notifyOffline,
                    notifyStatusChanges: !!storage.notifyStatusChanges
                };
                primeStatuses();
            } catch (_) {
                if (++attempts < 40) setTimeout(read, 100);
            }
        };
        read();
    }

    function saveSetting(key, value) {
        liveSettings[key] = value;
        try {
            if (!storage) storage = bunny.plugin.createStorage();
            storage[key] = value;
        } catch (_) {}
        primeStatuses();
    }

    function SettingsComponent() {
        const [userIds, setUserIds] = React.useState(liveSettings.userIds || "");
        const [notifyOffline, setNotifyOffline] = React.useState(!!liveSettings.notifyOffline);
        const [notifyStatusChanges, setNotifyStatusChanges] = React.useState(!!liveSettings.notifyStatusChanges);

        React.useEffect(() => {
            const timer = setInterval(() => {
                if (userIds === "" && liveSettings.userIds) setUserIds(liveSettings.userIds);
            }, 500);
            return () => clearInterval(timer);
        }, []);

        const cleanAndSave = () => {
            const clean = Array.from(parseIds(userIds)).join(", ");
            setUserIds(clean);
            saveSetting("userIds", clean);
        };

        const h = React.createElement;
        const styles = {
            page: { padding: 16, gap: 14 },
            card: { padding: 16, borderRadius: 14, backgroundColor: "#202225", gap: 10 },
            title: { color: "#ffffff", fontSize: 22, fontWeight: "700" },
            text: { color: "#dbdee1", fontSize: 14 },
            hint: { color: "#949ba4", fontSize: 12, lineHeight: 17 },
            input: { backgroundColor: "#111214", color: "#ffffff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
            row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
            rowText: { flex: 1, gap: 4 },
            button: { backgroundColor: "#5865F2", borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: "center" },
            buttonText: { color: "#ffffff", fontWeight: "700" }
        };

        return h(RN.ScrollView, { contentContainerStyle: styles.page },
            h(RN.View, { style: styles.card },
                h(RN.Text, { style: styles.title }, "PresenceWatch"),
                h(RN.Text, { style: styles.hint }, "Уведомляет, когда выбранный пользователь Discord появляется в сети.")
            ),
            h(RN.View, { style: styles.card },
                h(RN.Text, { style: styles.text }, "Discord ID"),
                h(RN.TextInput, {
                    style: styles.input,
                    value: userIds,
                    onChangeText: setUserIds,
                    onBlur: cleanAndSave,
                    onSubmitEditing: cleanAndSave,
                    placeholder: "123456789012345678",
                    placeholderTextColor: "#777"
                }),
                h(RN.Text, { style: styles.hint }, "Можно несколько ID через запятую или с новой строки."),
                h(RN.Pressable, { style: styles.button, onPress: cleanAndSave },
                    h(RN.Text, { style: styles.buttonText }, "Сохранить ID")
                )
            ),
            h(RN.View, { style: styles.card },
                h(RN.View, { style: styles.row },
                    h(RN.View, { style: styles.rowText },
                        h(RN.Text, { style: styles.text }, "Уведомлять о выходе"),
                        h(RN.Text, { style: styles.hint }, "Показывать уведомление при переходе в offline.")
                    ),
                    h(RN.Switch, {
                        value: notifyOffline,
                        onValueChange: value => {
                            setNotifyOffline(value);
                            saveSetting("notifyOffline", value);
                        }
                    })
                ),
                h(RN.View, { style: styles.row },
                    h(RN.View, { style: styles.rowText },
                        h(RN.Text, { style: styles.text }, "Online / Idle / DND"),
                        h(RN.Text, { style: styles.hint }, "Уведомлять и о смене активного статуса.")
                    ),
                    h(RN.Switch, {
                        value: notifyStatusChanges,
                        onValueChange: value => {
                            setNotifyStatusChanges(value);
                            saveSetting("notifyStatusChanges", value);
                        }
                    })
                )
            ),
            h(RN.Pressable, {
                style: styles.button,
                onPress: () => systemNotify("PresenceWatch", "🟢 Тестовое уведомление работает")
            }, h(RN.Text, { style: styles.buttonText }, "Проверить уведомление")),
            h(RN.Text, { style: styles.hint }, "Invisible определить нельзя: Discord показывает его как offline. Плагин видит только presence-события, которые получает твой Discord-клиент.")
        );
    }

    return {
        start() {
            ensureStorage();
            removeFlux = bunny.api.flux.intercept(payload => {
                if (!payload || payload.type !== "PRESENCE_UPDATE") return;

                const userId = getPayloadUserId(payload);
                if (!userId || !parseIds(liveSettings.userIds).has(userId)) return;

                const next = getPayloadStatus(payload, userId);
                const prev = previousStatuses.has(userId) ? previousStatuses.get(userId) : getStoreStatus(userId);
                previousStatuses.set(userId, next);

                const name = getDisplayName(payload, userId);
                if (prev === "offline" && next !== "offline") {
                    systemNotify("PresenceWatch", "🟢 " + name + " " + statusLabel(next));
                } else if (prev !== "offline" && next === "offline" && liveSettings.notifyOffline) {
                    systemNotify("PresenceWatch", "⚫ " + name + " вышел из сети");
                } else if (prev !== next && prev !== "offline" && next !== "offline" && liveSettings.notifyStatusChanges) {
                    systemNotify("PresenceWatch", "🟡 " + name + ": " + statusLabel(next));
                }
            });
        },
        stop() {
            try { removeFlux && removeFlux(); } catch (_) {}
            removeFlux = null;
            previousStatuses.clear();
        },
        SettingsComponent
    };
})());
