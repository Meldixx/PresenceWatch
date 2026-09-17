import { onFluxEventDispatched, Stores } from '@revenge-mod/discord/flux'
import { callNativeMethod } from '@revenge-mod/modules/native'
import { useEffect, useMemo, useState } from 'react'
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native'

type Settings = {
    userIds: string
    notifyOffline: boolean
    notifyStatusChanges: boolean
}

const DEFAULTS: Settings = {
    userIds: '',
    notifyOffline: false,
    notifyStatusChanges: false,
}

let liveSettings: Settings = { ...DEFAULTS }
const previousStatuses = new Map<string, string>()

function parseIds(value: string): Set<string> {
    return new Set(value.match(/\d{15,22}/g) ?? [])
}

function normalizedStatus(value: unknown): string {
    const status = String(value ?? 'offline').toLowerCase()
    if (status === 'invisible' || status === 'unknown' || status === 'null') return 'offline'
    if (status === 'online' || status === 'idle' || status === 'dnd') return status
    return 'offline'
}

function statusLabel(status: string): string {
    switch (status) {
        case 'online':
            return 'в сети'
        case 'idle':
            return 'неактивен'
        case 'dnd':
            return 'не беспокоить'
        default:
            return 'не в сети'
    }
}

function getPayloadUserId(payload: any): string {
    const value =
        payload?.user?.id ??
        payload?.userId ??
        payload?.user_id ??
        payload?.presence?.user?.id ??
        payload?.id
    return value == null ? '' : String(value)
}

function getStoreStatus(userId: string): string {
    try {
        const store: any = (Stores as any).PresenceStore
        const direct = store?.getStatus?.(userId)
        if (direct != null) return normalizedStatus(direct)

        const presence = store?.getPresence?.(userId)
        if (presence?.status != null) return normalizedStatus(presence.status)

        const state = store?.getState?.()
        if (state?.[userId]?.status != null) return normalizedStatus(state[userId].status)
    } catch {}

    return 'offline'
}

function getPayloadStatus(payload: any, userId: string): string {
    const explicit =
        payload?.status ??
        payload?.presence?.status ??
        payload?.user?.status

    if (explicit != null) return normalizedStatus(explicit)

    const clientStatus = payload?.clientStatus ?? payload?.client_status
    if (clientStatus && typeof clientStatus === 'object') {
        const values = Object.values(clientStatus).map(normalizedStatus)
        if (values.includes('online')) return 'online'
        if (values.includes('dnd')) return 'dnd'
        if (values.includes('idle')) return 'idle'
    }

    return getStoreStatus(userId)
}

function displayName(payload: any, userId: string): string {
    return (
        payload?.user?.globalName ??
        payload?.user?.global_name ??
        payload?.user?.username ??
        payload?.presence?.user?.globalName ??
        payload?.presence?.user?.username ??
        userId
    )
}

function notify(title: string, message: string) {
    void callNativeMethod('com.meldix.presencewatch.notify', [title, message])
}

function primeStatuses(ids: Set<string>) {
    for (const id of ids) {
        if (!previousStatuses.has(id)) previousStatuses.set(id, getStoreStatus(id))
    }

    for (const id of [...previousStatuses.keys()]) {
        if (!ids.has(id)) previousStatuses.delete(id)
    }
}

function SettingsComponent({ api }: any) {
    const stored = (api.jsonStorage.use() ?? DEFAULTS) as Settings
    const [userIds, setUserIds] = useState(stored.userIds ?? '')

    useEffect(() => {
        setUserIds(stored.userIds ?? '')
    }, [stored.userIds])

    const count = useMemo(() => parseIds(userIds).size, [userIds])

    const saveIds = () => {
        const clean = [...parseIds(userIds)].join(', ')
        setUserIds(clean)
        void api.jsonStorage.set({ userIds: clean })
    }

    return (
        <ScrollView contentContainerStyle={styles.page}>
            <View style={styles.card}>
                <Text style={styles.title}>PresenceWatch</Text>
                <Text style={styles.subtitle}>
                    Уведомляет, когда выбранный пользователь Discord переходит из offline в online, idle или DND.
                </Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.label}>Discord ID</Text>
                <TextInput
                    value={userIds}
                    onChangeText={setUserIds}
                    onBlur={saveIds}
                    onSubmitEditing={saveIds}
                    placeholder="123456789012345678"
                    placeholderTextColor="#777"
                    keyboardType="numeric"
                    style={styles.input}
                />
                <Text style={styles.hint}>
                    Можно указать несколько ID через запятую или с новой строки. Сейчас: {count}.
                </Text>
                <Pressable style={styles.button} onPress={saveIds}>
                    <Text style={styles.buttonText}>Сохранить ID</Text>
                </Pressable>
            </View>

            <View style={styles.card}>
                <View style={styles.row}>
                    <View style={styles.rowText}>
                        <Text style={styles.label}>Уведомлять о выходе</Text>
                        <Text style={styles.hint}>Показывать уведомление при переходе в offline.</Text>
                    </View>
                    <Switch
                        value={!!stored.notifyOffline}
                        onValueChange={value => void api.jsonStorage.set({ notifyOffline: value })}
                    />
                </View>

                <View style={styles.separator} />

                <View style={styles.row}>
                    <View style={styles.rowText}>
                        <Text style={styles.label}>Смена Online / Idle / DND</Text>
                        <Text style={styles.hint}>Уведомлять и о смене активного статуса.</Text>
                    </View>
                    <Switch
                        value={!!stored.notifyStatusChanges}
                        onValueChange={value =>
                            void api.jsonStorage.set({ notifyStatusChanges: value })
                        }
                    />
                </View>
            </View>

            <Pressable
                style={styles.testButton}
                onPress={() => notify('PresenceWatch', '🟢 Тестовое уведомление работает')}
            >
                <Text style={styles.buttonText}>Проверить уведомление</Text>
            </Pressable>

            <Text style={styles.footer}>
                Invisible определить нельзя: Discord отдаёт такой статус как offline. Плагин видит только те presence-события, которые получает сам клиент Discord.
            </Text>
        </ScrollView>
    )
}

