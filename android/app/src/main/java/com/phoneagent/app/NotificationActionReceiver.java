package com.phoneagent.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.RemoteInput;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.phoneagent.app.data.remote.PhoneAgentApi;

import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.inject.Inject;

import dagger.hilt.android.AndroidEntryPoint;
import okhttp3.MediaType;
import okhttp3.RequestBody;
import okhttp3.ResponseBody;
import retrofit2.Response;

@AndroidEntryPoint
public class NotificationActionReceiver extends BroadcastReceiver {
    public static final String ACTION_APPROVE_TRANSFER = "com.phoneagent.app.APPROVE_TRANSFER";
    public static final String ACTION_DECLINE_TRANSFER = "com.phoneagent.app.DECLINE_TRANSFER";
    public static final String ACTION_REPLY_ANSWER = "com.phoneagent.app.REPLY_ANSWER";
    public static final String ACTION_OPEN_NOTIFICATION = "com.phoneagent.app.OPEN_NOTIFICATION";
    public static final String EXTRA_APPROVAL_ID = "approval_id";
    public static final String EXTRA_ANSWER_ID = "answer_id";
    public static final String EXTRA_NOTIFICATION_TARGET = "notification_target";
    public static final String EXTRA_NOTIFICATION_ID = "notification_id";
    public static final String EXTRA_INLINE_REPLY = "inline_reply";

