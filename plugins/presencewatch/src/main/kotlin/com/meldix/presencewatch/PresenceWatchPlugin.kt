@file:JvmName("PresenceWatchPlugin")

package com.meldix.presencewatch

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.os.Build
import io.github.revenge.bridge.asDelegate
import io.github.revenge.plugins.plugin
import io.github.revenge.xposed.api.registerNativeMethod

private const val CHANNEL_ID = "presencewatch_status"
private const val CHANNEL_NAME = "PresenceWatch"

@Suppress("UNUSED")
val presenceWatchPlugin = plugin {
    start {
        log.i("Loaded ${manifest.name} (${manifest.id}) in ${appInfo.packageName}")

        withAppActivity { activity ->
            val manager = activity.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH,
                ).apply {
                    description = "Discord presence notifications from PresenceWatch"
                    enableVibration(true)
                }
                manager.createNotificationChannel(channel)
            }

            registerNativeMethod("${manifest.id}.notify") { rawArgs ->
                val args = rawArgs.asDelegate()
                val title: String by args.string()
                val message: String by args.string()

                val launchIntent = activity.packageManager.getLaunchIntentForPackage(activity.packageName)
                val pendingIntent = launchIntent?.let {
                    PendingIntent.getActivity(
                        activity,
                        0,
                        it,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                    )
                }

                val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    android.app.Notification.Builder(activity, CHANNEL_ID)
                } else {
                    @Suppress("DEPRECATION")
                    android.app.Notification.Builder(activity)
                }

                builder
                    .setSmallIcon(activity.applicationInfo.icon)
                    .setContentTitle(title)
                    .setContentText(message)
                    .setAutoCancel(true)
                    .setShowWhen(true)
                    .setWhen(System.currentTimeMillis())
                    .apply {
                        if (pendingIntent != null) setContentIntent(pendingIntent)
                        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                            @Suppress("DEPRECATION")
                            setPriority(android.app.Notification.PRIORITY_HIGH)
                        }
                    }

                val id = ((System.currentTimeMillis() xor message.hashCode().toLong()) and 0x7fffffff).toInt()
                manager.notify(id, builder.build())
                Unit
            }
        }
    }

    stop {
        log.i("Unloaded ${manifest.id}")
    }
}