export default plugin({
    jsonStorage: {
        load: true,
        default: DEFAULTS,
    },

    SettingsComponent,

    async start(api: any) {
        liveSettings = {
            ...DEFAULTS,
            ...((await api.jsonStorage.get()) as Settings),
        }

        primeStatuses(parseIds(liveSettings.userIds))

        const unsubscribeStorage = api.jsonStorage.subscribe((update: Partial<Settings>) => {
            liveSettings = { ...liveSettings, ...update }
            primeStatuses(parseIds(liveSettings.userIds))
        })

        const unsubscribePresence = onFluxEventDispatched(
            'PRESENCE_UPDATE' as any,
            (payload: any) => {
                const userId = getPayloadUserId(payload)
                if (!userId) return payload

                const watched = parseIds(liveSettings.userIds)
                if (!watched.has(userId)) return payload

                const next = getPayloadStatus(payload, userId)
                const prev = previousStatuses.get(userId) ?? getStoreStatus(userId)
                previousStatuses.set(userId, next)

                const name = displayName(payload, userId)

                if (prev === 'offline' && next !== 'offline') {
                    notify('PresenceWatch', `🟢 ${name} ${statusLabel(next)}`)
                } else if (prev !== 'offline' && next === 'offline' && liveSettings.notifyOffline) {
                    notify('PresenceWatch', `⚫ ${name} вышел из сети`)
                } else if (
                    prev !== next &&
                    prev !== 'offline' &&
                    next !== 'offline' &&
                    liveSettings.notifyStatusChanges
                ) {
                    notify('PresenceWatch', `🟡 ${name}: ${statusLabel(next)}`)
                }

                return payload
            },
        )

        api.cleanup(unsubscribeStorage, unsubscribePresence)
    },

    stop() {
        previousStatuses.clear()
    },
})

declare module '@revenge-mod/modules/native' {
    export interface NativeMethods {
        'com.meldix.presencewatch.notify': [
            args: [title: string, message: string],
            returnValue: null,
        ]
    }
}

const styles = StyleSheet.create({
    page: {
        padding: 16,
        gap: 12,
    },
    card: {
        borderRadius: 16,
        padding: 16,
        backgroundColor: '#202225',
        gap: 10,
    },
    title: {
        color: '#ffffff',
        fontSize: 22,
        fontWeight: '700',
    },
    subtitle: {
        color: '#b5bac1',
        fontSize: 14,
        lineHeight: 20,
    },
    label: {
        color: '#f2f3f5',
        fontSize: 15,
        fontWeight: '600',
    },
    hint: {
        color: '#949ba4',
        fontSize: 12,
        lineHeight: 17,
    },
    input: {
        borderRadius: 10,
        backgroundColor: '#111214',
        color: '#ffffff',
        paddingHorizontal: 12,
        paddingVertical: 11,
        fontSize: 15,
    },
    button: {
        alignSelf: 'flex-start',
        borderRadius: 10,
        backgroundColor: '#5865f2',
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    testButton: {
        borderRadius: 12,
        backgroundColor: '#5865f2',
        paddingHorizontal: 16,
        paddingVertical: 13,
        alignItems: 'center',
    },
    buttonText: {
        color: '#ffffff',
        fontWeight: '700',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    rowText: {
        flex: 1,
        gap: 4,
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#3f4147',
    },
    footer: {
        color: '#7d828a',
        fontSize: 12,
        lineHeight: 17,
        paddingHorizontal: 4,
        paddingBottom: 16,
    },
})
