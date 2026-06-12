package com.phoneagent.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.RemoteInput;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.util.Log;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class PhoneAgentMessagingService extends FirebaseMessagingService {
    private static final String LOG_TAG = "PhoneAgentPush";
    private static final String NOTIFICATION_CHANNEL_ID = "transfer_approvals";

    @Override
    public void onMessageReceived(RemoteMessage message) {
        Map<String, String> data = message.getData();
        if (data == null || data.isEmpty()) {
            return;
        }
        sendPushRefresh(data);
        showNotification(data);
    }

    @Override
    public void onNewToken(String token) {
        Log.i(LOG_TAG, "FCM token rotated");
    }

    private void showNotification(Map<String, String> data) {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        createNotificationChannel();
        String title = valueOrDefault(data.get("title"), "Call Held");
        String body = valueOrDefault(data.get("body"), "You have a new assistant update.");
        String target = valueOrDefault(data.get("target"), "assistant");
        String priority = valueOrDefault(data.get("priority"), "normal");
        String notificationId = valueOrDefault(data.get("notification_id"), target + body);

        Intent openIntent = new Intent(this, ComposeActivity.class);
        openIntent.setAction(NotificationActionReceiver.ACTION_OPEN_NOTIFICATION);
        openIntent.putExtra(NotificationActionReceiver.EXTRA_NOTIFICATION_TARGET, target);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
                : new Notification.Builder(this);
        builder.setSmallIcon(R.drawable.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setContentIntent(PendingIntent.getActivity(this, notificationId.hashCode(), openIntent, immutableFlags()))
                .setAutoCancel(true)
                .setPriority(androidPriority(priority));
        addNotificationActions(builder, data, notificationId.hashCode());

        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(notificationId.hashCode(), builder.build());
        }
    }

    private void sendPushRefresh(Map<String, String> data) {
        Intent refreshIntent = new Intent(ComposeActivity.ACTION_PUSH_REFRESH);
        refreshIntent.setPackage(getPackageName());
        refreshIntent.putExtra(NotificationActionReceiver.EXTRA_NOTIFICATION_TARGET, valueOrDefault(data.get("target"), ""));
        refreshIntent.putExtra("type", valueOrDefault(data.get("type"), ""));
        refreshIntent.putExtra(NotificationActionReceiver.EXTRA_NOTIFICATION_ID, valueOrDefault(data.get("notification_id"), ""));
        sendBroadcast(refreshIntent);
    }

    private void addNotificationActions(Notification.Builder builder, Map<String, String> data, int notificationId) {
        String type = valueOrDefault(data.get("type"), "");
        String target = valueOrDefault(data.get("target"), "");
        if ("live_transfer_request".equals(type)) {
            String approvalId = lastPathSegment(target);
            if (approvalId.length() == 0) {
                return;
            }
            Intent accept = actionIntent(NotificationActionReceiver.ACTION_APPROVE_TRANSFER, target, notificationId);
            accept.putExtra(NotificationActionReceiver.EXTRA_APPROVAL_ID, approvalId);
            builder.addAction(android.R.drawable.checkbox_on_background, "Accept", PendingIntent.getBroadcast(this, notificationId + 1, accept, actionFlags(false)));

            Intent decline = actionIntent(NotificationActionReceiver.ACTION_DECLINE_TRANSFER, target, notificationId);
            decline.putExtra(NotificationActionReceiver.EXTRA_APPROVAL_ID, approvalId);
            builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", PendingIntent.getBroadcast(this, notificationId + 2, decline, actionFlags(false)));
        } else if ("live_answer_request".equals(type)) {
            String answerId = lastPathSegment(target);
            Intent reply = actionIntent(NotificationActionReceiver.ACTION_REPLY_ANSWER, target, notificationId);
            reply.putExtra(NotificationActionReceiver.EXTRA_ANSWER_ID, answerId);
            PendingIntent replyIntent = PendingIntent.getBroadcast(this, notificationId + 3, reply, actionFlags(true));
            RemoteInput remoteInput = new RemoteInput.Builder(NotificationActionReceiver.EXTRA_INLINE_REPLY)
                    .setLabel("Answer")
                    .build();
            Notification.Action action = new Notification.Action.Builder(
                    Icon.createWithResource(this, android.R.drawable.ic_menu_send),
                    "Reply",
                    replyIntent
            ).addRemoteInput(remoteInput).build();
            builder.addAction(action);
        }
    }

    private Intent actionIntent(String action, String target, int notificationId) {
        Intent intent = new Intent(this, NotificationActionReceiver.class);
        intent.setAction(action);
        intent.putExtra(NotificationActionReceiver.EXTRA_NOTIFICATION_TARGET, target);
        intent.putExtra(NotificationActionReceiver.EXTRA_NOTIFICATION_ID, notificationId);
        return intent;
    }

    private int immutableFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return flags;
    }

    private int actionFlags(boolean mutable) {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 31) {
            flags |= mutable ? PendingIntent.FLAG_MUTABLE : PendingIntent.FLAG_IMMUTABLE;
        } else if (Build.VERSION.SDK_INT >= 23) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return flags;
    }

    private String lastPathSegment(String target) {
        if (target == null || target.length() == 0) {
            return "";
        }
        int index = target.lastIndexOf('/');
        return index >= 0 && index < target.length() - 1 ? target.substring(index + 1) : target;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < 26) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Assistant alerts",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Privacy-safe alerts when Call Held needs attention.");
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    private int androidPriority(String priority) {
        if ("urgent".equals(priority) || "high".equals(priority)) {
            return Notification.PRIORITY_HIGH;
        }
        if ("low".equals(priority)) {
            return Notification.PRIORITY_LOW;
        }
        return Notification.PRIORITY_DEFAULT;
    }

    private String valueOrDefault(String value, String defaultValue) {
        return value == null || value.length() == 0 ? defaultValue : value;
    }
}