    private static final String NOTIFICATION_CHANNEL_ID = "transfer_approvals";
    private static final ExecutorService EXECUTOR = Executors.newCachedThreadPool();
    private static final Set<String> IN_FLIGHT_ACTIONS = new HashSet<>();
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    @Inject FirebaseAuth firebaseAuth;
    @Inject PhoneAgentApi api;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) {
            return;
        }
        String action = intent.getAction();
        String approvalId = value(intent.getStringExtra(EXTRA_APPROVAL_ID));
        String answerId = value(intent.getStringExtra(EXTRA_ANSWER_ID));
        String requestId = approvalId.length() > 0 ? approvalId : answerId;
        int notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, requestId.hashCode());
        String target = value(intent.getStringExtra(EXTRA_NOTIFICATION_TARGET));

        if (requestId.length() == 0) {
            showResult(context, notificationId, target, "Open Call Held", "Open the app to finish this action.", false);
            return;
        }

        String actionKey = action + ":" + requestId;
        synchronized (IN_FLIGHT_ACTIONS) {
            if (IN_FLIGHT_ACTIONS.contains(actionKey)) {
                return;
            }
            IN_FLIGHT_ACTIONS.add(actionKey);
        }

        PendingResult pending = goAsync();
        FirebaseUser user = currentUser(context);
        if (user == null) {
            finishAction(context, pending, actionKey, notificationId, target, "Open Call Held", "Open the app to finish this action.", false);
            return;
        }

        user.getIdToken(false).addOnCompleteListener(task -> {
            if (!task.isSuccessful() || task.getResult() == null || task.getResult().getToken() == null) {
                finishAction(context, pending, actionKey, notificationId, target, "Open Call Held", "Open the app to finish this action.", false);
                return;
            }
            String token = task.getResult().getToken();
            EXECUTOR.execute(() -> {
                try {
                    ActionResult result = submitAction(intent, action, approvalId, answerId, token);
                    NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                    if (manager != null) {
                        manager.cancel(notificationId);
                    }
                    showResult(context, notificationId, target, result.title, result.body, result.success);
                    sendPushRefresh(context, target);
                } catch (Exception error) {
                    NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                    if (manager != null) {
                        manager.cancel(notificationId);
                    }
                    showResult(context, notificationId, target, "Could not complete action", readableFailure(error), false);
                    sendPushRefresh(context, target);
                } finally {
                    synchronized (IN_FLIGHT_ACTIONS) {
                        IN_FLIGHT_ACTIONS.remove(actionKey);
                    }
                    pending.finish();
                }
            });
        });
    }

    private FirebaseUser currentUser(Context context) {
        if (FirebaseApp.getApps(context).isEmpty()) {
            return null;
        }
        return firebaseAuth.getCurrentUser();
    }

    private void finishAction(
            Context context,
            PendingResult pending,
            String actionKey,
            int notificationId,
            String target,
            String title,
            String body,
            boolean success
    ) {
        synchronized (IN_FLIGHT_ACTIONS) {
            IN_FLIGHT_ACTIONS.remove(actionKey);
        }
        showResult(context, notificationId, target, title, body, success);
        sendPushRefresh(context, target);
        pending.finish();
    }

    private ActionResult submitAction(Intent intent, String action, String approvalId, String answerId, String token) throws Exception {
        if (ACTION_APPROVE_TRANSFER.equals(action)) {
            post("/v1/approval-requests/" + approvalId + "/accept", null, token);
            return new ActionResult("Transfer accepted", "The assistant is connecting the call.", true);
        }
        if (ACTION_DECLINE_TRANSFER.equals(action)) {
            post("/v1/approval-requests/" + approvalId + "/decline", null, token);
            return new ActionResult("Transfer declined", "The assistant will continue with the caller.", true);
        }
        if (ACTION_REPLY_ANSWER.equals(action)) {
            String reply = inlineReply(intent);
            if (reply.length() == 0) {
                throw new IllegalStateException("Type an answer before sending.");
            }
            JSONObject payload = new JSONObject();
            payload.put("answer", reply);
            post("/v1/answer-requests/" + answerId + "/reply", payload, token);
            return new ActionResult("Answer sent", "The assistant will relay your answer.", true);
        }
        throw new IllegalStateException("Open Call Held to continue.");
    }

    private void post(String path, JSONObject payload, String token) throws Exception {
        RequestBody body = payload == null ? null : RequestBody.create(payload.toString(), JSON);
        Response<ResponseBody> response = api.postJsonCall(relativePath(path), "Bearer " + token, body, "notification_action").execute();
        if (!response.isSuccessful()) {
            throw new ActionHttpException(response.code(), readError(response));
        }
    }

    private String inlineReply(Intent intent) {
        android.os.Bundle results = RemoteInput.getResultsFromIntent(intent);
        if (results == null) {
            return "";
        }
        CharSequence value = results.getCharSequence(EXTRA_INLINE_REPLY);
        return value == null ? "" : value.toString().trim();
    }

    private String readError(Response<ResponseBody> response) {
        try {
            ResponseBody errorBody = response.errorBody();
            if (errorBody != null) {
                String body = errorBody.string();
                if (body.length() > 0) {
                    return body;
                }
            }
        } catch (Exception ignored) {
        }
        return "HTTP " + response.code();
    }

    private String relativePath(String path) {
        if (path == null) {
            return "";
        }
        return path.startsWith("/") ? path.substring(1) : path;
    }

    private String readableFailure(Exception error) {
        if (error instanceof ActionHttpException) {
            ActionHttpException http = (ActionHttpException) error;
            if (http.status == 409) {
                return "The assistant no longer needs this action.";
            }
            return "Open the app to try again.";
        }
        String message = error.getMessage();
        return message == null || message.length() == 0 ? "Open the app to try again." : message;
    }

    private void showResult(Context context, int notificationId, String target, String title, String body, boolean success) {
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        createNotificationChannel(context);
        if (body.contains("no longer needs")) {
            title = "Request expired";
            body = "The assistant no longer needs this action.";
        }

        Intent openIntent = new Intent(context, ComposeActivity.class);
        openIntent.setAction(ACTION_OPEN_NOTIFICATION);
        openIntent.putExtra(EXTRA_NOTIFICATION_TARGET, target);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(context, NOTIFICATION_CHANNEL_ID)
                : new Notification.Builder(context);
        builder.setSmallIcon(success ? android.R.drawable.checkbox_on_background : R.drawable.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setContentIntent(PendingIntent.getActivity(context, notificationId + 50, openIntent, flags))
                .setAutoCancel(true)
                .setPriority(Notification.PRIORITY_HIGH);

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(notificationId + 50, builder.build());
        }
    }

    private void sendPushRefresh(Context context, String target) {
        Intent refreshIntent = new Intent(ComposeActivity.ACTION_PUSH_REFRESH);
        refreshIntent.setPackage(context.getPackageName());
        refreshIntent.putExtra(EXTRA_NOTIFICATION_TARGET, target);
        context.sendBroadcast(refreshIntent);
    }

    private void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT < 26) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Assistant alerts",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Privacy-safe alerts when Call Held needs attention.");
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    private String value(String input) {
        return input == null ? "" : input;
    }

    private static final class ActionResult {
        final String title;
        final String body;
        final boolean success;

        ActionResult(String title, String body, boolean success) {
            this.title = title;
            this.body = body;
            this.success = success;
        }
    }

    private static final class ActionHttpException extends Exception {
        final int status;

        ActionHttpException(int status, String message) {
            super(message);
            this.status = status;
        }
    }
}
