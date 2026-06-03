package com.phoneagent.app;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.RemoteInput;
import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.Icon;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.ContactsContract;
import android.provider.Settings;
import android.text.Editable;
import android.text.InputType;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.CompoundButton;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import com.google.android.gms.tasks.Task;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseException;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.PhoneAuthCredential;
import com.google.firebase.auth.PhoneAuthOptions;
import com.google.firebase.auth.PhoneAuthProvider;
import com.google.firebase.crashlytics.FirebaseCrashlytics;
import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class MainActivity extends Activity {
    private static final String APP_PREFS = "phone_agent_prefs";
    private static final String PREF_LAST_CRASH = "last_crash";
    private static final String PREF_LAST_SIGNUP_ERROR = "last_signup_error";
    private static final String PREF_FIRST_RUN_ONBOARDING_COMPLETE = "first_run_onboarding_complete";
    private static final String LOG_TAG = "PhoneAgentAuth";
    private static final long PHONE_AUTH_SEND_TIMEOUT_MS = 30000L;
    private static final String ACTION_APPROVE_TRANSFER = "com.phoneagent.app.APPROVE_TRANSFER";
    private static final String ACTION_DECLINE_TRANSFER = "com.phoneagent.app.DECLINE_TRANSFER";
    private static final String ACTION_OPEN_NOTIFICATION = "com.phoneagent.app.OPEN_NOTIFICATION";
    static final String ACTION_PUSH_REFRESH = "com.phoneagent.app.PUSH_REFRESH";
    private static final String ACTION_REPLY_ANSWER = "com.phoneagent.app.REPLY_ANSWER";
    private static final String EXTRA_APPROVAL_ID = "approval_id";
    private static final String EXTRA_ANSWER_ID = "answer_id";
    private static final String EXTRA_NOTIFICATION_TARGET = "notification_target";
    private static final String EXTRA_NOTIFICATION_ID = "notification_id";
    private static final String EXTRA_INLINE_REPLY = "inline_reply";
    private static final String NOTIFICATION_CHANNEL_ID = "transfer_approvals";
    private static final int REQUEST_NOTIFICATIONS = 1001;
    private static final int REQUEST_CONTACTS = 1002;

    private static final int COLOR_BG = Color.rgb(53, 35, 99);
    private static final int COLOR_TWILIGHT_TOP = Color.rgb(101, 84, 155);
    private static final int COLOR_TWILIGHT_MID = Color.rgb(53, 35, 99);
    private static final int COLOR_TWILIGHT_BOTTOM = Color.rgb(22, 10, 47);
    private static final int COLOR_CARD = Color.rgb(252, 250, 255);
    private static final int COLOR_SUBTLE = Color.rgb(245, 241, 255);
    private static final int COLOR_SELECTED = Color.rgb(240, 236, 255);
    private static final int COLOR_INK = Color.rgb(21, 17, 41);
    private static final int COLOR_MUTED = Color.rgb(93, 88, 116);
    private static final int COLOR_TERTIARY = Color.rgb(122, 115, 146);
    private static final int COLOR_LINE = Color.rgb(232, 225, 243);
    private static final int COLOR_LINE_STRONG = Color.rgb(216, 204, 232);
    private static final int COLOR_BLUE = Color.rgb(118, 103, 232);
    private static final int COLOR_BLUE_DARK = Color.rgb(92, 78, 196);
    private static final int COLOR_GREEN = Color.rgb(8, 124, 111);
    private static final int COLOR_WARN = Color.rgb(183, 121, 31);
    private static final int COLOR_RED = Color.rgb(194, 65, 58);
    private static final int COLOR_PRIVATE = Color.rgb(139, 111, 232);
    private static final int COLOR_ON_ATMOSPHERE = Color.rgb(255, 255, 255);
    private static final int COLOR_ON_ATMOSPHERE_MUTED = Color.argb(220, 255, 255, 255);

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final List<CommunicationItem> communicationItems = new ArrayList<>();
    private final List<TopicThread> topicThreads = new ArrayList<>();
    private final List<TopicSuggestion> topicSuggestions = new ArrayList<>();
    private final List<CallRecord> calls = new ArrayList<>();
    private final List<CallerProfile> callerProfiles = new ArrayList<>();
    private final List<ApprovalRequest> approvalRequests = new ArrayList<>();
    private final List<AnswerRequest> answerRequests = new ArrayList<>();
    private final List<AgentNote> agentNotes = new ArrayList<>();
    private final List<CalendarEventRequest> calendarEventRequests = new ArrayList<>();
    private final List<AppNotification> appNotifications = new ArrayList<>();
    private final Set<String> notifiedProductNotificationIds = new HashSet<>();
    private CalendarStatus calendarStatus = new CalendarStatus(false, false, "");
    private BillingAccount billingAccount = BillingAccount.empty();
    private int contactSyncCount = 0;
    private OnboardingStatus onboardingStatus = OnboardingStatus.empty();
    private UserSummary currentUser = UserSummary.empty();
    private ActiveCall activeCall;
    private final BroadcastReceiver pushRefreshReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            refreshFromPush(intent);
        }
    };
    private boolean pushRefreshReceiverRegistered = false;

    private LinearLayout root;
    private LinearLayout bottomNav;
    private LinearLayout content;
    private LinearLayout activeCallBanner;
    private ScrollView scrollView;
    private TextView headerTitle;
    private TextView statusText;
    private ProgressBar loading;
    private String activeTab = "home";
    private String inboxFilter = "All";
    private String searchFilter = "All";
    private String searchQuery = "";
    private String authToken = "";
    private FirebaseAuth firebaseAuth;
    private String pendingDisplayName = "";
    private String pendingPhoneNumber = "";
    private String pendingNotificationTarget = "";
    private int phoneAuthAttemptId = 0;
    private boolean startupLoadAttemptedRetry = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        installCrashRecorder();
        super.onCreate(savedInstanceState);
        createNotificationChannel();
        requestNotificationPermission();
        buildShell();
        registerPushRefreshReceiver();
        handleIntent(getIntent());
        if (!initializeFirebaseAuth()) {
            showFirebaseConfigurationRequired();
        } else if (firebaseAuth.getCurrentUser() == null) {
            showOnboardingWelcome();
        } else if ("home".equals(activeTab)) {
            showStartupSyncing();
            refreshFirebaseTokenThen(this::loadData);
        } else {
            navigateTab(activeTab);
            refreshFirebaseTokenThen(this::loadData);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_CONTACTS) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                syncPhoneContacts();
            } else {
                Toast.makeText(this, "Contacts permission is needed to recognize first-time callers from your address book.", Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    protected void onDestroy() {
        unregisterPushRefreshReceiver();
        executor.shutdownNow();
        super.onDestroy();
    }

    private void buildShell() {
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackground(makeCalmBackground());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(Color.rgb(18, 9, 39));
            getWindow().setNavigationBarColor(Color.BLACK);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            getWindow().getDecorView().setSystemUiVisibility(0);
        }
        root.setPadding(dp(20), systemBarHeight("status_bar_height") + dp(12), dp(20), systemBarHeight("navigation_bar_height") + dp(8));

        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);

        headerTitle = text("Home", 26, COLOR_ON_ATMOSPHERE, Typeface.BOLD);
        header.addView(headerTitle, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        statusText = text("Active", 12, Color.WHITE, Typeface.BOLD);
        statusText.setGravity(Gravity.CENTER);
        statusText.setBackground(makeRounded(Color.argb(225, 8, 124, 111), 999));
        statusText.setPadding(dp(12), dp(8), dp(12), dp(8));
        statusText.setOnClickListener(view -> showAssistantStatus());
        header.addView(statusText);

        TextView avatar = text("DF", 12, COLOR_INK, Typeface.BOLD);
        avatar.setGravity(Gravity.CENTER);
        avatar.setBackground(makeRoundedStroke(Color.argb(238, 252, 250, 255), COLOR_LINE, 999));
        LinearLayout.LayoutParams avatarParams = new LinearLayout.LayoutParams(dp(36), dp(36));
        avatarParams.setMargins(dp(10), 0, 0, 0);
        avatar.setOnClickListener(view -> showProfileAndPrivacy());
        header.addView(avatar, avatarParams);
        root.addView(header);

        activeCallBanner = new LinearLayout(this);
        activeCallBanner.setOrientation(LinearLayout.VERTICAL);
        activeCallBanner.setVisibility(View.GONE);
        root.addView(activeCallBanner);

        loading = new ProgressBar(this);
        loading.setVisibility(View.GONE);
        root.addView(loading, new LinearLayout.LayoutParams(dp(32), dp(32)));

        scrollView = new ScrollView(this);
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(0, dp(18), 0, dp(150));
        scrollView.addView(content);
        root.addView(scrollView, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1
        ));

        bottomNav = new LinearLayout(this);
        bottomNav.setOrientation(LinearLayout.HORIZONTAL);
        bottomNav.setGravity(Gravity.CENTER);
        bottomNav.setPadding(dp(6), dp(8), dp(6), dp(8));
        bottomNav.setBackground(makeRoundedStroke(Color.argb(240, 252, 250, 255), COLOR_LINE, 20));
        LinearLayout.LayoutParams navParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(72));
        navParams.setMargins(0, 0, 0, dp(8));
        root.addView(bottomNav, navParams);

        setContentView(root);
        renderTabs();
    }

    private boolean initializeFirebaseAuth() {
        if (FirebaseApp.getApps(this).isEmpty()) {
            return false;
        }
        firebaseAuth = FirebaseAuth.getInstance();
        FirebaseCrashlytics crashlytics = FirebaseCrashlytics.getInstance();
        crashlytics.setCrashlyticsCollectionEnabled(!BuildConfig.DEBUG);
        crashlytics.setCustomKey("screen", activeTab);
        crashlytics.setCustomKey("backend", BuildConfig.BACKEND_BASE_URL);
        return true;
    }

    private void installCrashRecorder() {
        Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            try {
                StringWriter writer = new StringWriter();
                error.printStackTrace(new PrintWriter(writer));
                getSharedPreferences(APP_PREFS, MODE_PRIVATE)
                        .edit()
                        .putString(PREF_LAST_CRASH, writer.toString())
                        .apply();
            } catch (Exception ignored) {
            }
            if (previous != null) {
                previous.uncaughtException(thread, error);
            }
        });
    }

    private void showFirebaseConfigurationRequired() {
        activeTab = "setup";
        bottomNav.setVisibility(View.GONE);
        setScreenTitle("Setup");
        statusText.setText("Blocked");
        statusText.setBackground(makeRounded(COLOR_RED, 999));
        content.removeAllViews();
        content.addView(titleBlock("Authentication is not configured", "This build needs Firebase Phone Auth before anyone can create an account."));
        content.addView(quietPanel("Missing app configuration", "Register the Android app in Firebase, enable Phone sign-in, and build with the Firebase Android API key, app id, and project id."));
    }

    private void refreshFirebaseTokenThen(Runnable next) {
        FirebaseUser user = firebaseAuth == null ? null : firebaseAuth.getCurrentUser();
        if (user == null) {
            authToken = "";
            showOnboardingWelcome();
            return;
        }
        user.getIdToken(false).addOnCompleteListener(task -> {
            if (!task.isSuccessful() || task.getResult() == null) {
                authToken = "";
                mainHandler.post(() -> {
                    Toast.makeText(this, "Please sign in again.", Toast.LENGTH_LONG).show();
                    showOnboardingWelcome();
                });
                return;
            }
            authToken = task.getResult().getToken();
            registerFcmToken();
            mainHandler.post(next);
        });
    }

    private void registerPushRefreshReceiver() {
        if (pushRefreshReceiverRegistered) {
            return;
        }
        IntentFilter filter = new IntentFilter(ACTION_PUSH_REFRESH);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(pushRefreshReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(pushRefreshReceiver, filter);
        }
        pushRefreshReceiverRegistered = true;
    }

    private void unregisterPushRefreshReceiver() {
        if (!pushRefreshReceiverRegistered) {
            return;
        }
        try {
            unregisterReceiver(pushRefreshReceiver);
        } catch (IllegalArgumentException ignored) {
        }
        pushRefreshReceiverRegistered = false;
    }

    private void refreshFromPush(Intent intent) {
        if (firebaseAuth == null || firebaseAuth.getCurrentUser() == null) {
            return;
        }
        String type = intent == null ? "" : intent.getStringExtra("type");
        String target = intent == null ? "" : intent.getStringExtra(EXTRA_NOTIFICATION_TARGET);
        if (isLiveActionType(type)) {
            activeTab = "assistant";
            pendingNotificationTarget = target == null ? "" : target;
            renderTabs();
        }
        Runnable refresh = this::refreshLiveStateFromPush;
        if (authToken == null || authToken.length() == 0) {
            refreshFirebaseTokenThen(refresh);
        } else {
            refresh.run();
        }
    }

    private void registerFcmToken() {
        if (authToken == null || authToken.length() == 0) {
            return;
        }
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful() || task.getResult() == null || task.getResult().length() == 0) {
                Log.w(LOG_TAG, "Could not get FCM token", task.getException());
                return;
            }
            String token = task.getResult();
            executor.execute(() -> {
                try {
                    JSONObject payload = new JSONObject();
                    payload.put("token", token);
                    payload.put("platform", "android");
                    payload.put("deviceId", Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID));
                    payload.put("appVersion", BuildConfig.VERSION_NAME);
                    postJsonForObject(new URL(BuildConfig.BACKEND_BASE_URL + "/v1/push-tokens"), payload, true);
                    Log.i(LOG_TAG, "Registered FCM token");
                } catch (Exception error) {
                    Log.w(LOG_TAG, "Could not register FCM token", error);
                }
            });
        });
    }

    private void renderTabs() {
        bottomNav.removeAllViews();
        addTab("threads", "Topics");
        addTab("inbox", "Review");
        addTab("home", "Home");
        addTab("assistant", "Assistant");
        addTab("search", "Search");
    }

    private void addTab(String id, String label) {
        boolean selected = id.equals(activeTab);
        LinearLayout button = new LinearLayout(this);
        button.setOrientation(LinearLayout.VERTICAL);
        button.setGravity(Gravity.CENTER);
        button.setBackground(selected ? makeRounded(COLOR_TWILIGHT_BOTTOM, 16) : makeRounded(Color.TRANSPARENT, 16));
        button.setPadding(dp(2), dp(5), dp(2), dp(4));
        button.setContentDescription(label);
        button.setOnClickListener(view -> navigateTab(id));

        ImageView icon = new ImageView(this);
        icon.setImageResource(tabIconRes(id));
        icon.setColorFilter(selected ? Color.WHITE : COLOR_MUTED);
        LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(dp(21), dp(21));
        iconParams.setMargins(0, 0, 0, dp(3));
        button.addView(icon, iconParams);

        TextView labelView = text(label, 10, selected ? Color.WHITE : COLOR_MUTED, Typeface.BOLD);
        labelView.setGravity(Gravity.CENTER);
        button.addView(labelView);

        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(56), 1);
        params.setMargins(dp(3), 0, dp(3), 0);
        bottomNav.addView(button, params);
    }

    private int tabIconRes(String id) {
        if ("threads".equals(id)) {
            return R.drawable.ic_nav_threads;
        }
        if ("inbox".equals(id)) {
            return R.drawable.ic_nav_inbox;
        }
        if ("home".equals(id)) {
            return R.drawable.ic_nav_home;
        }
        if ("assistant".equals(id)) {
            return R.drawable.ic_nav_assistant;
        }
        if ("search".equals(id)) {
            return R.drawable.ic_nav_search;
        }
        return R.drawable.ic_nav_home;
    }

    private void navigateTab(String id) {
        bottomNav.setVisibility(View.VISIBLE);
        activeTab = id;
        recordCrashBreadcrumb("tab_" + id);
        renderTabs();
        if ("home".equals(id)) {
            showToday();
        } else if ("threads".equals(id)) {
            showThreads();
        } else if ("inbox".equals(id)) {
            showInbox();
        } else if ("assistant".equals(id)) {
            showAssistant();
        } else if ("search".equals(id)) {
            showSearch();
        } else {
            showToday();
        }
    }

    private void showOnboardingWelcome() {
        activeTab = "onboarding";
        bottomNav.setVisibility(View.GONE);
        setScreenTitle("Welcome");
        statusText.setText("Setup");
        statusText.setBackground(makeRounded(COLOR_WARN, 999));
        content.removeAllViews();
        content.addView(titleBlock("Your phone should only ring when it should.", "Create your assistant, keep your current number, and let important calls reach you with context."));

        LinearLayout form = panel();
        form.addView(text("Start with your mobile number", 18, COLOR_INK, Typeface.BOLD));
        form.addView(body("We will verify this number, assign your assistant number, and walk you through forwarding setup."));
        EditText name = input("Your name");
        form.addView(name);
        EditText phone = input("Mobile number");
        phone.setInputType(InputType.TYPE_CLASS_PHONE);
        form.addView(phone);
        Button create = primaryButton("Send code");
        create.setOnClickListener(view -> startFirebasePhoneAuth(name.getText().toString(), phone.getText().toString()));
        form.addView(create, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)));
        content.addView(form);

        content.addView(quietPanel("You keep your number", "Callers keep dialing you. Your carrier forwards selected calls to your assistant so the app can screen, summarize, and notify you."));
    }

    private void showOnboardingLoading() {
        activeTab = "onboarding";
        bottomNav.setVisibility(View.GONE);
        setScreenTitle("Welcome");
        statusText.setText("Setup");
        statusText.setBackground(makeRounded(COLOR_WARN, 999));
        content.removeAllViews();
        content.addView(titleBlock("Setting up your assistant", "Checking where you left off."));
        content.addView(quietPanel("One calm setup flow", "We will walk through phone verification, assistant naming, forwarding, and one test call before opening the main app."));
    }

    private void showStartupSyncing() {
        activeTab = "home";
        bottomNav.setVisibility(View.VISIBLE);
        renderTabs();
        setScreenTitle("Home");
        statusText.setText("Syncing");
        statusText.setBackground(makeRounded(COLOR_WARN, 999));
        content.removeAllViews();
        content.addView(titleBlock("Syncing your assistant", "Loading calls, topics, calendar activity, and live requests."));
        content.addView(quietPanel("Almost there", "If the connection is waking up, this should only take a moment."));
    }

    private boolean shouldShowFirstRunOnboarding() {
        if (firebaseAuth == null || firebaseAuth.getCurrentUser() == null) {
            return false;
        }
        if (!coreOnboardingComplete()) {
            return true;
        }
        return !getSharedPreferences(APP_PREFS, MODE_PRIVATE).getBoolean(firstRunOnboardingPrefKey(), false);
    }

    private boolean coreOnboardingComplete() {
        if (onboardingStatus == null || onboardingStatus.totalCount == 0) {
            return false;
        }
        for (OnboardingStep step : onboardingStatus.checklist) {
            if (("account".equals(step.id)
                    || "phone_verification".equals(step.id)
                    || "assistant_profile".equals(step.id)
                    || "billing".equals(step.id)
                    || "assistant_number".equals(step.id)
                    || "forwarding".equals(step.id))
                    && !step.complete) {
                return false;
            }
        }
        return true;
    }

    private boolean billingStepRequiredAndIncomplete() {
        if (onboardingStatus == null) {
            return false;
        }
        for (OnboardingStep step : onboardingStatus.checklist) {
            if ("billing".equals(step.id)) {
                return !step.complete;
            }
        }
        return false;
    }

    private String firstRunOnboardingPrefKey() {
        FirebaseUser user = firebaseAuth == null ? null : firebaseAuth.getCurrentUser();
        return user == null ? PREF_FIRST_RUN_ONBOARDING_COMPLETE : PREF_FIRST_RUN_ONBOARDING_COMPLETE + "_" + user.getUid();
    }

    private void showFirstRunOnboardingNextStep() {
        activeTab = "onboarding";
        bottomNav.setVisibility(View.GONE);
        renderActiveCallBanner();
        statusText.setText("Setup");
        statusText.setBackground(makeRounded(COLOR_WARN, 999));
        if (onboardingStatus == null || onboardingStatus.totalCount == 0) {
            showOnboardingLoading();
            return;
        }
        for (OnboardingStep step : onboardingStatus.checklist) {
            if (!step.complete) {
                if ("account".equals(step.id) || "phone_verification".equals(step.id)) {
                    showOnboardingWelcome();
                    return;
                }
                if ("assistant_profile".equals(step.id)) {
                    showAssistantProfileSetup(true);
                    return;
                }
                if ("billing".equals(step.id)) {
                    showBillingSetup(true);
                    return;
                }
                if ("assistant_number".equals(step.id)) {
                    showAssistantNumberSetup(true);
                    return;
                }
                if ("forwarding".equals(step.id)) {
                    showForwarding(true);
                    return;
                }
                showOnboardingTestCall();
                return;
            }
        }
        showOnboardingTestCall();
    }

    private void showAssistantProfileSetup() {
        showAssistantProfileSetup(true);
    }

    private void showAssistantProfileSetup(boolean continueToActivation) {
        bottomNav.setVisibility(continueToActivation ? View.GONE : View.VISIBLE);
        setScreenTitle("Assistant");
        content.removeAllViews();
        content.addView(titleBlock("Name your assistant", "Callers will hear this name. You can change it later."));

        LinearLayout form = panel();
        EditText assistantName = input("Assistant name");
        assistantName.setText(currentUser.assistantName.length() > 0 ? currentUser.assistantName : "Assistant");
        form.addView(assistantName);
        form.addView(body("Pick a simple name now. Style, rules, and trusted contacts can wait until your first call works."));
        form.addView(nameSuggestionRow(assistantName, "Maya", "Ava"));
        form.addView(nameSuggestionRow(assistantName, "Jordan", "Alex"));
        Button save = primaryButton(continueToActivation ? "Continue" : "Save name");
        save.setOnClickListener(view -> saveAssistantProfile(assistantName.getText().toString(), continueToActivation));
        form.addView(save, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)));
        content.addView(form);
    }

    private View nameSuggestionRow(EditText assistantName, String first, String second) {
        LinearLayout suggestions = row();
        suggestions.setPadding(0, 0, 0, dp(10));
        Button firstButton = secondaryButton(first);
        firstButton.setOnClickListener(view -> assistantName.setText(first));
        Button secondButton = secondaryButton(second);
        secondButton.setOnClickListener(view -> assistantName.setText(second));
        suggestions.addView(firstButton, gridCellParams(44, true, false));
        suggestions.addView(secondButton, gridCellParams(44, false, false));
        return suggestions;
    }

    private void showBillingSetup() {
        showBillingSetup(false);
    }

    private void showBillingSetup(boolean continueToActivation) {
        activeTab = continueToActivation ? "onboarding" : activeTab;
        bottomNav.setVisibility(continueToActivation ? View.GONE : View.VISIBLE);
        setScreenTitle("Billing");
        content.removeAllViews();
        content.addView(titleBlock("Choose your spending limit", "$19/month includes your assistant number, 50 assistant minutes, summaries, and topic matching."));

        LinearLayout status = panel();
        status.addView(text(billingAccount.statusLabel(), 20, COLOR_INK, Typeface.BOLD));
        status.addView(body("You can change or pause this anytime. We never store card details in Phone Agent."));
        status.addView(sectionLine("Current cap", billingAccount.formattedCap()));
        status.addView(sectionLine("This month", billingAccount.formattedSpend()));
        status.addView(sectionLine("Card", billingAccount.paymentMethodLabel()));
        content.addView(status);

        LinearLayout cap = panel();
        cap.addView(text("Monthly cap", 18, COLOR_INK, Typeface.BOLD));
        cap.addView(body("Set the most you want to spend this month before your assistant starts paid work."));
        LinearLayout presetsOne = row();
        presetsOne.addView(capButton("$25", 2500, continueToActivation), gridCellParams(48, true, true));
        presetsOne.addView(capButton("$40", 4000, continueToActivation), gridCellParams(48, false, true));
        cap.addView(presetsOne);
        LinearLayout presetsTwo = row();
        presetsTwo.addView(capButton("$75", 7500, continueToActivation), gridCellParams(48, true, false));
        presetsTwo.addView(capButton("$100", 10000, continueToActivation), gridCellParams(48, false, false));
        cap.addView(presetsTwo);
        EditText custom = input("Custom cap, dollars");
        custom.setInputType(InputType.TYPE_CLASS_NUMBER);
        cap.addView(custom);
        Button saveCap = secondaryButton("Save custom cap");
        saveCap.setOnClickListener(view -> {
            String value = custom.getText().toString().trim();
            if (value.length() == 0) {
                Toast.makeText(this, "Enter a dollar amount.", Toast.LENGTH_LONG).show();
                return;
            }
            try {
                updateSpendingCap(Integer.parseInt(value) * 100, continueToActivation);
            } catch (NumberFormatException error) {
                Toast.makeText(this, "Enter a whole dollar amount.", Toast.LENGTH_LONG).show();
            }
        });
        cap.addView(saveCap, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)));
        content.addView(cap);

        LinearLayout payment = panel();
        payment.addView(text("Payment method", 18, COLOR_INK, Typeface.BOLD));
        payment.addView(body("Card setup opens in a secure payment page. Return here and tap check status if the app does not reopen automatically."));
        Button addCard = primaryButton(billingAccount.hasPaymentMethod() ? "Update card" : "Add card");
        addCard.setOnClickListener(view -> openBillingCheckout());
        payment.addView(addCard, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)));
        Button check = secondaryButton("Check billing status");
        check.setOnClickListener(view -> activateBilling(continueToActivation));
        payment.addView(check, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)));
        if (billingAccount.isActive()) {
            Button next = primaryButton(continueToActivation ? "Continue" : "Done");
            next.setOnClickListener(view -> {
                if (continueToActivation) {
                    showAssistantNumberSetup(true);
                } else {
                    navigateTab("assistant");
                }
            });
            payment.addView(next, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)));
        }
        content.addView(payment);

        content.addView(quietPanel("Simple pricing", "Your plan includes 50 assistant minutes. Extra assistant call time is $0.39/min and your monthly cap protects overage."));
    }

    private Button capButton(String label, int cents, boolean continueToActivation) {
        Button button = cents == billingAccount.monthlySpendingCapCents ? primaryButton(label) : secondaryButton(label);
        button.setOnClickListener(view -> updateSpendingCap(cents, continueToActivation));
        return button;
    }

    private void showPhoneCodeEntry(String verificationId) {
        bottomNav.setVisibility(View.GONE);
        setScreenTitle("Verify");
        content.removeAllViews();
        content.addView(titleBlock("Enter your code", "We sent a verification code to your mobile number."));

        LinearLayout form = panel();
        form.addView(sectionLine("Mobile", pendingPhoneNumber.length() > 0 ? pendingPhoneNumber : "Not set"));
        EditText code = input("Verification code");
        code.setInputType(InputType.TYPE_CLASS_NUMBER);
        form.addView(code);
        Button verify = secondaryButton("Verify code");
        form.addView(verify, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)));
        content.addView(form);

        verify.setOnClickListener(view -> completeFirebasePhoneAuth(verificationId, code.getText().toString()));
    }

    private void showAssistantNumberSetup() {
        showAssistantNumberSetup(true);
    }

    private void showAssistantNumberSetup(boolean continueToActivation) {
        bottomNav.setVisibility(continueToActivation ? View.GONE : View.VISIBLE);
        setScreenTitle("Number");
        content.removeAllViews();
        content.addView(titleBlock("Assign assistant number", "This is the number your current mobile number forwards to."));

        LinearLayout form = panel();
        form.addView(body("Use your preferred area code if available. During beta, number assignment may be restricted by plan or allowlist."));
        EditText areaCode = input("Area code, optional");
        areaCode.setInputType(InputType.TYPE_CLASS_NUMBER);
        form.addView(areaCode);
        Button assign = primaryButton("Assign number");
        assign.setOnClickListener(view -> requestAssistantNumber(areaCode.getText().toString(), continueToActivation));
        form.addView(assign, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)));
        if (!continueToActivation) {
            Button skip = secondaryButton("Continue to app");
            skip.setOnClickListener(view -> {
                bottomNav.setVisibility(View.VISIBLE);
                activeTab = "assistant";
                renderTabs();
                showAssistant();
                loadData();
            });
            form.addView(skip, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)));
        }
        content.addView(form);
    }

    private void showToday() {
        bottomNav.setVisibility(View.VISIBLE);
        if (!"home".equals(activeTab)) {
            activeTab = "home";
            renderTabs();
        }
        setScreenTitle("Home");
        content.removeAllViews();

        content.addView(sectionHeader("Tracked topics"));
        content.addView(homeTopicCarousel());
        content.addView(sectionHeader("Recent calls"));
        addHomeCalls();
        content.addView(sectionHeader("Needs attention"));
        addPriorityQueue();
    }

    private View assistantStateStrip() {
        LinearLayout card = panel();
        card.setPadding(dp(20), dp(20), dp(20), dp(20));
        String title = activeCall != null
                ? "Assistant is on a call"
                : onboardingStatus.readyForBetaUse ? "Assistant active" : onboardingStatus.totalCount == 0 ? "Assistant is waking up" : "Finish activation";
        String body = activeCall != null
                ? activeCall.displayCaller() + " / " + activeCall.statusLabel()
                : onboardingStatus.readyForBetaUse
                ? "Handling missed calls, topic suggestions, notes, and calendar context."
                : onboardingStatus.totalCount == 0 ? "Syncing your calls, topics, and calendar context." : onboardingStatus.completedCount + " of " + onboardingStatus.totalCount + " setup steps complete.";
        card.addView(text(title, 28, COLOR_INK, Typeface.BOLD));
        card.addView(body(body));

        LinearLayout meta = new LinearLayout(this);
        meta.setOrientation(LinearLayout.HORIZONTAL);
        meta.setPadding(0, dp(14), 0, 0);
        meta.addView(compactMetric("Needs you", String.valueOf(appNotifications.size() + approvalRequests.size() + answerRequests.size())), gridCellParams(72, true, false));
        meta.addView(compactMetric("Topics", String.valueOf(topicThreads.size())), gridCellParams(72, true, false));
        meta.addView(compactMetric("Handled", String.valueOf(calls.size())), gridCellParams(72, false, false));
        card.addView(meta);

        LinearLayout actions = row();
        Button primary = primaryButton(activeCall != null ? "Open assistant" : "Test call");
        primary.setOnClickListener(view -> {
            if (activeCall != null) {
                navigateTab("assistant");
            } else {
                dial(BuildConfig.PHONE_AGENT_NUMBER);
            }
        });
        Button secondary = secondaryButton("Add note");
        secondary.setOnClickListener(view -> {
            activeTab = "assistant";
            renderTabs();
            showNotes();
        });
        actions.addView(primary, gridCellParams(50, true, false));
        actions.addView(secondary, gridCellParams(50, false, false));
        card.addView(actions);
        return card;
    }

    private View compactMetric(String label, String value) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setBackground(makeRoundedStroke(COLOR_SELECTED, COLOR_LINE, 12));
        TextView valueView = text(value, 22, COLOR_INK, Typeface.BOLD);
        valueView.setGravity(Gravity.CENTER);
        box.addView(valueView);
        TextView labelView = text(label, 12, COLOR_MUTED, Typeface.BOLD);
        labelView.setGravity(Gravity.CENTER);
        box.addView(labelView);
        return box;
    }

    private void addHomeCalls() {
        if (calls.isEmpty()) {
            content.addView(quietPanel("No calls yet", "Once the assistant handles a call, it will appear here with callback, detail, and note actions."));
            return;
        }
        int shown = 0;
        for (CallRecord call : calls) {
            if (shown >= 6) {
                break;
            }
            content.addView(callCard(call));
            shown += 1;
        }
        if (calls.size() > shown) {
            Button more = secondaryButton("See all calls");
            more.setOnClickListener(view -> navigateTab("inbox"));
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(46));
            params.setMargins(0, dp(4), 0, dp(12));
            content.addView(more, params);
        }
    }

    private View homeTopicCarousel() {
        HorizontalScrollView scroller = new HorizontalScrollView(this);
        scroller.setHorizontalScrollBarEnabled(false);
        LinearLayout rail = new LinearLayout(this);
        rail.setOrientation(LinearLayout.HORIZONTAL);
        rail.setPadding(0, 0, dp(16), dp(4));
        scroller.addView(rail);

        if (topicThreads.isEmpty()) {
            rail.addView(homeTopicCard(null), new LinearLayout.LayoutParams(dp(238), dp(154)));
            return scroller;
        }

        int shown = 0;
        for (TopicThread topic : topicThreads) {
            if (shown >= 8) {
                break;
            }
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(238), dp(154));
            params.setMargins(0, 0, dp(12), 0);
            rail.addView(homeTopicCard(topic), params);
            shown += 1;
        }
        return scroller;
    }

    private View homeTopicCard(TopicThread topic) {
        FrameLayout card = new FrameLayout(this);
        card.setBackground(makeRounded(COLOR_CARD, 18));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            card.setClipToOutline(true);
        }

        ImageView image = new ImageView(this);
        image.setScaleType(ImageView.ScaleType.CENTER_CROP);
        image.setImageResource(topicImageResource(topic));
        card.addView(image, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        LinearLayout overlay = new LinearLayout(this);
        overlay.setOrientation(LinearLayout.VERTICAL);
        overlay.setPadding(dp(14), dp(9), dp(14), dp(11));
        overlay.setBackgroundColor(Color.argb(118, 14, 9, 34));

        String title = topic == null ? "Topics will appear here" : topic.title;
        String meta = topic == null ? "Calls, notes, calendar" : compactTopicMeta(topic);
        String detail = topic == null
                ? "Related conversations become topic cards."
                : topic.latestStructuredState().length() > 0
                ? topic.latestStructuredState()
                : topic.description.length() > 0 ? topic.description : "No structured state yet.";
        TextView titleView = text(title, 15, Color.WHITE, Typeface.BOLD);
        titleView.setMaxLines(2);
        titleView.setEllipsize(TextUtils.TruncateAt.END);
        overlay.addView(titleView);

        TextView metaView = text(meta, 10, Color.argb(225, 255, 255, 255), Typeface.BOLD);
        metaView.setMaxLines(1);
        metaView.setEllipsize(TextUtils.TruncateAt.END);
        metaView.setPadding(0, dp(2), 0, dp(2));
        overlay.addView(metaView);

        TextView detailView = text(detail.length() > 58 ? detail.substring(0, 55) + "..." : detail, 11, Color.argb(232, 255, 255, 255), Typeface.NORMAL);
        detailView.setMaxLines(2);
        detailView.setEllipsize(TextUtils.TruncateAt.END);
        detailView.setLineSpacing(dp(1), 1.0f);
        overlay.addView(detailView);

        FrameLayout.LayoutParams overlayParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM
        );
        card.addView(overlay, overlayParams);
        card.setOnClickListener(view -> {
            if (topic == null) {
                navigateTab("threads");
            } else {
                showTopicDetail(topic.id);
            }
        });
        return card;
    }

    private int topicImageResource(TopicThread topic) {
        if (topic == null) {
            return R.drawable.topic_home_projects_generated;
        }
        String key = (topic.title + " " + topic.description).toLowerCase(Locale.US);
        if (key.contains("dog") || key.contains("cat") || key.contains("pet") || key.contains("vet") || key.contains("rhodesian")) {
            return R.drawable.topic_pets_generated;
        }
        if (key.contains("contractor") || key.contains("architect") || key.contains("basement") || key.contains("home")
                || key.contains("repair") || key.contains("renovation") || key.contains("plumb") || key.contains("inspection")) {
            return R.drawable.topic_home_projects_generated;
        }
        if (key.contains("car") || key.contains("auto") || key.contains("vehicle") || key.contains("lease")
                || key.contains("mechanic") || key.contains("dmv")) {
            return R.drawable.topic_car_generated;
        }
        if (key.contains("school") || key.contains("coach") || key.contains("sport") || key.contains("practice")
                || key.contains("game") || key.contains("activity")) {
            return R.drawable.topic_school_generated;
        }
        if (key.contains("family") || key.contains("kid") || key.contains("wife") || key.contains("husband")
                || key.contains("spouse") || key.contains("parent")) {
            return R.drawable.topic_family_generated;
        }
        if (key.contains("doctor") || key.contains("dentist") || key.contains("medical") || key.contains("health")
                || key.contains("clinic") || key.contains("appointment") || key.contains("medicine")) {
            return R.drawable.topic_medical_generated;
        }
        if (key.contains("tax") || key.contains("accountant") || key.contains("payment") || key.contains("budget")
                || key.contains("finance") || key.contains("invoice") || key.contains("cost")) {
            return R.drawable.topic_finance_generated;
        }
        if (key.contains("travel") || key.contains("trip") || key.contains("flight") || key.contains("hotel")
                || key.contains("vacation") || key.contains("barcelona")) {
            return R.drawable.topic_travel_generated;
        }
        if (key.contains("work") || key.contains("recruit") || key.contains("client") || key.contains("decision")
                || key.contains("job") || key.contains("interview") || key.contains("customer")) {
            return R.drawable.topic_work_generated;
        }
        return R.drawable.topic_general_generated;
    }

    private void addPriorityQueue() {
        boolean hasPriority = false;
        if (activeCall != null) {
            content.addView(activeCallPriorityCard());
            hasPriority = true;
        }
        for (ApprovalRequest approvalRequest : approvalRequests) {
            content.addView(approvalCard(approvalRequest));
            hasPriority = true;
        }
        for (AnswerRequest answerRequest : answerRequests) {
            content.addView(answerCard(answerRequest));
            hasPriority = true;
        }
        int count = 0;
        for (TopicSuggestion suggestion : topicSuggestions) {
            if (count >= 2) {
                break;
            }
            content.addView(priorityTopicSuggestionCard(suggestion));
            count += 1;
            hasPriority = true;
        }
        if (!hasPriority) {
            content.addView(quietPanel("Quiet right now", "The assistant will surface calls, decisions, and topic changes when they need your attention."));
        }
    }

    private View activeCallPriorityCard() {
        LinearLayout card = panel();
        card.setBackground(makeRoundedStroke(Color.rgb(255, 247, 237), Color.rgb(253, 186, 116), 14));
        card.addView(text("Live call in progress", 18, COLOR_INK, Typeface.BOLD));
        card.addView(label(activeCall.statusLabel() + " / " + activeCall.formattedElapsed()));
        card.addView(body(activeCall.displayCaller()));
        if (activeCall.intent.length() > 0) {
            card.addView(sectionLine("Intent", activeCall.intent));
        }
        Button open = primaryButton("Open assistant");
        open.setOnClickListener(view -> navigateTab("assistant"));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50));
        params.setMargins(0, dp(12), 0, 0);
        card.addView(open, params);
        return card;
    }

    private View priorityTopicSuggestionCard(TopicSuggestion suggestion) {
        LinearLayout card = panel();
        CommunicationItem item = findCommunication(suggestion.communicationItemId);
        TopicThread topic = suggestion.suggestedTopicThreadId.length() > 0 ? findTopic(suggestion.suggestedTopicThreadId) : null;
        card.addView(label("Review topic suggestion / " + Math.round(suggestion.confidence * 100) + "%"));
        card.addView(text(suggestion.displayTitle(topic), 18, COLOR_INK, Typeface.BOLD));
        String reason = suggestion.reason.length() > 180 ? suggestion.reason.substring(0, 177) + "..." : suggestion.reason;
        if (reason.length() > 0) {
            card.addView(body(reason));
        }
        if (item != null) {
            card.addView(sectionLine("Source", item.displayTitle()));
        }
        LinearLayout actions = row();
        Button review = primaryButton("Review");
        review.setOnClickListener(view -> navigateTab("inbox"));
        Button dismiss = secondaryButton("Dismiss");
        dismiss.setOnClickListener(view -> decideTopicSuggestion(suggestion.id, false));
        actions.addView(review, gridCellParams(44, true, false));
        actions.addView(dismiss, gridCellParams(44, false, false));
        card.addView(actions);
        return card;
    }

    private View todayMetricsPanel() {
        LinearLayout panel = panel();
        panel.addView(metricRow("Needs you", String.valueOf(approvalRequests.size() + answerRequests.size())));
        panel.addView(metricRow("Notifications", String.valueOf(appNotifications.size())));
        panel.addView(metricRow("Topic updates", String.valueOf(topicThreads.size())));
        panel.addView(metricRow("Review items", String.valueOf(topicSuggestions.size())));
        panel.addView(metricRow("Calls handled", String.valueOf(calls.size())));
        panel.addView(metricRow("Calendar changes", String.valueOf(calendarEventRequests.size())));
        return panel;
    }

    private View metricRow(String label, String value) {
        LinearLayout row = row();
        row.setPadding(0, dp(7), 0, dp(7));
        TextView left = text(label, 15, COLOR_MUTED, Typeface.NORMAL);
        row.addView(left, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        TextView right = text(value, 15, COLOR_INK, Typeface.BOLD);
        right.setGravity(Gravity.RIGHT);
        row.addView(right);
        return row;
    }

    private View setupSummaryCard() {
        LinearLayout card = panel();
        card.addView(text(onboardingStatus.totalCount == 0 ? "Checking activation" : onboardingStatus.completedCount + " of " + onboardingStatus.totalCount + " complete", 18, COLOR_INK, Typeface.BOLD));
        if (onboardingStatus.nextActionLabel.length() > 0) {
            card.addView(body("Next: " + onboardingStatus.nextActionLabel));
        } else if (onboardingStatus.totalCount == 0) {
            card.addView(body("Checking your setup status."));
        } else {
            card.addView(body("All setup steps are complete."));
        }

        for (OnboardingStep step : onboardingStatus.checklist) {
            if (!step.complete) {
                Button action = primaryButton(actionLabel(step.action));
                action.setOnClickListener(view -> navigateToSetupAction(step.action));
                LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(40));
                params.setMargins(0, dp(10), 0, 0);
                card.addView(action, params);
                break;
            }
        }
        return card;
    }

    private View onboardingStepCard(OnboardingStep step) {
        LinearLayout card = panel();
        LinearLayout top = row();
        TextView title = text(step.label, 15, COLOR_INK, Typeface.BOLD);
        top.addView(title, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        TextView state = text(step.complete ? "Done" : "Open", 12, Color.WHITE, Typeface.BOLD);
        state.setGravity(Gravity.CENTER);
        state.setPadding(dp(10), dp(5), dp(10), dp(5));
        state.setBackground(makeRounded(step.complete ? COLOR_GREEN : COLOR_WARN, 999));
        top.addView(state);
        card.addView(top);

        Button action = step.complete ? secondaryButton(actionLabel(step.action)) : primaryButton(actionLabel(step.action));
        action.setOnClickListener(view -> navigateToSetupAction(step.action));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(36));
        params.setMargins(0, dp(8), 0, 0);
        card.addView(action, params);
        return card;
    }

    private String actionLabel(String action) {
        if ("account".equals(action)) {
            return "Account";
        }
        if ("verify_phone".equals(action)) {
            return "Verify";
        }
        if ("assistant_name".equals(action)) {
            return "Name";
        }
        if ("assistant_profile".equals(action)) {
            return "Customize";
        }
        if ("assistant_number".equals(action)) {
            return "Assign";
        }
        if ("calendar".equals(action)) {
            return calendarStatus.connected ? "Open calendar" : "Connect";
        }
        if ("billing".equals(action)) {
            return billingAccount.isActive() ? "Billing" : "Add card";
        }
        if ("forwarding".equals(action)) {
            return "Forwarding";
        }
        if ("topics".equals(action)) {
            return "Topics";
        }
        if ("notes".equals(action)) {
            return "Notes";
        }
        if ("contacts".equals(action)) {
            return "Sync";
        }
        if ("call".equals(action)) {
            return "Test call";
        }
        if ("inbox".equals(action)) {
            return "Review";
        }
        if ("settings".equals(action)) {
            return "Settings";
        }
        return "Open";
    }

    private void navigateToSetupAction(String action) {
        if ("account".equals(action)) {
            showProfileAndPrivacy();
            return;
        }
        if ("verify_phone".equals(action)) {
            showOnboardingWelcome();
            return;
        }
        if ("assistant_name".equals(action)) {
            showAssistantProfileSetup();
            return;
        }
        if ("assistant_profile".equals(action)) {
            showAssistantProfileSetup(false);
            return;
        }
        if ("assistant_number".equals(action)) {
            showAssistantNumberSetup();
            return;
        }
        if ("billing".equals(action)) {
            showBillingSetup();
            return;
        }
        if ("notifications".equals(action)) {
            showNotificationCenter();
            return;
        }
        if ("call".equals(action)) {
            dial(BuildConfig.PHONE_AGENT_NUMBER);
            return;
        }
        if ("calendar".equals(action) && !calendarStatus.connected) {
            openCalendarConnectUrl();
            return;
        }
        if ("contacts".equals(action)) {
            requestContactsSync();
            return;
        }
        if ("topics".equals(action) || "threads".equals(action)) {
            navigateTab("threads");
        } else if ("inbox".equals(action)) {
            navigateTab("inbox");
        } else if ("live".equals(action) || "assistant".equals(action)) {
            navigateTab("assistant");
        } else {
            activeTab = "assistant";
            renderTabs();
            if ("notes".equals(action)) {
                showNotes();
            } else if ("calendar".equals(action)) {
                showCalendar();
            } else if ("people".equals(action)) {
                showPeople();
            } else if ("forwarding".equals(action)) {
                showForwarding();
            } else if ("rules".equals(action)) {
                showRules();
            } else {
                showAssistant();
            }
        }
    }

    private void showInbox() {
        setScreenTitle("Review");
        content.removeAllViews();
        content.addView(inboxFilterRow());
        content.addView(reviewSummaryRow());

        renderInboxContent();
    }

    private View inboxFilterRow() {
        LinearLayout filters = new LinearLayout(this);
        filters.setOrientation(LinearLayout.HORIZONTAL);
        filters.setPadding(0, 0, 0, dp(12));
        String[] labels = new String[]{"All", "Topics", "Calls", "Calendar"};
        for (String label : labels) {
            boolean selected = label.equals(inboxFilter);
            TextView chip = text(label, 13, selected ? Color.WHITE : COLOR_MUTED, Typeface.BOLD);
            chip.setGravity(Gravity.CENTER);
            chip.setPadding(dp(10), 0, dp(10), 0);
            chip.setBackground(selected ? makeRounded(COLOR_BLUE, 999) : makeRoundedStroke(COLOR_CARD, COLOR_LINE, 999));
            chip.setOnClickListener(view -> {
                inboxFilter = label;
                showInbox();
            });
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(32));
            params.setMargins(0, 0, dp(8), 0);
            filters.addView(chip, params);
        }
        return filters;
    }

    private View reviewSummaryRow() {
        LinearLayout actions = row();
        actions.setPadding(0, dp(2), 0, dp(8));
        TextView heading = text(inboxFilterTitle(), 17, COLOR_ON_ATMOSPHERE, Typeface.BOLD);
        actions.addView(heading, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        TextView refresh = forwardingChip("Refresh");
        refresh.setOnClickListener(view -> loadData());
        actions.addView(refresh);
        return actions;
    }

    private String inboxFilterTitle() {
        if ("Topics".equals(inboxFilter)) {
            return "Topic review";
        }
        if ("Calls".equals(inboxFilter)) {
            return "Calls to organize";
        }
        if ("Calendar".equals(inboxFilter)) {
            return "Calendar activity";
        }
        return "Needs review";
    }

    private void renderInboxContent() {
        if ("Topics".equals(inboxFilter)) {
            renderInboxReview(true);
            return;
        }
        if ("Calls".equals(inboxFilter)) {
            renderInboxCalls(true);
            return;
        }
        if ("Calendar".equals(inboxFilter)) {
            renderInboxCalendar(true);
            return;
        }

        int rendered = 0;
        rendered += renderInboxReview(false);
        rendered += renderInboxCommunicationsToReview(false);
        rendered += renderInboxCalendar(false);
        if (rendered == 0) {
            addEmptyState("Nothing to review", "Handled calls stay on Home. Items appear here when the assistant needs topic cleanup, action review, or calendar attention.");
        }
    }

    private int renderInboxReview(boolean showEmpty) {
        int added = 0;
        if (!topicSuggestions.isEmpty()) {
            content.addView(sectionHeader("Topic review"));
            for (TopicSuggestion suggestion : topicSuggestions) {
                content.addView(topicSuggestionCard(suggestion));
                added += 1;
            }
        }
        if (added == 0 && showEmpty) {
            content.addView(quietPanel("No review items", "The assistant will ask for review when it is not confident about a topic, decision, or calendar action."));
        }
        return added;
    }

    private int renderInboxCommunicationsToReview(boolean showEmpty) {
        int added = 0;
        for (CommunicationItem item : communicationItems) {
            if (!needsCommunicationReview(item)) {
                continue;
            }
            if (added == 0 && "All".equals(inboxFilter)) {
                content.addView(sectionHeader("Calls to organize"));
            }
            content.addView(communicationItemRow(item));
            added += 1;
        }
        if (added == 0 && !calls.isEmpty()) {
            if ("All".equals(inboxFilter)) {
                content.addView(sectionHeader("Calls to organize"));
            }
            for (CallRecord call : calls) {
                content.addView(callCard(call));
                added += 1;
            }
        }
        if (added == 0 && showEmpty) {
            content.addView(quietPanel("No calls to organize", "Calls appear here when they need topic assignment, follow-up cleanup, or user review."));
        }
        return added;
    }

    private int renderInboxCalls(boolean showEmpty) {
        int added = 0;
        for (CommunicationItem item : communicationItems) {
            if (!isCallCommunication(item)) {
                continue;
            }
            if (added == 0 && !"Calls".equals(inboxFilter)) {
                content.addView(sectionHeader("Calls to organize"));
            }
            content.addView(communicationItemRow(item));
            added += 1;
        }
        if (added == 0 && !calls.isEmpty()) {
            content.addView(sectionHeader("Handled calls"));
            for (CallRecord call : calls) {
                content.addView(callCard(call));
                added += 1;
            }
        }
        if (added == 0 && showEmpty) {
            content.addView(quietPanel("No calls to organize", "Handled calls stay on Home unless they need review or topic cleanup."));
        }
        return added;
    }

    private boolean needsCommunicationReview(CommunicationItem item) {
        return item.topicAssociations.isEmpty() || isCallCommunication(item);
    }

    private boolean isCallCommunication(CommunicationItem item) {
        String channel = item.channel == null ? "" : item.channel.toLowerCase(Locale.US);
        return channel.contains("call") || channel.contains("phone") || channel.contains("voice");
    }

    private int renderInboxCalendar(boolean showEmpty) {
        int added = 0;
        for (CalendarEventRequest request : calendarEventRequests) {
            if (added == 0) {
                content.addView(sectionHeader("Calendar activity"));
            }
            content.addView(calendarEventCard(request));
            added += 1;
        }
        if (added == 0 && showEmpty) {
            content.addView(quietPanel("No calendar changes yet", "Calendar events created or updated by the assistant will appear here."));
        }
        return added;
    }

    private View topicSuggestionCard(TopicSuggestion suggestion) {
        LinearLayout card = panel();
        CommunicationItem item = findCommunication(suggestion.communicationItemId);
        TopicThread topic = suggestion.suggestedTopicThreadId.length() > 0 ? findTopic(suggestion.suggestedTopicThreadId) : null;

        String title = suggestion.displayTitle(topic);
        card.addView(text(title, 17, COLOR_INK, Typeface.BOLD));
        card.addView(label(Math.round(suggestion.confidence * 100) + "% confidence"));
        if (suggestion.reason.length() > 0) {
            card.addView(body(suggestion.reason));
        }
        if (item != null) {
            card.addView(sectionLine("Communication", item.displayTitle() + ": " + item.previewText()));
        }

        LinearLayout actions = row();
        Button accept = smallButton("Accept");
        accept.setOnClickListener(view -> decideTopicSuggestion(suggestion.id, true));
        Button dismiss = smallButton("Dismiss");
        dismiss.setOnClickListener(view -> decideTopicSuggestion(suggestion.id, false));
        actions.addView(accept, gridCellParams(40, true, false));
        actions.addView(dismiss, gridCellParams(40, false, false));
        card.addView(actions);
        return card;
    }

    private View communicationItemCard(CommunicationItem item) {
        LinearLayout card = panel();
        card.setOnClickListener(view -> showCommunicationItemDetail(item));
        LinearLayout top = row();
        TextView title = text(item.displayTitle(), 18, COLOR_INK, Typeface.BOLD);
        top.addView(title, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        TextView channel = text(item.channelLabel(), 12, Color.WHITE, Typeface.BOLD);
        channel.setGravity(Gravity.CENTER);
        channel.setPadding(dp(10), dp(5), dp(10), dp(5));
        channel.setBackground(makeRounded(COLOR_BLUE, 999));
        top.addView(channel);
        card.addView(top);

        card.addView(label(item.formattedTime()));
        card.addView(body(item.previewText()));
        if (!item.topicAssociations.isEmpty()) {
            card.addView(label("Topics"));
            for (TopicAssociation association : item.topicAssociations) {
                card.addView(body(association.topicThreadId + " / " + association.mode));
            }
        }

        LinearLayout actions = row();
        Button attach = smallButton("Attach");
        attach.setOnClickListener(view -> showTopicPicker(item));
        actions.addView(attach, new LinearLayout.LayoutParams(0, dp(40), 1));
        card.addView(actions);
        return card;
    }

    private View communicationItemRow(CommunicationItem item) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(12), dp(9), dp(10), dp(9));
        card.setBackground(makeRoundedStroke(COLOR_CARD, COLOR_LINE, 14));
        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        cardParams.setMargins(0, 0, 0, dp(8));
        card.setLayoutParams(cardParams);
        card.setOnClickListener(view -> showCommunicationItemDetail(item));

        LinearLayout textColumn = new LinearLayout(this);
        textColumn.setOrientation(LinearLayout.VERTICAL);
        textColumn.addView(text(item.displayTitle(), 17, COLOR_INK, Typeface.BOLD));
        textColumn.addView(text(item.secondaryLine(), 13, COLOR_MUTED, Typeface.NORMAL));
        textColumn.addView(text(item.compactTime(), 12, COLOR_TERTIARY, Typeface.BOLD));
        card.addView(textColumn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.CENTER_VERTICAL);

        String callbackTarget = item.bestContactTarget();
        ImageView callBack = iconAction(R.drawable.ic_action_call, "Call back");
        callBack.setAlpha(callbackTarget.length() > 0 ? 1f : 0.35f);
        callBack.setEnabled(callbackTarget.length() > 0);
        if (callbackTarget.length() > 0) {
            callBack.setOnClickListener(view -> dial(callbackTarget));
        }
        ImageView details = iconAction(R.drawable.ic_action_info, "Communication details");
        details.setOnClickListener(view -> showCommunicationItemDetail(item));
        ImageView attach = iconAction(R.drawable.ic_action_note, "Attach to topic");
        attach.setOnClickListener(view -> showTopicPicker(item));
        actions.addView(callBack, new LinearLayout.LayoutParams(dp(40), dp(40)));
        actions.addView(details, new LinearLayout.LayoutParams(dp(40), dp(40)));
        actions.addView(attach, new LinearLayout.LayoutParams(dp(40), dp(40)));
        card.addView(actions);

        return card;
    }

    private void showCommunicationItemDetail(CommunicationItem item) {
        bottomNav.setVisibility(View.GONE);
        setScreenTitle("Review detail");
        content.removeAllViews();

        Button back = secondaryButton("Back");
        back.setOnClickListener(view -> {
            bottomNav.setVisibility(View.VISIBLE);
            activeTab = "inbox";
            renderTabs();
            showInbox();
        });
        LinearLayout.LayoutParams backParams = new LinearLayout.LayoutParams(dp(96), dp(44));
        backParams.setMargins(0, 0, 0, dp(14));
        content.addView(back, backParams);

        LinearLayout summary = panel();
        summary.addView(label(item.channelLabel() + " / " + item.formattedTime()));
        summary.addView(text(item.displayTitle(), 24, COLOR_INK, Typeface.BOLD));
        summary.addView(body(item.previewText()));
        if (item.senderPhone.length() > 0) {
            summary.addView(sectionLine("Phone", item.senderPhone));
        }
        if (!item.topicAssociations.isEmpty()) {
            summary.addView(sectionHeader("Topics"));
            for (TopicAssociation association : item.topicAssociations) {
                summary.addView(body(association.topicThreadId + " / " + association.mode));
            }
        }
        LinearLayout actions = row();
        Button attach = primaryButton("Attach to topic");
        attach.setOnClickListener(view -> {
            bottomNav.setVisibility(View.VISIBLE);
            showTopicPicker(item);
        });
        actions.addView(attach, new LinearLayout.LayoutParams(0, dp(48), 1));
        summary.addView(actions);
        content.addView(summary);

        if (item.transcriptText.length() > 0) {
            LinearLayout transcript = panel();
            transcript.addView(text("Transcript", 18, COLOR_INK, Typeface.BOLD));
            transcript.addView(body(item.transcriptText));
            content.addView(transcript);
        }
    }

    private void showTopicPicker(CommunicationItem item) {
        content.removeAllViews();
        Button back = smallButton("Back");
        back.setOnClickListener(view -> showInbox());
        content.addView(back, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(40)));
        content.addView(titleBlock("Attach to topic", item.previewText()));

        if (topicThreads.isEmpty()) {
            addEmptyState("No topics yet", "Create a topic first, then attach this communication.");
            Button create = smallButton("Create topic");
            create.setOnClickListener(view -> {
                activeTab = "threads";
                renderTabs();
                showThreads();
            });
            content.addView(create, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(42)));
            return;
        }

        for (TopicThread topic : topicThreads) {
            LinearLayout card = panel();
            card.addView(text(topic.title, 18, COLOR_INK, Typeface.BOLD));
            card.addView(body(topic.subtitle()));
            Button attach = smallButton("Attach here");
            attach.setOnClickListener(view -> attachCommunicationToTopic(item.id, topic.id));
            card.addView(attach, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(42)));
            content.addView(card);
        }
    }

    private void showThreads() {
        setScreenTitle("Topics");
        content.removeAllViews();

        LinearLayout introRow = row();
        TextView intro = text("Real-world situations your assistant is tracking.", 15, COLOR_ON_ATMOSPHERE_MUTED, Typeface.NORMAL);
        intro.setLineSpacing(dp(2), 1.0f);
        introRow.addView(intro, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        TextView createChip = forwardingChip("New");
        createChip.setOnClickListener(view -> showCreateTopicForm());
        LinearLayout.LayoutParams createChipParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        createChipParams.setMargins(dp(12), 0, 0, 0);
        introRow.addView(createChip, createChipParams);
        content.addView(introRow);

        if (!topicThreads.isEmpty()) {
            content.addView(sectionHeader("Active topics"));
            for (TopicThread topic : topicThreads) {
                content.addView(topicCard(topic));
            }
        } else {
            addEmptyState("No topics yet", "Create one for a real situation like Basement Project, Kids Sports, Medical Appointments, or Car Lease.");
            content.addView(createTopicActionPanel());
        }
    }

    private View topicCard(TopicThread topic) {
        FrameLayout card = new FrameLayout(this);
        card.setBackground(makeRounded(COLOR_CARD, 18));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            card.setClipToOutline(true);
            card.setElevation(dp(1));
        }

        ImageView image = new ImageView(this);
        image.setScaleType(ImageView.ScaleType.CENTER_CROP);
        image.setImageResource(topicImageResource(topic));
        card.addView(image, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        LinearLayout overlay = new LinearLayout(this);
        overlay.setOrientation(LinearLayout.VERTICAL);
        overlay.setPadding(dp(16), dp(12), dp(16), dp(14));
        overlay.setBackgroundColor(Color.argb(134, 14, 9, 34));

        TextView title = text(topic.title, 18, Color.WHITE, Typeface.BOLD);
        title.setMaxLines(2);
        title.setEllipsize(TextUtils.TruncateAt.END);
        title.setLineSpacing(dp(1), 1.0f);
        overlay.addView(title);

        TextView meta = text(compactTopicMeta(topic), 10, Color.argb(225, 255, 255, 255), Typeface.BOLD);
        meta.setMaxLines(1);
        meta.setEllipsize(TextUtils.TruncateAt.END);
        meta.setPadding(0, dp(4), 0, dp(4));
        overlay.addView(meta);

        TextView detail = text(topicCardDetail(topic), 12, Color.argb(236, 255, 255, 255), Typeface.NORMAL);
        detail.setMaxLines(2);
        detail.setEllipsize(TextUtils.TruncateAt.END);
        detail.setLineSpacing(dp(2), 1.0f);
        overlay.addView(detail);

        FrameLayout.LayoutParams overlayParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM
        );
        card.addView(overlay, overlayParams);
        card.setOnClickListener(view -> showTopicDetail(topic.id));

        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(44));
        params.setMargins(0, 0, 0, dp(12));
        params.height = dp(188);
        card.setLayoutParams(params);
        return card;
    }

    private String topicCardDetail(TopicThread topic) {
        String detail = topic.latestStructuredState().length() > 0
                ? topic.latestStructuredState()
                : topic.description.length() > 0
                ? topic.description
                : "No structured state yet.";
        if (detail.length() > 96) {
            return detail.substring(0, 93) + "...";
        }
        return detail;
    }

    private String compactTopicMeta(TopicThread topic) {
        return topic.status
                + " / " + topic.communicationItemIds.size() + " comm"
                + " / " + topic.decisions.size() + " decisions";
    }

    private View createTopicActionPanel() {
        LinearLayout action = compactPanel(14, 16);
        action.addView(text("Create a topic", 18, COLOR_INK, Typeface.BOLD));
        action.addView(body("Start tracking a project, appointment, trip, vendor, or decision."));
        Button create = primaryButton("Create topic");
        create.setOnClickListener(view -> showCreateTopicForm());
        LinearLayout.LayoutParams createParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(48));
        createParams.setMargins(0, dp(10), 0, 0);
        action.addView(create, createParams);
        return action;
    }

    private void showCreateTopicForm() {
        setScreenTitle("New topic");
        content.removeAllViews();

        Button back = smallButton("Back");
        back.setOnClickListener(view -> showThreads());
        content.addView(back, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(40)));

        LinearLayout form = panel();
        form.addView(text("Create topic", 20, COLOR_INK, Typeface.BOLD));
        form.addView(body("Start a topic for a project, family situation, appointment, trip, vendor, or decision."));
        EditText titleInput = input("Topic title");
        form.addView(titleInput);
        EditText descriptionInput = input("Description, optional");
        descriptionInput.setMinLines(2);
        descriptionInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        form.addView(descriptionInput);
        Button create = primaryButton("Create topic");
        create.setOnClickListener(view -> createTopic(titleInput.getText().toString(), descriptionInput.getText().toString()));
        LinearLayout.LayoutParams createParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50));
        createParams.setMargins(0, dp(8), 0, 0);
        form.addView(create, createParams);
        content.addView(form);
    }

    private void showTopicDetail(String topicId) {
        TopicThread topic = findTopic(topicId);
        if (topic == null) {
            Toast.makeText(this, "Topic not found", Toast.LENGTH_SHORT).show();
            showThreads();
            return;
        }

        setScreenTitle("Topic");
        content.removeAllViews();

        content.addView(topicDetailHero(topic));
        content.addView(topicBriefPanel(topic));

        content.addView(sectionHeader("Needs attention"));
        if (topic.decisions.isEmpty() && topic.openQuestions.isEmpty() && topic.tasks.isEmpty()) {
            content.addView(topicDetailEmptyPanel("No open items", "Decisions, questions, tasks, and conflicts will appear here when extracted or created."));
        }

        addTopicStateSection("Decisions", "No decisions recorded yet.", "Decision", topic.decisions);
        addTopicStateSection("Open questions", "No open questions recorded yet.", "Question", topic.openQuestions);
        addTopicStateSection("Tasks", "No tasks recorded yet.", "Task", topic.tasks);

        content.addView(sectionHeader("Timeline"));
        if (topic.communicationItemIds.isEmpty()) {
            content.addView(topicDetailEmptyPanel("No communications yet", "Calls, notes, calendar events, and documents will appear here when attached."));
        } else {
            for (String communicationItemId : topic.communicationItemIds) {
                CommunicationItem item = findCommunication(communicationItemId);
                content.addView(topicTimelineRow(item, communicationItemId));
            }
        }
    }

    private View topicDetailHero(TopicThread topic) {
        FrameLayout hero = new FrameLayout(this);
        hero.setBackground(makeRounded(COLOR_CARD, 18));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            hero.setClipToOutline(true);
            hero.setElevation(dp(1));
        }

        ImageView image = new ImageView(this);
        image.setScaleType(ImageView.ScaleType.CENTER_CROP);
        image.setImageResource(topicImageResource(topic));
        hero.addView(image, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        LinearLayout overlay = new LinearLayout(this);
        overlay.setOrientation(LinearLayout.VERTICAL);
        overlay.setPadding(dp(16), dp(14), dp(16), dp(14));
        overlay.setBackgroundColor(Color.argb(136, 14, 9, 34));

        TextView back = forwardingChip("Back");
        back.setOnClickListener(view -> showThreads());
        LinearLayout.LayoutParams backParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        backParams.setMargins(0, 0, 0, dp(22));
        overlay.addView(back, backParams);

        TextView title = text(topic.title, 22, Color.WHITE, Typeface.BOLD);
        title.setMaxLines(3);
        title.setEllipsize(TextUtils.TruncateAt.END);
        title.setLineSpacing(dp(1), 1.0f);
        overlay.addView(title);

        TextView meta = text(compactTopicMeta(topic), 11, Color.argb(225, 255, 255, 255), Typeface.BOLD);
        meta.setMaxLines(1);
        meta.setEllipsize(TextUtils.TruncateAt.END);
        meta.setPadding(0, dp(5), 0, dp(4));
        overlay.addView(meta);

        String detailText = topic.description.length() > 0 ? topic.description : topicCardDetail(topic);
        TextView detail = text(detailText, 13, Color.argb(236, 255, 255, 255), Typeface.NORMAL);
        detail.setMaxLines(3);
        detail.setEllipsize(TextUtils.TruncateAt.END);
        detail.setLineSpacing(dp(2), 1.0f);
        overlay.addView(detail);

        hero.addView(overlay, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(238));
        params.setMargins(0, 0, 0, dp(12));
        hero.setLayoutParams(params);
        return hero;
    }

    private View topicBriefPanel(TopicThread topic) {
        LinearLayout brief = compactPanel(14, 16);
        brief.addView(text("Current brief", 17, COLOR_INK, Typeface.BOLD));
        TextView summary = text(topic.latestStructuredState().length() > 0 ? topic.latestStructuredState() : "No structured state yet. The assistant will build a brief as related communications are attached.", 14, COLOR_MUTED, Typeface.NORMAL);
        summary.setLineSpacing(dp(3), 1.0f);
        summary.setPadding(0, dp(6), 0, 0);
        brief.addView(summary);
        return brief;
    }

    private void addTopicStateSection(String title, String emptyText, String itemType, List<String> values) {
        content.addView(sectionHeader(title));
        if (values.isEmpty()) {
            content.addView(topicDetailEmptyText(emptyText));
            return;
        }
        for (String value : values) {
            content.addView(stateCard(itemType, value));
        }
    }

    private View topicDetailEmptyPanel(String title, String message) {
        LinearLayout panel = compactPanel(13, 14);
        panel.addView(text(title, 16, COLOR_INK, Typeface.BOLD));
        TextView messageView = text(message, 14, COLOR_MUTED, Typeface.NORMAL);
        messageView.setLineSpacing(dp(3), 1.0f);
        messageView.setPadding(0, dp(5), 0, 0);
        panel.addView(messageView);
        return panel;
    }

    private View topicDetailEmptyText(String value) {
        TextView empty = text(value, 14, COLOR_ON_ATMOSPHERE_MUTED, Typeface.NORMAL);
        empty.setPadding(0, 0, 0, dp(10));
        return empty;
    }

    private View topicTimelineRow(CommunicationItem item, String fallbackId) {
        LinearLayout row = compactPanel(12, 14);
        String title = item == null ? fallbackId : item.displayTitle();
        String preview = item == null ? "Communication details are unavailable." : item.previewText();
        row.addView(text(title, 15, COLOR_INK, Typeface.BOLD));
        TextView summary = text(preview, 13, COLOR_MUTED, Typeface.NORMAL);
        summary.setMaxLines(3);
        summary.setLineSpacing(dp(2), 1.0f);
        summary.setPadding(0, dp(4), 0, 0);
        row.addView(summary);
        return row;
    }

    private View stateCard(String type, String value) {
        LinearLayout card = compactPanel(12, 14);
        card.addView(label(type));
        card.addView(text(value, 16, COLOR_INK, Typeface.BOLD));
        return card;
    }

    private void showSearch() {
        setScreenTitle("Search");
        content.removeAllViews();

        EditText query = input("Search people, topics, decisions...");
        query.setSingleLine(true);
        query.setText(searchQuery);
        query.setSelection(query.getText().length());
        content.addView(query);

        LinearLayout results = new LinearLayout(this);
        results.setOrientation(LinearLayout.VERTICAL);
        content.addView(results);
        renderSearchResults(results);

        query.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
            }

            @Override
            public void afterTextChanged(Editable s) {
                searchQuery = s == null ? "" : s.toString();
                renderSearchResults(results);
            }
        });
    }

    private View searchFilterRow() {
        LinearLayout filters = new LinearLayout(this);
        filters.setOrientation(LinearLayout.HORIZONTAL);
        filters.setPadding(0, 0, 0, dp(12));
        String[] labels = new String[]{"All", "Topics", "People", "Calls"};
        for (String label : labels) {
            boolean selected = label.equals(searchFilter);
            TextView chip = text(label, 13, selected ? Color.WHITE : COLOR_MUTED, Typeface.BOLD);
            chip.setGravity(Gravity.CENTER);
            chip.setPadding(dp(10), 0, dp(10), 0);
            chip.setBackground(selected ? makeRounded(COLOR_BLUE, 999) : makeRoundedStroke(COLOR_CARD, COLOR_LINE, 999));
            chip.setOnClickListener(view -> {
                searchFilter = label;
                showSearch();
            });
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(32));
            params.setMargins(0, 0, dp(8), 0);
            filters.addView(chip, params);
        }
        return filters;
    }

    private void renderSearchResults(LinearLayout results) {
        results.removeAllViews();
        String query = searchQuery == null ? "" : searchQuery.trim();
        if (query.length() == 0 && "All".equals(searchFilter)) {
            results.addView(searchEmptyState());
            return;
        }
        results.addView(searchFilterRow());

        if ("Topics".equals(searchFilter)) {
            renderSearchThreads(results, Integer.MAX_VALUE, true);
            return;
        }
        if ("People".equals(searchFilter)) {
            renderSearchPeople(results, Integer.MAX_VALUE, true);
            return;
        }
        if ("Calls".equals(searchFilter)) {
            renderSearchCalls(results, Integer.MAX_VALUE, true);
            return;
        }

        int rendered = renderSearchBestMatches(results, 6);
        if (rendered == 0) {
            results.addView(quietPanel("No results", "Try another name, topic, caller, or decision."));
        }
    }

    private View searchEmptyState() {
        LinearLayout wrapper = new LinearLayout(this);
        wrapper.setOrientation(LinearLayout.VERTICAL);
        wrapper.setPadding(0, dp(10), 0, 0);

        TextView title = text("Search your memory", 18, COLOR_ON_ATMOSPHERE, Typeface.BOLD);
        wrapper.addView(title);
        TextView message = text("Find people, topics, calls, and details the assistant has captured.", 14, COLOR_ON_ATMOSPHERE_MUTED, Typeface.NORMAL);
        message.setLineSpacing(dp(3), 1.0f);
        message.setPadding(0, dp(6), 0, 0);
        wrapper.addView(message);

        LinearLayout chips = new LinearLayout(this);
        chips.setOrientation(LinearLayout.HORIZONTAL);
        chips.setPadding(0, dp(14), 0, 0);
        chips.addView(searchQuickChip("Topics", "Topics"), quickChipParams(true));
        chips.addView(searchQuickChip("People", "People"), quickChipParams(true));
        chips.addView(searchQuickChip("Calls", "Calls"), quickChipParams(false));
        wrapper.addView(chips);
        return wrapper;
    }

    private View searchQuickChip(String label, String filter) {
        TextView chip = text(label, 12, COLOR_ON_ATMOSPHERE, Typeface.BOLD);
        chip.setGravity(Gravity.CENTER);
        chip.setPadding(dp(10), 0, dp(10), 0);
        chip.setBackground(makeRoundedStroke(Color.argb(28, 255, 255, 255), Color.argb(46, 255, 255, 255), 999));
        chip.setOnClickListener(view -> {
            searchFilter = filter;
            searchQuery = "";
            showSearch();
        });
        return chip;
    }

    private LinearLayout.LayoutParams quickChipParams(boolean rightGutter) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(32));
        params.setMargins(0, 0, rightGutter ? dp(8) : 0, 0);
        return params;
    }

    private void selectSearchFilter(String filter) {
        searchFilter = filter;
        showSearch();
    }

    private int renderSearchBestMatches(LinearLayout target, int max) {
        int added = 0;
        boolean headerAdded = false;
        for (TopicThread topic : topicThreads) {
            if (added >= max) {
                return added;
            }
            if (!matchesSearch(topic.title, topic.description, topic.status, topic.latestStructuredState())) {
                continue;
            }
            if (!headerAdded) {
                target.addView(sectionHeader("Results"));
                headerAdded = true;
            }
            target.addView(topicSearchRow(topic));
            added += 1;
        }
        for (CallerProfile profile : callerProfiles) {
            if (added >= max) {
                return added;
            }
            if (!matchesSearch(profile.displayName, profile.primaryPhoneNumber, profile.organization, profile.relationship, profile.lastIntent, profile.lastCallSummary)) {
                continue;
            }
            if (!headerAdded) {
                target.addView(sectionHeader("Results"));
                headerAdded = true;
            }
            target.addView(personSearchRow(profile));
            added += 1;
        }
        for (CallRecord call : calls) {
            if (added >= max) {
                return added;
            }
            if (!matchesSearch(call.displayCaller(), call.fromNumber, call.intent, call.summary, call.followUp, call.urgency)) {
                continue;
            }
            if (!headerAdded) {
                target.addView(sectionHeader("Results"));
                headerAdded = true;
            }
            target.addView(callSearchRow(call));
            added += 1;
        }
        for (CommunicationItem item : communicationItems) {
            if (added >= max) {
                return added;
            }
            if (!matchesSearch(item.displayTitle(), item.senderName, item.senderPhone, item.summary, item.bodyText, item.transcriptText)) {
                continue;
            }
            if (!headerAdded) {
                target.addView(sectionHeader("Results"));
                headerAdded = true;
            }
            target.addView(communicationSearchRow(item));
            added += 1;
        }
        return added;
    }

    private int renderSearchThreads(LinearLayout target, int max, boolean showEmpty) {
        int added = 0;
        for (TopicThread topic : topicThreads) {
            if (added >= max) {
                break;
            }
            if (!matchesSearch(topic.title, topic.description, topic.status, topic.latestStructuredState())) {
                continue;
            }
            if (added == 0) {
                target.addView(sectionHeader("Topics"));
            }
            target.addView(topicSearchRow(topic));
            added += 1;
        }
        if (added == 0 && showEmpty) {
            target.addView(quietPanel("No topic results", "Create or accept a topic and it will become searchable here."));
        }
        return added;
    }

    private int renderSearchPeople(LinearLayout target, int max, boolean showEmpty) {
        int added = 0;
        for (CallerProfile profile : callerProfiles) {
            if (added >= max) {
                break;
            }
            if (!matchesSearch(profile.displayName, profile.primaryPhoneNumber, profile.organization, profile.relationship, profile.lastIntent, profile.lastCallSummary)) {
                continue;
            }
            if (added == 0) {
                target.addView(sectionHeader("People"));
            }
            target.addView(personSearchRow(profile));
            added += 1;
        }
        if (added == 0 && showEmpty) {
            target.addView(quietPanel("No people results", "Repeat callers and synced contacts will appear here."));
        }
        return added;
    }

    private int renderSearchCalls(LinearLayout target, int max, boolean showEmpty) {
        int added = 0;
        for (CallRecord call : calls) {
            if (added >= max) {
                break;
            }
            if (!matchesSearch(call.displayCaller(), call.fromNumber, call.intent, call.summary, call.followUp, call.urgency)) {
                continue;
            }
            if (added == 0) {
                target.addView(sectionHeader("Calls"));
            }
            target.addView(callSearchRow(call));
            added += 1;
        }
        if (added == 0 && showEmpty) {
            target.addView(quietPanel("No call results", "Handled calls will appear here after your assistant answers."));
        }
        return added;
    }

    private int renderSearchCommunications(LinearLayout target, int max) {
        int added = 0;
        for (CommunicationItem item : communicationItems) {
            if (added >= max) {
                break;
            }
            if (!matchesSearch(item.displayTitle(), item.senderName, item.senderPhone, item.summary, item.bodyText, item.transcriptText)) {
                continue;
            }
            if (added == 0) {
                target.addView(sectionHeader("Communications"));
            }
            target.addView(communicationSearchRow(item));
            added += 1;
        }
        return added;
    }

    private View topicSearchRow(TopicThread topic) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(14), dp(12), dp(12), dp(12));
        card.setBackground(makeRoundedStroke(COLOR_CARD, COLOR_LINE, 14));
        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        cardParams.setMargins(0, 0, 0, dp(10));
        card.setLayoutParams(cardParams);
        card.setOnClickListener(view -> showTopicDetail(topic.id));

        LinearLayout textColumn = new LinearLayout(this);
        textColumn.setOrientation(LinearLayout.VERTICAL);
        TextView title = text(topic.title, 15, COLOR_INK, Typeface.BOLD);
        title.setMaxLines(2);
        textColumn.addView(title);
        textColumn.addView(text(topic.status + " / " + topic.communicationItemIds.size() + " communications", 12, COLOR_MUTED, Typeface.NORMAL));
        String state = topic.latestStructuredState();
        if (state.length() > 0) {
            textColumn.addView(text(shortText(state, 72), 12, COLOR_TERTIARY, Typeface.BOLD));
        }
        card.addView(textColumn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        ImageView details = iconAction(R.drawable.ic_action_info, "Topic details");
        details.setOnClickListener(view -> showTopicDetail(topic.id));
        card.addView(details, new LinearLayout.LayoutParams(dp(36), dp(36)));
        return card;
    }

    private View personSearchRow(CallerProfile profile) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(12), dp(9), dp(10), dp(9));
        card.setBackground(makeRoundedStroke(COLOR_CARD, COLOR_LINE, 14));
        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        cardParams.setMargins(0, 0, 0, dp(8));
        card.setLayoutParams(cardParams);

        LinearLayout textColumn = new LinearLayout(this);
        textColumn.setOrientation(LinearLayout.VERTICAL);
        textColumn.addView(text(profile.displayName.length() > 0 ? profile.displayName : profile.primaryPhoneNumber, 15, COLOR_INK, Typeface.BOLD));
        textColumn.addView(text(profile.primaryPhoneNumber.length() > 0 ? profile.primaryPhoneNumber : profile.relationshipLabel(), 12, COLOR_MUTED, Typeface.NORMAL));
        textColumn.addView(text(profile.relationshipLabel() + " / " + profile.callCount + " calls", 12, COLOR_TERTIARY, Typeface.BOLD));
        card.addView(textColumn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        ImageView details = iconAction(R.drawable.ic_action_info, "People memory");
        details.setOnClickListener(view -> showPeople());
        card.addView(details, new LinearLayout.LayoutParams(dp(36), dp(36)));
        return card;
    }

    private View callSearchRow(CallRecord call) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(12), dp(9), dp(10), dp(9));
        card.setBackground(makeRoundedStroke(COLOR_CARD, COLOR_LINE, 14));
        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        cardParams.setMargins(0, 0, 0, dp(8));
        card.setLayoutParams(cardParams);
        card.setOnClickListener(view -> showCallDetail(call));

        LinearLayout textColumn = new LinearLayout(this);
        textColumn.setOrientation(LinearLayout.VERTICAL);
        textColumn.addView(text(call.displayCaller(), 15, COLOR_INK, Typeface.BOLD));
        textColumn.addView(text(call.fromNumber.length() > 0 ? call.fromNumber : "Unknown number", 12, COLOR_MUTED, Typeface.NORMAL));
        textColumn.addView(text(call.compactDate(), 12, COLOR_TERTIARY, Typeface.BOLD));
        card.addView(textColumn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        ImageView details = iconAction(R.drawable.ic_action_info, "Call details");
        details.setOnClickListener(view -> showCallDetail(call));
        card.addView(details, new LinearLayout.LayoutParams(dp(36), dp(36)));
        return card;
    }

    private View communicationSearchRow(CommunicationItem item) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(12), dp(9), dp(10), dp(9));
        card.setBackground(makeRoundedStroke(COLOR_CARD, COLOR_LINE, 14));
        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        cardParams.setMargins(0, 0, 0, dp(8));
        card.setLayoutParams(cardParams);
        card.setOnClickListener(view -> showCommunicationItemDetail(item));

        LinearLayout textColumn = new LinearLayout(this);
        textColumn.setOrientation(LinearLayout.VERTICAL);
        textColumn.addView(text(item.displayTitle(), 15, COLOR_INK, Typeface.BOLD));
        textColumn.addView(text(item.secondaryLine(), 12, COLOR_MUTED, Typeface.NORMAL));
        textColumn.addView(text(item.compactTime(), 12, COLOR_TERTIARY, Typeface.BOLD));
        card.addView(textColumn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        ImageView details = iconAction(R.drawable.ic_action_info, "Communication details");
        details.setOnClickListener(view -> showCommunicationItemDetail(item));
        card.addView(details, new LinearLayout.LayoutParams(dp(36), dp(36)));
        return card;
    }

    private String shortText(String value, int maxLength) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.length() <= maxLength) {
            return trimmed;
        }
        return trimmed.substring(0, Math.max(0, maxLength - 3)) + "...";
    }

    private boolean matchesSearch(String... values) {
        String query = searchQuery == null ? "" : searchQuery.trim().toLowerCase(Locale.US);
        if (query.length() == 0) {
            return true;
        }
        for (String value : values) {
            if (value != null && value.toLowerCase(Locale.US).contains(query)) {
                return true;
            }
        }
        return false;
    }

    private View searchSuggestion(String title, String subtitle, Runnable action) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(0, dp(12), 0, dp(12));
        row.setOnClickListener(view -> action.run());
        LinearLayout textColumn = new LinearLayout(this);
        textColumn.setOrientation(LinearLayout.VERTICAL);
        textColumn.addView(text(title, 16, COLOR_INK, Typeface.BOLD));
        textColumn.addView(body(subtitle));
        row.addView(textColumn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        TextView type = text("Open", 13, COLOR_BLUE, Typeface.BOLD);
        type.setGravity(Gravity.CENTER);
        type.setPadding(dp(12), dp(8), dp(12), dp(8));
        type.setBackground(makeRoundedStroke(COLOR_CARD, COLOR_LINE, 8));
        type.setOnClickListener(view -> action.run());
        row.addView(type);
        return row;
    }

    private void showCalls() {
        setScreenTitle("Calls");
        content.removeAllViews();
        LinearLayout actions = row();
        TextView heading = text("Call history", 21, COLOR_INK, Typeface.BOLD);
        actions.addView(heading, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        Button refresh = smallButton("Refresh");
        refresh.setOnClickListener(view -> loadData());
        actions.addView(refresh);
        content.addView(actions);

        if (calls.isEmpty()) {
            addEmptyState("No calls yet", "Call " + BuildConfig.PHONE_AGENT_NUMBER_DISPLAY + " to create the first record.");
            return;
        }

        for (CallRecord call : calls) {
            content.addView(callCard(call));
        }
    }

    private void showApprovals() {
        showApprovals("");
    }

    private void showApprovals(String expectedApprovalId) {
        setScreenTitle("Assistant");
        content.removeAllViews();
        LinearLayout actions = row();
        TextView heading = text("Live approvals", 21, COLOR_INK, Typeface.BOLD);
        actions.addView(heading, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        Button refresh = smallButton("Refresh");
        refresh.setOnClickListener(view -> loadData());
        actions.addView(refresh);
        content.addView(actions);

        if (approvalRequests.isEmpty()) {
            if (expectedApprovalId != null && expectedApprovalId.length() > 0) {
                showExpiredRequestState("transfer");
            } else {
                addEmptyState("No pending transfers", "When the agent thinks you should take a call, it will appear here.");
            }
            return;
        }

        boolean found = expectedApprovalId == null || expectedApprovalId.length() == 0;
        for (ApprovalRequest approvalRequest : approvalRequests) {
            if (approvalRequest.id.equals(expectedApprovalId)) {
                found = true;
            }
            content.addView(approvalCard(approvalRequest));
        }
        if (!found) {
            content.addView(quietPanel("Request expired", "The assistant no longer needs this transfer decision."));
        }
    }

    private void showAnswers() {
        showAnswers("");
    }

    private void showAnswers(String expectedAnswerId) {
        setScreenTitle("Assistant");
        content.removeAllViews();
        LinearLayout actions = row();
        TextView heading = text("Live answers", 21, COLOR_INK, Typeface.BOLD);
        actions.addView(heading, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        Button refresh = smallButton("Refresh");
        refresh.setOnClickListener(view -> loadData());
        actions.addView(refresh);
        content.addView(actions);

        if (answerRequests.isEmpty()) {
            if (expectedAnswerId != null && expectedAnswerId.length() > 0) {
                showExpiredRequestState("answer");
            } else {
                addEmptyState("No pending questions", "When the agent needs a quick answer during a call, it will appear here.");
            }
            return;
        }

        boolean found = expectedAnswerId == null || expectedAnswerId.length() == 0;
        for (AnswerRequest answerRequest : answerRequests) {
            if (answerRequest.id.equals(expectedAnswerId)) {
                found = true;
            }
            content.addView(answerCard(answerRequest));
        }
        if (!found) {
            content.addView(quietPanel("Request expired", "The assistant no longer needs this answer."));
        }
    }

    private void showExpiredRequestState(String kind) {
        addEmptyState("Request expired", "The assistant no longer needs this " + kind + " action.");
        Button back = primaryButton("Back to Assistant");
        back.setOnClickListener(view -> showAssistant());
        content.addView(back, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)));
    }

    private View answerCard(AnswerRequest answerRequest) {
        LinearLayout card = panel();
        card.addView(text(answerRequest.displayCaller(), 18, COLOR_INK, Typeface.BOLD));
        card.addView(label(answerRequest.urgency + " / expires " + answerRequest.formattedExpiry()));
        card.addView(sectionLine("Question", answerRequest.question));
        if (answerRequest.reason.length() > 0) {
            card.addView(sectionLine("Context", answerRequest.reason));
        }

        EditText answerInput = input("Type the answer for the assistant to relay");
        answerInput.setMinLines(2);
        answerInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        card.addView(answerInput);

        LinearLayout actions = row();
        Button send = smallButton("Send answer");
        send.setOnClickListener(view -> replyToAnswerRequest(answerRequest.id, answerInput.getText().toString()));
        Button decline = smallButton("Decline");
        decline.setOnClickListener(view -> declineAnswerRequest(answerRequest.id));
        actions.addView(send, gridCellParams(42, true, false));
        actions.addView(decline, gridCellParams(42, false, false));
        card.addView(actions);
        return card;
    }

    private void showNotes() {
        setScreenTitle("Assistant");
        content.removeAllViews();
        content.addView(titleBlock("Assistant notes", "Give the agent timely context before a call arrives."));

        LinearLayout form = panel();
        EditText targetInput = input("Caller phone, optional");
        targetInput.setInputType(InputType.TYPE_CLASS_PHONE);
        form.addView(targetInput);

        EditText noteInput = input("What should the assistant know or say?");
        noteInput.setMinLines(3);
        noteInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        form.addView(noteInput);

        Button save = smallButton("Save note");
        save.setOnClickListener(view -> createAgentNote(noteInput.getText().toString(), targetInput.getText().toString()));
        form.addView(save, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(42)));
        content.addView(form);

        if (agentNotes.isEmpty()) {
            addEmptyState("No notes yet", "Add a note before an expected call so the assistant can answer with better context.");
            return;
        }

        for (AgentNote note : agentNotes) {
            content.addView(agentNoteCard(note));
        }
    }

    private View agentNoteCard(AgentNote note) {
        LinearLayout card = panel();
        card.addView(text(note.title.length() > 0 ? note.title : "Assistant note", 18, COLOR_INK, Typeface.BOLD));
        card.addView(label(note.status + " / " + note.formattedScope()));
        card.addView(body(note.text));
        if ("active".equals(note.status)) {
            Button archive = smallButton("Archive");
            archive.setOnClickListener(view -> archiveAgentNote(note.id));
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(40));
            params.setMargins(0, dp(10), 0, 0);
            card.addView(archive, params);
        }
        return card;
    }

    private void showCalendar() {
        setScreenTitle("Assistant");
        content.removeAllViews();
        content.addView(titleBlock("Google Calendar", "The assistant can check availability and create or update its own events. You are notified after every change."));

        LinearLayout status = panel();
        status.addView(text(calendarStatus.connected ? "Calendar connected" : "Calendar not connected", 18, COLOR_INK, Typeface.BOLD));
        status.addView(body(calendarStatus.statusText()));
        LinearLayout actions = row();
        Button connect = smallButton(calendarStatus.connected ? "Reconnect" : "Connect");
        connect.setOnClickListener(view -> openCalendarConnectUrl());
        Button refresh = smallButton("Refresh");
        refresh.setOnClickListener(view -> loadData());
        actions.addView(connect, gridCellParams(42, true, false));
        actions.addView(refresh, gridCellParams(42, false, false));
        status.addView(actions);
        content.addView(status);

        content.addView(text("Calendar activity", 21, COLOR_INK, Typeface.BOLD));
        if (calendarEventRequests.isEmpty()) {
            addEmptyState("No calendar changes yet", "Calendar events created or updated by the assistant will appear here.");
            return;
        }

        for (CalendarEventRequest request : calendarEventRequests) {
            content.addView(calendarEventCard(request));
        }
    }

    private View calendarEventCard(CalendarEventRequest request) {
        LinearLayout card = compactPanel(14, 16);
        TextView title = text(request.title, 16, COLOR_INK, Typeface.BOLD);
        title.setMaxLines(2);
        card.addView(title);
        card.addView(label(request.statusLabel() + " / " + request.formattedTime()));
        if (request.callerName.length() > 0 || request.callerNumber.length() > 0) {
            card.addView(compactSectionLine("Caller", request.displayCaller()));
        }
        if (request.reason.length() > 0) {
            card.addView(compactSectionLine("Reason", request.reason));
        }
        if (request.description.length() > 0) {
            card.addView(body(request.description));
        }

        if ("pending".equals(request.status)) {
            LinearLayout actions = row();
            Button accept = smallButton("Create event");
            accept.setOnClickListener(view -> decideCalendarEvent(request.id, true));
            Button decline = smallButton("Decline");
            decline.setOnClickListener(view -> decideCalendarEvent(request.id, false));
            actions.addView(accept, gridCellParams(42, true, false));
            actions.addView(decline, gridCellParams(42, false, false));
            card.addView(actions);
        }
        return card;
    }

    private TextView compactSectionLine(String label, String value) {
        TextView view = text(label + "  " + value, 13, COLOR_MUTED, Typeface.NORMAL);
        view.setMaxLines(3);
        view.setEllipsize(TextUtils.TruncateAt.END);
        view.setPadding(0, dp(5), 0, 0);
        view.setLineSpacing(dp(2), 1.0f);
        return view;
    }

    private View approvalCard(ApprovalRequest approvalRequest) {
        LinearLayout card = panel();
        card.addView(text(approvalRequest.displayCaller(), 18, COLOR_INK, Typeface.BOLD));
        card.addView(label(approvalRequest.urgency + " / expires " + approvalRequest.formattedExpiry()));
        card.addView(body(approvalRequest.reason));

        LinearLayout actions = row();
        Button accept = smallButton("Accept");
        accept.setOnClickListener(view -> decideApproval(approvalRequest.id, true));
        Button decline = smallButton("Decline");
        decline.setOnClickListener(view -> decideApproval(approvalRequest.id, false));
        actions.addView(accept, gridCellParams(42, true, false));
        actions.addView(decline, gridCellParams(42, false, false));
        card.addView(actions);
        return card;
    }

    private void showPeople() {
        setScreenTitle("Assistant");
        content.removeAllViews();
        LinearLayout actions = row();
        TextView heading = text("People memory", 21, COLOR_INK, Typeface.BOLD);
        actions.addView(heading, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        Button refresh = smallButton("Refresh");
        refresh.setOnClickListener(view -> loadData());
        actions.addView(refresh);
        content.addView(actions);

        if (callerProfiles.isEmpty()) {
            addEmptyState("No caller profiles yet", "Repeat callers will appear here after the agent has handled a call.");
            return;
        }

        for (CallerProfile profile : callerProfiles) {
            content.addView(callerProfileCard(profile));
        }
    }

    private View callerProfileCard(CallerProfile profile) {
        LinearLayout card = panel();
        LinearLayout top = row();
        TextView name = text(profile.displayName.length() > 0 ? profile.displayName : profile.primaryPhoneNumber, 18, COLOR_INK, Typeface.BOLD);
        top.addView(name, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        TextView relationship = text(profile.relationshipLabel(), 12, Color.WHITE, Typeface.BOLD);
        relationship.setGravity(Gravity.CENTER);
        relationship.setPadding(dp(10), dp(5), dp(10), dp(5));
        relationship.setBackground(makeRounded(profile.relationshipColor(), 999));
        top.addView(relationship);
        card.addView(top);

        card.addView(label(profile.callCount + " calls / " + profile.trustLevel));
        if (profile.organization.length() > 0) {
            card.addView(sectionLine("Organization", profile.organization));
        }
        if (profile.lastIntent.length() > 0) {
            card.addView(sectionLine("Last intent", profile.lastIntent));
        }
        if (profile.lastCallSummary.length() > 0) {
            card.addView(sectionLine("Last summary", profile.lastCallSummary));
        }
        if (!profile.memories.isEmpty()) {
            card.addView(label("Remembered"));
            for (String memory : profile.memories) {
                card.addView(body("- " + memory));
            }
        }
        card.addView(relationshipActions(profile));
        return card;
    }

    private View relationshipActions(CallerProfile profile) {
        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.VERTICAL);
        actions.setPadding(0, dp(10), 0, 0);

        LinearLayout firstRow = row();
        firstRow.addView(relationshipButton("Family", profile, "family", "trusted"), gridCellParams(40, true, false));
        firstRow.addView(relationshipButton("Friend", profile, "close_friend", "trusted"), gridCellParams(40, false, false));
        actions.addView(firstRow);

        LinearLayout secondRow = row();
        secondRow.setPadding(0, dp(6), 0, 0);
        secondRow.addView(relationshipButton("Vendor", profile, "vendor", "standard"), gridCellParams(40, true, false));
        secondRow.addView(relationshipButton("Spam", profile, "spam", "low"), gridCellParams(40, false, false));
        actions.addView(secondRow);
        return actions;
    }

    private Button relationshipButton(String label, CallerProfile profile, String relationship, String trustLevel) {
        Button button = smallButton(label);
        button.setOnClickListener(view -> updateCallerRelationship(profile.id, relationship, trustLevel));
        return button;
    }

    private View callCard(CallRecord call) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(14), dp(12), dp(12), dp(12));
        card.setBackground(makeRoundedStroke(COLOR_CARD, COLOR_LINE, 14));
        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        cardParams.setMargins(0, 0, 0, dp(10));
        card.setLayoutParams(cardParams);
        card.setOnClickListener(view -> showCallDetail(call));

        LinearLayout textColumn = new LinearLayout(this);
        textColumn.setOrientation(LinearLayout.VERTICAL);
        textColumn.addView(text(call.displayCaller(), 17, COLOR_INK, Typeface.BOLD));
        textColumn.addView(text(call.fromNumber.length() > 0 ? call.fromNumber : "Unknown number", 13, COLOR_MUTED, Typeface.NORMAL));
        textColumn.addView(text(call.compactDate(), 12, COLOR_TERTIARY, Typeface.BOLD));
        card.addView(textColumn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.CENTER_VERTICAL);

        String callbackTarget = call.bestCallbackNumber();
        ImageView callBack = iconAction(R.drawable.ic_action_call, "Call back");
        callBack.setAlpha(callbackTarget.length() > 0 ? 1f : 0.35f);
        callBack.setEnabled(callbackTarget.length() > 0);
        if (callbackTarget.length() > 0) {
            callBack.setOnClickListener(view -> dial(callbackTarget));
        }
        ImageView details = iconAction(R.drawable.ic_action_info, "Call details");
        details.setOnClickListener(view -> showCallDetail(call));
        ImageView note = iconAction(R.drawable.ic_action_note, "Add note");
        note.setOnClickListener(view -> showNoteForCall(call));
        actions.addView(callBack, new LinearLayout.LayoutParams(dp(40), dp(40)));
        actions.addView(details, new LinearLayout.LayoutParams(dp(40), dp(40)));
        actions.addView(note, new LinearLayout.LayoutParams(dp(40), dp(40)));
        card.addView(actions);

        return card;
    }

    private ImageView iconAction(int drawableId, String description) {
        ImageView action = new ImageView(this);
        action.setImageResource(drawableId);
        action.setColorFilter(COLOR_BLUE);
        action.setScaleType(ImageView.ScaleType.CENTER);
        action.setBackground(makeRoundedStroke(COLOR_SUBTLE, COLOR_LINE, 999));
        action.setPadding(dp(10), dp(10), dp(10), dp(10));
        action.setContentDescription(description);
        return action;
    }

    private void showNoteForCall(CallRecord call) {
        activeTab = "assistant";
        bottomNav.setVisibility(View.VISIBLE);
        renderTabs();
        setScreenTitle("Assistant");
        content.removeAllViews();
        content.addView(titleBlock("Note for " + call.displayCaller(), "Give the assistant context for the next conversation with this caller."));

        LinearLayout form = panel();
        EditText targetInput = input("Caller phone");
        targetInput.setInputType(InputType.TYPE_CLASS_PHONE);
        targetInput.setText(call.bestCallbackNumber());
        form.addView(targetInput);

        EditText noteInput = input("What should the assistant remember or say?");
        noteInput.setMinLines(3);
        noteInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        form.addView(noteInput);

        Button save = primaryButton("Save note");
        save.setOnClickListener(view -> createAgentNote(noteInput.getText().toString(), targetInput.getText().toString()));
        form.addView(save, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)));
        content.addView(form);
    }

    private void showCallDetail(CallRecord call) {
        bottomNav.setVisibility(View.GONE);
        setScreenTitle("Call");
        content.removeAllViews();

        Button back = secondaryButton("Back");
        back.setOnClickListener(view -> navigateTab(activeTab.length() > 0 && !"onboarding".equals(activeTab) ? activeTab : "home"));
        LinearLayout.LayoutParams backParams = new LinearLayout.LayoutParams(dp(96), dp(44));
        backParams.setMargins(0, 0, 0, dp(14));
        content.addView(back, backParams);

        LinearLayout summary = panel();
        summary.addView(label("Handled call"));
        LinearLayout top = row();
        LinearLayout caller = new LinearLayout(this);
        caller.setOrientation(LinearLayout.VERTICAL);
        caller.addView(text(call.displayCaller(), 24, COLOR_INK, Typeface.BOLD));
        String phone = call.fromNumber.length() > 0 ? call.fromNumber : "Unknown number";
        caller.addView(text(phone + " / " + call.formattedTime(), 13, COLOR_MUTED, Typeface.BOLD));
        top.addView(caller, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        TextView urgency = text(call.urgencyLabel(), 12, Color.WHITE, Typeface.BOLD);
        urgency.setGravity(Gravity.CENTER);
        urgency.setPadding(dp(10), dp(6), dp(10), dp(6));
        urgency.setBackground(makeRounded(call.urgencyColor(), 999));
        top.addView(urgency);
        summary.addView(top);

        TextView summaryText = text(call.summaryText(), 16, COLOR_INK, Typeface.NORMAL);
        summaryText.setLineSpacing(dp(3), 1.0f);
        summaryText.setPadding(0, dp(14), 0, 0);
        summary.addView(summaryText);

        LinearLayout actions = row();
        actions.setPadding(0, dp(16), 0, 0);
        Button callBack = primaryButton("Call back");
        String callbackTarget = call.bestCallbackNumber();
        callBack.setEnabled(callbackTarget.length() > 0);
        callBack.setAlpha(callbackTarget.length() > 0 ? 1f : 0.45f);
        if (callbackTarget.length() > 0) {
            callBack.setOnClickListener(view -> dial(callbackTarget));
        }
        Button note = secondaryButton("Add note");
        note.setOnClickListener(view -> showNoteForCall(call));
        actions.addView(callBack, new LinearLayout.LayoutParams(0, dp(50), 1));
        LinearLayout.LayoutParams noteParams = new LinearLayout.LayoutParams(0, dp(50), 1);
        noteParams.setMargins(dp(8), 0, 0, 0);
        actions.addView(note, noteParams);
        summary.addView(actions);
        content.addView(summary);

        content.addView(sectionHeader("Outcome"));
        LinearLayout outcomes = panel();
        if (call.intent.length() > 0) {
            outcomes.addView(detailRow("Intent", call.intent));
        } else {
            outcomes.addView(detailRow("Intent", "No clear intent captured yet."));
        }
        if (call.followUp.length() > 0) {
            outcomes.addView(detailRow("Follow-up", call.followUp));
        } else {
            outcomes.addView(detailRow("Follow-up", "No follow-up requested."));
        }
        outcomes.addView(detailRow("Status", call.status.length() > 0 ? call.status : "Unknown"));
        content.addView(outcomes);

        content.addView(sectionHeader("Transcript"));
        LinearLayout transcript = panel();
        if (call.transcript.length() > 0) {
            addTranscriptLines(transcript, call.transcript);
        } else {
            transcript.addView(body("No transcript is available yet."));
        }
        content.addView(transcript);
    }

    private View detailRow(String label, String value) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.VERTICAL);
        row.setPadding(0, dp(12), 0, dp(2));
        row.addView(text(label, 12, COLOR_MUTED, Typeface.BOLD));
        TextView valueView = text(value, 15, COLOR_INK, Typeface.NORMAL);
        valueView.setLineSpacing(dp(3), 1.0f);
        valueView.setPadding(0, dp(4), 0, 0);
        row.addView(valueView);
        return row;
    }

    private void addTranscriptLines(LinearLayout container, String transcriptText) {
        String[] lines = transcriptText.split("\\r?\\n");
        for (String rawLine : lines) {
            String line = rawLine == null ? "" : rawLine.trim();
            if (line.length() == 0) {
                continue;
            }
            int colon = line.indexOf(":");
            if (colon > 0 && colon < 24) {
                String speaker = line.substring(0, colon).trim();
                String utterance = line.substring(colon + 1).trim();
                container.addView(transcriptLine(speaker, utterance.length() > 0 ? utterance : line));
            } else {
                container.addView(transcriptLine("Call", line));
            }
        }
    }

    private View transcriptLine(String speaker, String utterance) {
        LinearLayout block = new LinearLayout(this);
        block.setOrientation(LinearLayout.VERTICAL);
        block.setPadding(0, dp(12), 0, 0);
        block.addView(text(speaker, 12, COLOR_TERTIARY, Typeface.BOLD));
        TextView utteranceView = text(utterance, 15, COLOR_INK, Typeface.NORMAL);
        utteranceView.setLineSpacing(dp(3), 1.0f);
        utteranceView.setPadding(0, dp(3), 0, 0);
        block.addView(utteranceView);
        return block;
    }

    private void showForwarding() {
        showForwarding(false);
    }

    private void showForwarding(boolean continueToActivation) {
        activeTab = continueToActivation ? "onboarding" : activeTab;
        bottomNav.setVisibility(continueToActivation ? View.GONE : View.VISIBLE);
        setScreenTitle("Forward calls");
        content.removeAllViews();
        String assistantNumber = currentUser.retellPhoneNumber.length() > 0 ? currentUser.retellPhoneNumber : BuildConfig.PHONE_AGENT_NUMBER;
        String assistantNumberDisplay = currentUser.retellPhoneNumber.length() > 0 ? currentUser.retellPhoneNumber : BuildConfig.PHONE_AGENT_NUMBER_DISPLAY;
        String assistantDigits = assistantNumber.replace("+1", "").replace("+", "");
        String missedCode = "*71" + assistantDigits;
        String fullCode = "*72" + assistantDigits;

        content.addView(forwardingPrimarySetupCard(assistantNumber, assistantNumberDisplay, missedCode));

        LinearLayout advanced = new LinearLayout(this);
        advanced.setOrientation(LinearLayout.VERTICAL);
        advanced.setPadding(0, dp(14), 0, 0);
        advanced.addView(forwardingAtmosphereLabel("More options"));
        advanced.addView(forwardingCodeRow("Full forwarding", fullCode, "Advanced. Can block transfers back to this phone."));
        advanced.addView(forwardingDivider());
        advanced.addView(forwardingCodeRow("Turn forwarding off", "*73", "Return calls to normal ringing."));
        content.addView(advanced);

        if (continueToActivation) {
            LinearLayout next = compactPanel(16, 18);
            next.addView(text("After dialing the code", 18, COLOR_INK, Typeface.BOLD));
            next.addView(body("Come back here and make one test call so you can hear exactly what callers experience."));
            Button done = primaryButton("Continue to test call");
            done.setOnClickListener(view -> markForwardingInstructionsViewedThen(this::showOnboardingTestCall));
            LinearLayout.LayoutParams doneParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50));
            doneParams.setMargins(0, dp(12), 0, 0);
            next.addView(done, doneParams);
            content.addView(next);
        }
    }

    private View forwardingPrimarySetupCard(String assistantNumber, String assistantNumberDisplay, String missedCode) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(0, dp(4), 0, dp(8));
        String assistantName = currentUser.assistantName.length() > 0 ? currentUser.assistantName : "Assistant";

        LinearLayout top = row();
        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.addView(text("Recommended", 11, COLOR_GREEN, Typeface.BOLD));
        copy.addView(text("Missed-call forwarding", 20, COLOR_ON_ATMOSPHERE, Typeface.BOLD));
        top.addView(copy, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        TextView carrier = forwardingChip("Verizon");
        carrier.setTextColor(COLOR_ON_ATMOSPHERE_MUTED);
        top.addView(carrier);
        card.addView(top);

        TextView description = text("Unanswered calls go to " + assistantName + ".", 14, COLOR_ON_ATMOSPHERE_MUTED, Typeface.NORMAL);
        description.setLineSpacing(dp(2), 1.0f);
        description.setPadding(0, dp(5), 0, dp(5));
        card.addView(description);

        LinearLayout codeRow = row();
        TextView code = text(missedCode, 26, Color.rgb(218, 211, 255), Typeface.BOLD);
        codeRow.addView(code, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        Button dial = primaryButton("Dial code");
        dial.setOnClickListener(view -> dial(missedCode));
        LinearLayout.LayoutParams dialParams = new LinearLayout.LayoutParams(dp(134), dp(44));
        dialParams.setMargins(dp(10), 0, 0, 0);
        codeRow.addView(dial, dialParams);
        card.addView(codeRow);

        LinearLayout numberRow = row();
        numberRow.setPadding(0, dp(8), 0, 0);
        TextView assistantLabel = text("Assistant number", 11, COLOR_ON_ATMOSPHERE_MUTED, Typeface.BOLD);
        numberRow.addView(assistantLabel, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        TextView number = text(assistantNumberDisplay, 14, COLOR_ON_ATMOSPHERE, Typeface.BOLD);
        numberRow.addView(number);
        card.addView(numberRow);

        LinearLayout actions = row();
        actions.setPadding(0, dp(8), 0, 0);
        TextView copyCode = forwardingChip("Copy code");
        copyCode.setOnClickListener(view -> copyText(missedCode));
        LinearLayout.LayoutParams codeParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        actions.addView(copyCode, codeParams);

        TextView copyNumber = forwardingChip("Copy number");
        copyNumber.setOnClickListener(view -> copyText(assistantNumber));
        LinearLayout.LayoutParams numberParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        numberParams.setMargins(dp(8), 0, 0, 0);
        actions.addView(copyNumber, numberParams);
        card.addView(actions);
        return card;
    }

    private View forwardingCodeRow(String title, String code, String description) {
        LinearLayout item = new LinearLayout(this);
        item.setOrientation(LinearLayout.HORIZONTAL);
        item.setGravity(Gravity.CENTER_VERTICAL);
        item.setPadding(dp(2), dp(8), dp(2), dp(2));

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.addView(text(title, 15, COLOR_ON_ATMOSPHERE, Typeface.BOLD));
        TextView detail = text(description, 12, COLOR_ON_ATMOSPHERE_MUTED, Typeface.NORMAL);
        detail.setLineSpacing(dp(2), 1.0f);
        detail.setPadding(0, dp(2), 0, 0);
        copy.addView(detail);
        item.addView(copy, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        LinearLayout commands = new LinearLayout(this);
        commands.setOrientation(LinearLayout.VERTICAL);
        commands.setGravity(Gravity.RIGHT);
        LinearLayout.LayoutParams commandParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        commandParams.setMargins(dp(10), 0, 0, 0);

        TextView codeView = text(code, 14, Color.rgb(218, 211, 255), Typeface.BOLD);
        codeView.setGravity(Gravity.CENTER);
        codeView.setPadding(dp(8), dp(5), dp(8), dp(5));
        codeView.setBackground(makeRoundedStroke(Color.argb(28, 255, 255, 255), Color.argb(46, 255, 255, 255), 999));
        commands.addView(codeView);

        LinearLayout actions = row();
        actions.setGravity(Gravity.RIGHT);
        actions.setPadding(0, dp(5), 0, 0);
        TextView dial = forwardingChip("Dial");
        dial.setTextColor(COLOR_BLUE);
        dial.setOnClickListener(view -> dial(code));
        TextView copyChip = forwardingChip("Copy");
        copyChip.setOnClickListener(view -> copyText(code));
        actions.addView(dial);
        LinearLayout.LayoutParams copyParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        copyParams.setMargins(dp(6), 0, 0, 0);
        actions.addView(copyChip, copyParams);
        commands.addView(actions);
        item.addView(commands, commandParams);
        return item;
    }

    private TextView forwardingAtmosphereLabel(String value) {
        TextView label = text(value.toUpperCase(Locale.US), 12, COLOR_ON_ATMOSPHERE_MUTED, Typeface.BOLD);
        label.setPadding(0, 0, 0, dp(4));
        return label;
    }

    private View forwardingDivider() {
        View divider = new View(this);
        divider.setBackgroundColor(Color.argb(42, 255, 255, 255));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1));
        params.setMargins(0, dp(8), 0, dp(8));
        divider.setLayoutParams(params);
        return divider;
    }

    private TextView forwardingChip(String value) {
        TextView chip = text(value, 12, COLOR_ON_ATMOSPHERE, Typeface.BOLD);
        chip.setGravity(Gravity.CENTER);
        chip.setPadding(dp(10), dp(6), dp(10), dp(6));
        chip.setBackground(makeRoundedStroke(Color.argb(28, 255, 255, 255), Color.argb(46, 255, 255, 255), 999));
        return chip;
    }

    private void showOnboardingTestCall() {
        activeTab = "onboarding";
        bottomNav.setVisibility(View.GONE);
        setScreenTitle("Test call");
        statusText.setText("Setup");
        statusText.setBackground(makeRounded(COLOR_WARN, 999));
        content.removeAllViews();

        String assistantNumber = currentUser.retellPhoneNumber.length() > 0 ? currentUser.retellPhoneNumber : BuildConfig.PHONE_AGENT_NUMBER;
        String assistantNumberDisplay = currentUser.retellPhoneNumber.length() > 0 ? currentUser.retellPhoneNumber : BuildConfig.PHONE_AGENT_NUMBER_DISPLAY;
        content.addView(titleBlock("Make one test call", "Call your assistant once so you know the experience is working before relying on it."));

        LinearLayout card = panel();
        card.addView(label("Your assistant number"));
        card.addView(text(assistantNumberDisplay, 24, COLOR_INK, Typeface.BOLD));
        card.addView(body("If carrier forwarding is already on, call your regular mobile number from another phone. If not, call this assistant number directly."));
        Button call = primaryButton("Call assistant");
        call.setOnClickListener(view -> dial(assistantNumber));
        card.addView(call, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)));
        Button open = secondaryButton("Open app");
        open.setOnClickListener(view -> finishFirstRunOnboarding());
        card.addView(open, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)));
        content.addView(card);

        content.addView(quietPanel("You can come back to this", "The Assistant tab will still show test-call and setup status until the first handled call is confirmed."));
    }

    private void finishFirstRunOnboarding() {
        getSharedPreferences(APP_PREFS, MODE_PRIVATE)
                .edit()
                .putBoolean(firstRunOnboardingPrefKey(), true)
                .apply();
        bottomNav.setVisibility(View.VISIBLE);
        activeTab = "home";
        renderTabs();
        showToday();
        loadData();
    }

    private void markForwardingInstructionsViewedThen(Runnable next) {
        loading.setVisibility(View.VISIBLE);
        executor.execute(() -> {
            try {
                JSONObject response = postJsonForObject(new URL(BuildConfig.BACKEND_BASE_URL + "/v1/onboarding/forwarding-instructions-viewed"), new JSONObject(), true);
                JSONObject user = response.optJSONObject("user");
                currentUser = user == null ? currentUser : UserSummary.fromJson(user);
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    next.run();
                    loadData();
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    Toast.makeText(this, "Could not save setup progress: " + error.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private void showRules() {
        setScreenTitle("Assistant");
        content.removeAllViews();
        content.addView(titleBlock("Interruption rules", "Local controls for the first app shell. Backend persistence comes next."));
        content.addView(switchRow("Escalate urgent calls", true));
        content.addView(switchRow("Let selected contacts bypass screening", true));
        content.addView(switchRow("Screen unknown callers", true));
        content.addView(switchRow("Suppress low-value callers", true));
        content.addView(switchRow("Show sensitive content in notifications", false));
    }

    private void showAssistant() {
        showAssistant(true);
    }

    private void showAssistant(boolean resetScroll) {
        setScreenTitle("Assistant", resetScroll);
        content.removeAllViews();

        content.addView(assistantCommandCard());

        boolean hasPending = false;
        if (!approvalRequests.isEmpty() || !answerRequests.isEmpty()) {
            content.addView(sectionHeader("Needs you"));
        }
        for (AnswerRequest answerRequest : answerRequests) {
            content.addView(answerCard(answerRequest));
            hasPending = true;
        }
        for (ApprovalRequest approvalRequest : approvalRequests) {
            content.addView(approvalCard(approvalRequest));
            hasPending = true;
        }
        if (activeCall != null) {
            if (!hasPending) {
                content.addView(sectionHeader("Live now"));
            }
            content.addView(activeCallPriorityCard());
            hasPending = true;
        }
        for (AppNotification notification : appNotifications) {
            if (isLiveRequestNotification(notification) && !hasPendingRequestForNotification(notification)) {
                if (!hasPending) {
                    content.addView(sectionHeader("Live now"));
                }
                content.addView(appNotificationCard(notification));
                hasPending = true;
            }
        }
        if (!hasPending && activeCall == null) {
            content.addView(assistantLiveIdleStrip());
        }

        content.addView(assistantActionGrid());
        content.addView(assistantVoiceStrip());

        content.addView(sectionHeader("Channels"));
        LinearLayout channels = compactPanel(14, 16);
        String assistantNumberLabel = currentUser.retellPhoneNumber.length() > 0 ? currentUser.retellPhoneNumber : BuildConfig.PHONE_AGENT_NUMBER_DISPLAY;
        channels.addView(assistantDenseActionRow("Phone", "Forwarding to " + assistantNumberLabel, "forwarding"));
        channels.addView(compactDivider());
        channels.addView(assistantDenseActionRow("Calendar", calendarStatus.connected ? "Connected" : "Connect availability and events", "calendar"));
        channels.addView(compactDivider());
        channels.addView(assistantSoonRow("SMS"));
        channels.addView(compactDivider());
        channels.addView(assistantSoonRow("Email"));
        channels.addView(compactDivider());
        channels.addView(assistantSoonRow("Documents"));
        content.addView(channels);

        content.addView(sectionHeader("Controls"));
        LinearLayout controls = compactPanel(14, 16);
        controls.addView(assistantDenseActionRow("Notifications", appNotifications.size() + " unread", "notifications"));
        controls.addView(compactDivider());
        controls.addView(assistantDenseActionRow("People memory", callerProfiles.size() + " caller profiles", "people"));
        controls.addView(compactDivider());
        controls.addView(assistantDenseActionRow("Phone contacts", contactSyncCount > 0 ? contactSyncCount + " synced" : "Sync names", "contacts"));
        controls.addView(compactDivider());
        controls.addView(assistantDenseActionRow("Rules", "Who gets through", "rules"));
        controls.addView(compactDivider());
        controls.addView(assistantDenseActionRow("Billing", billingAccount.statusLabel() + " / " + billingAccount.formattedCap(), "billing"));
        content.addView(controls);
    }

    private View assistantActionGrid() {
        LinearLayout quickActions = compactPanel(12, 16);
        LinearLayout actionRowOne = row();
        actionRowOne.addView(assistantQuickAction("Add note", "For next call", "notes"), gridCellParams(56, true, true));
        actionRowOne.addView(assistantQuickAction("Test call", "Call assistant", "call"), gridCellParams(56, false, true));
        quickActions.addView(actionRowOne);
        LinearLayout actionRowTwo = row();
        actionRowTwo.addView(assistantQuickAction("Forwarding", "Setup", "forwarding"), gridCellParams(56, true, false));
        actionRowTwo.addView(assistantQuickAction("Calendar", calendarStatus.connected ? "Connected" : "Connect", "calendar"), gridCellParams(56, false, false));
        quickActions.addView(actionRowTwo);
        return quickActions;
    }

    private View assistantCommandCard() {
        LinearLayout card = compactPanel(14, 18);
        String subtitle = activeCall != null
                ? activeCall.displayCaller() + " / " + activeCall.statusLabel()
                : onboardingStatus.readyForBetaUse
                ? "Ready to answer, summarize, ask for help, and protect your attention."
                : "Finish setup before relying on the assistant for calls.";
        LinearLayout top = row();
        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.addView(text(currentUser.assistantName.length() > 0 ? currentUser.assistantName : "Assistant", 20, COLOR_INK, Typeface.BOLD));
        top.addView(copy, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        TextView health = text(activeCall != null ? "Live" : onboardingStatus.readyForBetaUse ? "Active" : "Setup", 12, Color.WHITE, Typeface.BOLD);
        health.setGravity(Gravity.CENTER);
        health.setPadding(dp(12), dp(6), dp(12), dp(6));
        health.setBackground(makeRounded(activeCall != null ? COLOR_WARN : onboardingStatus.readyForBetaUse ? COLOR_GREEN : COLOR_WARN, 999));
        top.addView(health);
        card.addView(top);

        TextView subtitleView = text(subtitle, 14, COLOR_MUTED, Typeface.NORMAL);
        subtitleView.setLineSpacing(dp(3), 1.0f);
        subtitleView.setPadding(0, dp(9), 0, 0);
        card.addView(subtitleView);
        LinearLayout stats = row();
        stats.setPadding(0, dp(10), 0, 0);
        stats.addView(assistantMiniStat("Needs", String.valueOf(approvalRequests.size() + answerRequests.size())), gridCellParams(36, true, false));
        stats.addView(assistantMiniStat("Notes", String.valueOf(agentNotes.size())), gridCellParams(36, true, false));
        stats.addView(assistantMiniStat("Unread", String.valueOf(appNotifications.size())), gridCellParams(36, false, false));
        card.addView(stats);
        return card;
    }

    private View assistantLiveIdleStrip() {
        LinearLayout strip = compactPanel(12, 14);
        strip.setOrientation(LinearLayout.HORIZONTAL);
        strip.setGravity(Gravity.CENTER_VERTICAL);
        TextView dot = text("No live requests", 14, COLOR_INK, Typeface.BOLD);
        strip.addView(dot, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        TextView detail = text("Will ask here", 12, COLOR_MUTED, Typeface.BOLD);
        detail.setGravity(Gravity.CENTER);
        detail.setPadding(dp(10), dp(5), dp(10), dp(5));
        detail.setBackground(makeRoundedStroke(COLOR_SUBTLE, COLOR_LINE, 999));
        strip.addView(detail);
        return strip;
    }

    private View assistantVoiceStrip() {
        LinearLayout strip = compactPanel(14, 16);
        strip.setOrientation(LinearLayout.HORIZONTAL);
        strip.setGravity(Gravity.CENTER_VERTICAL);

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.addView(text("Voice style", 14, COLOR_INK, Typeface.BOLD));
        copy.addView(text(currentUser.greetingStyle + " / " + currentUser.disclosureStyle + " / warmth " + currentUser.warmth + " of 5", 12, COLOR_MUTED, Typeface.NORMAL));
        strip.addView(copy, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        TextView customize = text("Customize", 12, COLOR_BLUE, Typeface.BOLD);
        customize.setGravity(Gravity.CENTER);
        customize.setPadding(dp(12), dp(7), dp(12), dp(7));
        customize.setBackground(makeRoundedStroke(COLOR_CARD, COLOR_LINE, 999));
        customize.setOnClickListener(view -> showAssistantProfileSetup(false));
        strip.addView(customize);
        return strip;
    }

    private View assistantMiniStat(String label, String value) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.HORIZONTAL);
        box.setGravity(Gravity.CENTER);
        box.setBackground(makeRoundedStroke(COLOR_SELECTED, COLOR_LINE, 12));
        TextView valueView = text(value, 15, COLOR_INK, Typeface.BOLD);
        valueView.setGravity(Gravity.CENTER);
        box.addView(valueView);
        TextView labelView = text(" " + label, 11, COLOR_MUTED, Typeface.BOLD);
        labelView.setGravity(Gravity.CENTER);
        box.addView(labelView);
        return box;
    }

    private View assistantQuickAction(String title, String subtitle, String action) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(12), dp(10), dp(12), dp(10));
        card.setBackground(makeRoundedStroke(COLOR_SUBTLE, COLOR_LINE, 14));
        card.setOnClickListener(view -> navigateToSetupAction(action));
        card.addView(text(title, 14, COLOR_INK, Typeface.BOLD));
        TextView detail = text(subtitle, 12, COLOR_MUTED, Typeface.NORMAL);
        detail.setPadding(0, dp(4), 0, 0);
        card.addView(detail);
        return card;
    }

    private LinearLayout.LayoutParams gridCellParams(int heightDp, boolean rightGutter, boolean bottomGutter) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(heightDp), 1);
        params.setMargins(0, 0, rightGutter ? dp(8) : 0, bottomGutter ? dp(8) : 0);
        return params;
    }

    private View compactQuietRow(String title, String subtitle) {
        LinearLayout row = panel();
        row.setBackground(makeRoundedStroke(COLOR_SUBTLE, COLOR_LINE, 12));
        row.setPadding(dp(16), dp(14), dp(16), dp(14));
        row.addView(text(title, 16, COLOR_INK, Typeface.BOLD));
        row.addView(body(subtitle));
        return row;
    }

    private LinearLayout compactPanel(int paddingDp, int radiusDp) {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(paddingDp), dp(paddingDp), dp(paddingDp), dp(paddingDp));
        panel.setBackground(makeRoundedStroke(COLOR_CARD, COLOR_LINE, radiusDp));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            panel.setElevation(dp(1));
        }
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, 0, 0, dp(10));
        panel.setLayoutParams(params);
        return panel;
    }

    private View assistantDenseActionRow(String title, String subtitle, String action) {
        LinearLayout item = new LinearLayout(this);
        item.setOrientation(LinearLayout.HORIZONTAL);
        item.setGravity(Gravity.CENTER_VERTICAL);
        item.setPadding(dp(2), dp(8), dp(2), dp(8));
        item.setOnClickListener(view -> navigateToSetupAction(action));

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.addView(text(title, 15, COLOR_INK, Typeface.BOLD));
        TextView detail = text(subtitle, 12, COLOR_MUTED, Typeface.NORMAL);
        detail.setPadding(0, dp(4), 0, 0);
        copy.addView(detail);
        item.addView(copy, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        TextView open = text("Open", 12, COLOR_BLUE, Typeface.BOLD);
        open.setGravity(Gravity.CENTER);
        open.setPadding(dp(10), dp(6), dp(10), dp(6));
        open.setBackground(makeRoundedStroke(COLOR_CARD, COLOR_LINE, 999));
        open.setOnClickListener(view -> navigateToSetupAction(action));
        item.addView(open);
        return item;
    }

    private View compactDivider() {
        View divider = new View(this);
        divider.setBackgroundColor(COLOR_LINE);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1));
        params.setMargins(0, dp(2), 0, dp(2));
        divider.setLayoutParams(params);
        return divider;
    }

    private View assistantSoonRow(String title) {
        LinearLayout item = new LinearLayout(this);
        item.setOrientation(LinearLayout.HORIZONTAL);
        item.setGravity(Gravity.CENTER_VERTICAL);
        item.setPadding(dp(2), dp(8), dp(2), dp(8));

        TextView label = text(title, 14, COLOR_MUTED, Typeface.BOLD);
        item.addView(label, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        TextView soon = text("Soon", 11, COLOR_MUTED, Typeface.BOLD);
        soon.setGravity(Gravity.CENTER);
        soon.setPadding(dp(9), dp(5), dp(9), dp(5));
        soon.setBackground(makeRoundedStroke(COLOR_SUBTLE, COLOR_LINE, 999));
        item.addView(soon);
        return item;
    }

    private void showNotificationCenter() {
        setScreenTitle("Assistant");
        content.removeAllViews();
        content.addView(titleBlock("Notifications", "Privacy-safe alerts, live requests, summaries, and assistant events."));
        if (appNotifications.isEmpty()) {
            content.addView(quietPanel("No unread notifications", "Transfer requests, live answers, summaries, and calendar changes will appear here."));
            return;
        }
        for (AppNotification notification : appNotifications) {
            content.addView(appNotificationCard(notification));
        }
    }

    private View appNotificationCard(AppNotification notification) {
        LinearLayout card = panel();
        card.addView(label(notification.typeLabel() + " / " + notification.priority));
        card.addView(text(notification.title, 18, COLOR_INK, Typeface.BOLD));
        card.addView(body(notification.body));
        LinearLayout actions = row();
        Button open = smallButton("Open");
        open.setOnClickListener(view -> openNotificationTarget(notification.target));
        Button dismiss = secondaryButton("Dismiss");
        dismiss.setOnClickListener(view -> dismissNotification(notification.id));
        actions.addView(open, gridCellParams(42, true, false));
        actions.addView(dismiss, gridCellParams(42, false, false));
        card.addView(actions);
        return card;
    }

    private void openNotificationTarget(String target) {
        String normalized = target == null ? "" : target;
        if (normalized.startsWith("assistant/answers")) {
            activeTab = "assistant";
            renderTabs();
            showAnswers(lastPathSegment(normalized));
        } else if (normalized.startsWith("assistant/approvals")) {
            activeTab = "assistant";
            renderTabs();
            showApprovals(lastPathSegment(normalized));
        } else if (normalized.startsWith("assistant/calendar") || normalized.startsWith("calendar")) {
            activeTab = "assistant";
            renderTabs();
            showCalendar();
        } else if (normalized.startsWith("billing")) {
            activeTab = "assistant";
            renderTabs();
            showBillingSetup(false);
        } else if (normalized.startsWith("inbox/communications/") || normalized.startsWith("communications/")) {
            String id = normalized.substring(normalized.lastIndexOf('/') + 1);
            CommunicationItem item = findCommunication(id);
            if (item != null) {
                activeTab = "inbox";
                renderTabs();
                showCommunicationItemDetail(item);
            } else {
                navigateTab("inbox");
            }
        } else if (normalized.startsWith("inbox/topic-suggestions") || normalized.startsWith("topic_suggestions")) {
            activeTab = "inbox";
            renderTabs();
            showInbox();
        } else if (normalized.startsWith("inbox")) {
            navigateTab("inbox");
        } else {
            navigateTab("assistant");
        }
    }

    private void showAssistantStatus() {
        activeTab = "assistant";
        renderTabs();
        setScreenTitle("Status");
        content.removeAllViews();
        content.addView(titleBlock("Assistant status", "Health, channel readiness, data freshness, and setup blockers."));

        LinearLayout status = panel();
        status.addView(text(activeCall != null ? "Live call active" : onboardingStatus.readyForBetaUse ? "Assistant active" : "Setup needed", 20, COLOR_INK, Typeface.BOLD));
        status.addView(sectionLine("Mode", activeCall != null ? "Live" : onboardingStatus.readyForBetaUse ? "Active" : "Setup"));
        status.addView(sectionLine("Phone forwarding", "Configured through " + BuildConfig.PHONE_AGENT_NUMBER_DISPLAY));
        status.addView(sectionLine("Calendar", calendarStatus.connected ? "Connected" : "Not connected"));
        status.addView(sectionLine("Pending user actions", String.valueOf(approvalRequests.size() + answerRequests.size())));
        status.addView(sectionLine("Review items", String.valueOf(topicSuggestions.size())));
        content.addView(status);

        if (!onboardingStatus.checklist.isEmpty()) {
            content.addView(sectionHeader("Activation checklist"));
            for (OnboardingStep step : onboardingStatus.checklist) {
                content.addView(onboardingStepCard(step));
            }
        }
    }

    private View channelComingSoon(String title, String subtitle) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(0, dp(14), 0, dp(10));
        LinearLayout textColumn = new LinearLayout(this);
        textColumn.setOrientation(LinearLayout.VERTICAL);
        textColumn.addView(text(title, 16, COLOR_INK, Typeface.BOLD));
        textColumn.addView(body(subtitle));
        row.addView(textColumn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        TextView chip = text("Soon", 12, COLOR_MUTED, Typeface.BOLD);
        chip.setGravity(Gravity.CENTER);
        chip.setPadding(dp(10), dp(6), dp(10), dp(6));
        chip.setBackground(makeRoundedStroke(COLOR_SUBTLE, COLOR_LINE, 999));
        row.addView(chip);
        return row;
    }

    private void showProfileAndPrivacy() {
        setScreenTitle("Settings");
        content.removeAllViews();
        content.addView(titleBlock("Settings", "Account, privacy, billing, and diagnostic controls."));

        LinearLayout phone = panel();
        phone.addView(text("Account", 18, COLOR_INK, Typeface.BOLD));
        phone.addView(sectionLine("Primary phone", "Configured for this beta device"));
        phone.addView(text(BuildConfig.PHONE_AGENT_NUMBER_DISPLAY, 24, COLOR_INK, Typeface.BOLD));
        LinearLayout phoneActions = row();
        Button call = primaryButton("Call");
        call.setOnClickListener(view -> dial(BuildConfig.PHONE_AGENT_NUMBER));
        Button copy = secondaryButton("Copy");
        copy.setOnClickListener(view -> copyText(BuildConfig.PHONE_AGENT_NUMBER));
        phoneActions.addView(call, gridCellParams(42, true, false));
        phoneActions.addView(copy, gridCellParams(42, false, false));
        phone.addView(phoneActions);
        content.addView(phone);

        LinearLayout billing = panel();
        billing.addView(text("Billing", 18, COLOR_INK, Typeface.BOLD));
        billing.addView(sectionLine("Status", billingAccount.statusLabel()));
        billing.addView(sectionLine("Monthly cap", billingAccount.formattedCap()));
        billing.addView(sectionLine("This month", billingAccount.formattedSpend()));
        billing.addView(sectionLine("Card", billingAccount.paymentMethodLabel()));
        Button billingButton = primaryButton("Manage billing");
        billingButton.setOnClickListener(view -> showBillingSetup(false));
        billing.addView(billingButton, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)));
        content.addView(billing);

        LinearLayout privacy = panel();
        privacy.addView(text("Privacy center", 18, COLOR_INK, Typeface.BOLD));
        privacy.addView(sectionLine("Lock-screen content", "Private by default"));
        privacy.addView(sectionLine("External sharing", "Approval required"));
        privacy.addView(sectionLine("Sensitive topics", "Strict"));
        privacy.addView(sectionLine("Assistant notes", "Expire by default"));
        content.addView(privacy);

        LinearLayout deployment = panel();
        deployment.addView(text("Diagnostics", 18, COLOR_INK, Typeface.BOLD));
        deployment.addView(sectionLine("Backend", BuildConfig.BACKEND_BASE_URL));
        deployment.addView(sectionLine("Assistant number", BuildConfig.PHONE_AGENT_NUMBER_DISPLAY));
        content.addView(deployment);
    }

    private View settingsActionRow(String title, String subtitle, String action) {
        LinearLayout item = new LinearLayout(this);
        item.setOrientation(LinearLayout.HORIZONTAL);
        item.setGravity(Gravity.CENTER_VERTICAL);
        item.setPadding(0, dp(14), 0, dp(10));

        LinearLayout textColumn = new LinearLayout(this);
        textColumn.setOrientation(LinearLayout.VERTICAL);
        textColumn.addView(text(title, 16, COLOR_INK, Typeface.BOLD));
        textColumn.addView(body(subtitle));
        item.addView(textColumn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        TextView open = text("Open", 13, COLOR_BLUE, Typeface.BOLD);
        open.setGravity(Gravity.CENTER);
        open.setPadding(dp(12), dp(8), dp(12), dp(8));
        open.setBackground(makeRoundedStroke(COLOR_CARD, COLOR_LINE, 8));
        item.addView(open);

        item.setOnClickListener(view -> navigateToSetupAction(action));
        open.setOnClickListener(view -> navigateToSetupAction(action));
        return item;
    }

    private View switchRow(String label, boolean checked) {
        LinearLayout card = panel();
        LinearLayout row = row();
        TextView text = text(label, 16, COLOR_INK, Typeface.BOLD);
        row.addView(text, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        Switch toggle = new Switch(this);
        toggle.setChecked(checked);
        toggle.setOnCheckedChangeListener((CompoundButton buttonView, boolean isChecked) ->
                Toast.makeText(this, "Saved locally for this build", Toast.LENGTH_SHORT).show());
        row.addView(toggle);
        card.addView(row);
        return card;
    }

    private void renderActiveCallBanner() {
        activeCallBanner.removeAllViews();
        if (activeCall == null) {
            activeCallBanner.setVisibility(View.GONE);
            statusText.setText(onboardingStatus.readyForBetaUse ? "Active" : "Setup");
            statusText.setBackground(makeRounded(onboardingStatus.readyForBetaUse ? COLOR_GREEN : COLOR_WARN, 999));
            return;
        }

        activeCallBanner.setVisibility(View.VISIBLE);
        statusText.setText("Live");
        statusText.setBackground(makeRounded(COLOR_WARN, 999));

        LinearLayout card = panel();
        LinearLayout top = row();
        TextView title = text("Agent is on a call", 16, COLOR_INK, Typeface.BOLD);
        top.addView(title, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        TextView state = text(activeCall.statusLabel(), 12, Color.WHITE, Typeface.BOLD);
        state.setGravity(Gravity.CENTER);
        state.setPadding(dp(10), dp(5), dp(10), dp(5));
        state.setBackground(makeRounded(activeCall.stateColor(), 999));
        top.addView(state);
        card.addView(top);

        card.addView(text(activeCall.displayCaller(), 20, COLOR_INK, Typeface.BOLD));
        card.addView(label(activeCall.relationship + " / " + activeCall.formattedElapsed()));
        if (activeCall.intent.length() > 0) {
            card.addView(body(activeCall.intent));
        }
        if (activeCall.stale) {
            card.addView(body("Call state may be stale. Waiting for the latest call status."));
        }

        if (activeCall.pendingAnswerRequestId.length() > 0 || activeCall.pendingApprovalRequestId.length() > 0) {
            Button action = smallButton(activeCall.pendingAnswerRequestId.length() > 0 ? "Answer" : "Review transfer");
            action.setOnClickListener(view -> {
                activeTab = "assistant";
                renderTabs();
                showAssistant();
            });
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(40));
            params.setMargins(0, dp(10), 0, 0);
            card.addView(action, params);
        }

        activeCallBanner.addView(card);
    }

    private void loadData() {
        if (executor.isShutdown() || isFinishing() || isDestroyed()) {
            return;
        }
        loading.setVisibility(View.GONE);
        statusText.setText("Syncing");
        try {
            executor.execute(() -> {
            try {
                UserSummary loadedUser = fetchUserSummary();
                BillingAccount loadedBillingAccount = fetchBillingAccount();
                ActiveCall loadedActiveCall = fetchActiveCall();
                OnboardingStatus loadedOnboardingStatus = fetchOnboardingStatus();
                List<CommunicationItem> loadedCommunicationItems = fetchCommunicationItems();
                List<TopicThread> loadedTopicThreads = fetchTopicThreads();
                List<TopicSuggestion> loadedTopicSuggestions = fetchTopicSuggestions();
                List<CallRecord> loaded = fetchCalls();
                List<CallerProfile> loadedProfiles = fetchCallerProfiles();
                List<ApprovalRequest> loadedApprovals = fetchApprovalRequests();
                List<AnswerRequest> loadedAnswers = fetchAnswerRequests();
                List<AgentNote> loadedNotes = fetchAgentNotes();
                CalendarStatus loadedCalendarStatus = fetchCalendarStatus();
                int loadedContactSyncCount = fetchContactSyncCount();
                List<CalendarEventRequest> loadedCalendarEvents = fetchCalendarEventRequests();
                List<AppNotification> loadedNotifications = fetchNotifications();
                mainHandler.post(() -> {
                    startupLoadAttemptedRetry = false;
                    currentUser = loadedUser;
                    billingAccount = loadedBillingAccount;
                    activeCall = loadedActiveCall;
                    onboardingStatus = loadedOnboardingStatus;
                    communicationItems.clear();
                    communicationItems.addAll(loadedCommunicationItems);
                    topicThreads.clear();
                    topicThreads.addAll(loadedTopicThreads);
                    topicSuggestions.clear();
                    topicSuggestions.addAll(loadedTopicSuggestions);
                    calls.clear();
                    calls.addAll(loaded);
                    callerProfiles.clear();
                    callerProfiles.addAll(loadedProfiles);
                    approvalRequests.clear();
                    approvalRequests.addAll(loadedApprovals);
                    answerRequests.clear();
                    answerRequests.addAll(loadedAnswers);
                    agentNotes.clear();
                    agentNotes.addAll(loadedNotes);
                    calendarStatus = loadedCalendarStatus;
                    contactSyncCount = loadedContactSyncCount;
                    calendarEventRequests.clear();
                    calendarEventRequests.addAll(loadedCalendarEvents);
                    appNotifications.clear();
                    appNotifications.addAll(loadedNotifications);
                    notifyForNewProductNotifications(loadedNotifications);
                    loading.setVisibility(View.GONE);
                    statusText.setText(onboardingStatus.readyForBetaUse ? "Active" : "Setup");
                    renderActiveCallBanner();
                    if (shouldShowFirstRunOnboarding()) {
                        showFirstRunOnboardingNextStep();
                        return;
                    }
                    if (pendingNotificationTarget.length() > 0) {
                        String target = pendingNotificationTarget;
                        pendingNotificationTarget = "";
                        openNotificationTarget(target);
                        return;
                    }
                    if ("home".equals(activeTab)) {
                        showToday();
                    } else if ("threads".equals(activeTab)) {
                        showThreads();
                    } else if ("inbox".equals(activeTab)) {
                        showInbox();
                    } else if ("assistant".equals(activeTab)) {
                        showAssistant();
                    } else if ("search".equals(activeTab)) {
                        showSearch();
                    } else if ("notes".equals(activeTab)) {
                        showNotes();
                    } else if ("calendar".equals(activeTab)) {
                        showCalendar();
                    } else if ("people".equals(activeTab)) {
                        showPeople();
                    } else if ("onboarding".equals(activeTab)) {
                        activeTab = "home";
                        renderTabs();
                        showToday();
                    } else {
                        activeTab = "home";
                        renderTabs();
                        showToday();
                    }
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    statusText.setText("Offline");
                    showLoadError(error.getMessage());
                });
            }
            });
        } catch (java.util.concurrent.RejectedExecutionException ignored) {
            // A stale lifecycle callback can arrive after onDestroy has shut down the worker.
        }
    }

    private void showLoadError(String message) {
        if ("home".equals(activeTab) && !startupLoadAttemptedRetry) {
            startupLoadAttemptedRetry = true;
            statusText.setText("Syncing");
            mainHandler.postDelayed(() -> refreshFirebaseTokenThen(this::loadData), 1200);
            return;
        }
        if ("onboarding".equals(activeTab)) {
            showOnboardingLoadError(message);
            return;
        }
        Toast.makeText(this, userFacingError(message), Toast.LENGTH_LONG).show();
        showHomeLoadError(message);
    }

    private void showHomeLoadError(String message) {
        bottomNav.setVisibility(View.VISIBLE);
        setScreenTitle("Home");
        content.removeAllViews();
        content.addView(titleBlock("Could not refresh", "We could not load the latest assistant state."));
        content.addView(quietPanel("Sync issue", userFacingError(message)));
        LinearLayout actions = panel();
        Button retry = primaryButton("Try again");
        retry.setOnClickListener(view -> refreshFirebaseTokenThen(this::loadData));
        actions.addView(retry, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)));
        content.addView(actions);
    }

    private void showOnboardingLoadError(String message) {
        if (!"onboarding".equals(activeTab)) {
            Toast.makeText(this, userFacingError(message), Toast.LENGTH_LONG).show();
            return;
        }
        bottomNav.setVisibility(View.GONE);
        setScreenTitle("Welcome");
        content.removeAllViews();
        content.addView(titleBlock("Could not finish setup", "We could not load your setup state. You can retry or start over."));
        content.addView(quietPanel("Setup issue", userFacingError(message)));
        LinearLayout actions = panel();
        Button retry = primaryButton("Try again");
        retry.setOnClickListener(view -> refreshFirebaseTokenThen(this::loadData));
        actions.addView(retry, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)));
        Button startOver = secondaryButton("Start over");
        startOver.setOnClickListener(view -> {
            if (firebaseAuth != null) {
                firebaseAuth.signOut();
            }
            authToken = "";
            currentUser = UserSummary.empty();
            onboardingStatus = OnboardingStatus.empty();
            showOnboardingWelcome();
        });
        actions.addView(startOver, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)));
        content.addView(actions);
    }

    private String userFacingError(String message) {
        if (message == null || message.trim().length() == 0) {
            return "Something interrupted setup. Please try again.";
        }
        String lower = message.toLowerCase(Locale.US);
        if (lower.contains("http 401") || lower.contains("unauthorized") || lower.contains("token")) {
            return "Your session needs to be refreshed. Please sign in again.";
        }
        if (lower.contains("http 429") || lower.contains("rate")) {
            return "Too many attempts happened at once. Wait a moment, then try again.";
        }
        if (lower.contains("http 5") || lower.contains("internal server")) {
            return "The service is having trouble right now. Try again in a moment.";
        }
        if (lower.contains("timeout") || lower.contains("timed out")) {
            return "The connection took too long. Check your signal and try again.";
        }
        return "Something interrupted setup. Please try again.";
    }

    private void refreshLiveStateFromPush() {
        executor.execute(() -> {
            try {
                ActiveCall loadedActiveCall = fetchActiveCall();
                List<ApprovalRequest> loadedApprovals = fetchApprovalRequests();
                List<AnswerRequest> loadedAnswers = fetchAnswerRequests();
                List<CalendarEventRequest> loadedCalendarEvents = fetchCalendarEventRequests();
                List<AppNotification> loadedNotifications = fetchNotifications();
                mainHandler.post(() -> {
                    activeCall = loadedActiveCall;
                    approvalRequests.clear();
                    approvalRequests.addAll(loadedApprovals);
                    answerRequests.clear();
                    answerRequests.addAll(loadedAnswers);
                    calendarEventRequests.clear();
                    calendarEventRequests.addAll(loadedCalendarEvents);
                    appNotifications.clear();
                    appNotifications.addAll(loadedNotifications);
                    notifyForNewProductNotifications(loadedNotifications);
                    renderActiveCallBanner();
        if ("assistant".equals(activeTab) || "live".equals(activeTab)) {
                        if (pendingNotificationTarget.startsWith("assistant/answers")) {
                            String target = pendingNotificationTarget;
                            pendingNotificationTarget = "";
                            showAnswers(lastPathSegment(target));
                        } else if (pendingNotificationTarget.startsWith("assistant/approvals")) {
                            String target = pendingNotificationTarget;
                            pendingNotificationTarget = "";
                            showApprovals(lastPathSegment(target));
                        } else {
                            showAssistant(false);
                        }
                    } else if ("approvals".equals(activeTab)) {
                        showApprovals();
                    } else if ("answers".equals(activeTab)) {
                        showAnswers();
                    } else if ("calendar".equals(activeTab)) {
                        showCalendar();
                    }
                });
            } catch (Exception ignored) {
                Log.w(LOG_TAG, "Push-triggered refresh failed", ignored);
            }
        });
    }

    private UserSummary fetchUserSummary() throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/me");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        connection.setRequestProperty("x-phone-agent-action-surface", "app_screen");
        applyAuth(connection);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException(readError(connection, status));
        }

        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                body.append(line);
            }
        }

        JSONObject user = new JSONObject(body.toString()).optJSONObject("user");
        return user == null ? UserSummary.empty() : UserSummary.fromJson(user);
    }

    private BillingAccount fetchBillingAccount() throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/billing/account");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        connection.setRequestProperty("x-phone-agent-action-surface", "app_screen");
        applyAuth(connection);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("HTTP " + status);
        }

        JSONObject account = readJson(connection).optJSONObject("account");
        return account == null ? BillingAccount.empty() : BillingAccount.fromJson(account);
    }

    private List<AppNotification> fetchNotifications() throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/notifications?unread=true");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        applyAuth(connection);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("HTTP " + status);
        }

        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                body.append(line);
            }
        }

        JSONArray items = new JSONObject(body.toString()).optJSONArray("notifications");
        List<AppNotification> results = new ArrayList<>();
        if (items == null) {
            return results;
        }
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item != null) {
                results.add(AppNotification.fromJson(item));
            }
        }
        return results;
    }

    private ActiveCall fetchActiveCall() throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/calls/active");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        applyAuth(connection);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("HTTP " + status);
        }

        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                body.append(line);
            }
        }

        JSONObject active = new JSONObject(body.toString()).optJSONObject("activeCall");
        return active == null ? null : ActiveCall.fromJson(active);
    }

    private OnboardingStatus fetchOnboardingStatus() throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/onboarding/status");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        applyAuth(connection);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("HTTP " + status);
        }

        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                body.append(line);
            }
        }

        JSONObject statusObject = new JSONObject(body.toString()).optJSONObject("status");
        return statusObject == null ? OnboardingStatus.empty() : OnboardingStatus.fromJson(statusObject);
    }

    private List<CommunicationItem> fetchCommunicationItems() throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/communications");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        applyAuth(connection);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("HTTP " + status);
        }

        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                body.append(line);
            }
        }

        JSONArray items = new JSONObject(body.toString()).optJSONArray("communicationItems");
        List<CommunicationItem> results = new ArrayList<>();
        if (items == null) {
            return results;
        }

        for (int i = 0; i < items.length(); i++) {
            results.add(CommunicationItem.fromJson(items.getJSONObject(i)));
        }
        return results;
    }

    private List<TopicThread> fetchTopicThreads() throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/topics");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        applyAuth(connection);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("HTTP " + status);
        }

        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                body.append(line);
            }
        }

        JSONArray items = new JSONObject(body.toString()).optJSONArray("topics");
        List<TopicThread> results = new ArrayList<>();
        if (items == null) {
            return results;
        }

        for (int i = 0; i < items.length(); i++) {
            results.add(TopicThread.fromJson(items.getJSONObject(i)));
        }
        return results;
    }

    private List<TopicSuggestion> fetchTopicSuggestions() throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/topic-suggestions");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        applyAuth(connection);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("HTTP " + status);
        }

        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                body.append(line);
            }
        }

        JSONArray items = new JSONObject(body.toString()).optJSONArray("suggestions");
        List<TopicSuggestion> results = new ArrayList<>();
        if (items == null) {
            return results;
        }

        for (int i = 0; i < items.length(); i++) {
            results.add(TopicSuggestion.fromJson(items.getJSONObject(i)));
        }
        return results;
    }

    private List<CallRecord> fetchCalls() throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/calls");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        applyAuth(connection);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("HTTP " + status);
        }

        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                body.append(line);
            }
        }

        JSONArray items = new JSONObject(body.toString()).optJSONArray("calls");
        List<CallRecord> results = new ArrayList<>();
        if (items == null) {
            return results;
        }

        for (int i = 0; i < items.length(); i++) {
            results.add(CallRecord.fromJson(items.getJSONObject(i)));
        }
        return results;
    }

    private List<CallerProfile> fetchCallerProfiles() throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/callers");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        applyAuth(connection);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("HTTP " + status);
        }

        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                body.append(line);
            }
        }

        JSONArray items = new JSONObject(body.toString()).optJSONArray("callers");
        List<CallerProfile> results = new ArrayList<>();
        if (items == null) {
            return results;
        }

        for (int i = 0; i < items.length(); i++) {
            results.add(CallerProfile.fromJson(items.getJSONObject(i)));
        }
        return results;
    }

    private List<ApprovalRequest> fetchApprovalRequests() throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/approval-requests");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        applyAuth(connection);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("HTTP " + status);
        }

        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                body.append(line);
            }
        }

        JSONArray items = new JSONObject(body.toString()).optJSONArray("approvalRequests");
        List<ApprovalRequest> results = new ArrayList<>();
        if (items == null) {
            return results;
        }

        for (int i = 0; i < items.length(); i++) {
            results.add(ApprovalRequest.fromJson(items.getJSONObject(i)));
        }
        return results;
    }

    private List<AnswerRequest> fetchAnswerRequests() throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/answer-requests");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        applyAuth(connection);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("HTTP " + status);
        }

        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                body.append(line);
            }
        }

        JSONArray items = new JSONObject(body.toString()).optJSONArray("answerRequests");
        List<AnswerRequest> results = new ArrayList<>();
        if (items == null) {
            return results;
        }

        for (int i = 0; i < items.length(); i++) {
            results.add(AnswerRequest.fromJson(items.getJSONObject(i)));
        }
        return results;
    }

    private List<AgentNote> fetchAgentNotes() throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/agent-notes");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        applyAuth(connection);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("HTTP " + status);
        }

        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                body.append(line);
            }
        }

        JSONArray items = new JSONObject(body.toString()).optJSONArray("notes");
        List<AgentNote> results = new ArrayList<>();
        if (items == null) {
            return results;
        }

        for (int i = 0; i < items.length(); i++) {
            results.add(AgentNote.fromJson(items.getJSONObject(i)));
        }
        return results;
    }

    private CalendarStatus fetchCalendarStatus() throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/calendar/status");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        applyAuth(connection);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("HTTP " + status);
        }

        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                body.append(line);
            }
        }
        return CalendarStatus.fromJson(new JSONObject(body.toString()));
    }

    private int fetchContactSyncCount() throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/contacts/status");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        applyAuth(connection);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("HTTP " + status);
        }

        JSONObject response = readJson(connection);
        JSONObject statusObject = response.optJSONObject("status");
        return statusObject == null ? 0 : statusObject.optInt("syncedCount", 0);
    }

    private List<CalendarEventRequest> fetchCalendarEventRequests() throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/calendar/event-requests");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        applyAuth(connection);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("HTTP " + status);
        }

        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                body.append(line);
            }
        }

        JSONArray items = new JSONObject(body.toString()).optJSONArray("eventRequests");
        List<CalendarEventRequest> results = new ArrayList<>();
        if (items == null) {
            return results;
        }

        for (int i = 0; i < items.length(); i++) {
            results.add(CalendarEventRequest.fromJson(items.getJSONObject(i)));
        }
        return results;
    }

    private void decideApproval(String approvalId, boolean accept) {
        loading.setVisibility(View.VISIBLE);
        statusText.setText(accept ? "Accepting" : "Declining");
        executor.execute(() -> {
            try {
                postApprovalDecision(approvalId, accept);
                mainHandler.post(() -> {
                    Toast.makeText(this, accept ? "Transfer accepted" : "Transfer declined", Toast.LENGTH_SHORT).show();
                    loadData();
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    statusText.setText("Live");
                    Toast.makeText(this, "Could not update transfer: " + error.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private void replyToAnswerRequest(String answerRequestId, String answer) {
        if (answer == null || answer.trim().length() == 0) {
            Toast.makeText(this, "Type an answer first", Toast.LENGTH_SHORT).show();
            return;
        }

        loading.setVisibility(View.VISIBLE);
        statusText.setText("Sending");
        executor.execute(() -> {
            try {
                postAnswerReply(answerRequestId, answer.trim());
                mainHandler.post(() -> {
                    Toast.makeText(this, "Answer sent to assistant", Toast.LENGTH_SHORT).show();
                    loadData();
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    statusText.setText("Live");
                    Toast.makeText(this, "Could not send answer: " + error.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private void declineAnswerRequest(String answerRequestId) {
        loading.setVisibility(View.VISIBLE);
        statusText.setText("Declining");
        executor.execute(() -> {
            try {
                postAnswerDecline(answerRequestId);
                mainHandler.post(() -> {
                    Toast.makeText(this, "Question declined", Toast.LENGTH_SHORT).show();
                    loadData();
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    statusText.setText("Live");
                    Toast.makeText(this, "Could not decline question: " + error.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private void createTopic(String title, String description) {
        if (title == null || title.trim().length() == 0) {
            Toast.makeText(this, "Name the topic first", Toast.LENGTH_SHORT).show();
            return;
        }

        loading.setVisibility(View.VISIBLE);
        statusText.setText("Creating");
        executor.execute(() -> {
            try {
                postTopic(title.trim(), description == null ? "" : description.trim());
                mainHandler.post(() -> {
                    Toast.makeText(this, "Topic created", Toast.LENGTH_SHORT).show();
                    loadData();
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    statusText.setText("Live");
                    Toast.makeText(this, "Could not create topic: " + error.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private void attachCommunicationToTopic(String communicationItemId, String topicThreadId) {
        loading.setVisibility(View.VISIBLE);
        statusText.setText("Attaching");
        executor.execute(() -> {
            try {
                postTopicAttachment(communicationItemId, topicThreadId);
                mainHandler.post(() -> {
                    Toast.makeText(this, "Communication attached", Toast.LENGTH_SHORT).show();
                    loadData();
                    activeTab = "threads";
                    renderTabs();
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    statusText.setText(onboardingStatus.readyForBetaUse ? "Active" : "Setup");
                    Toast.makeText(this, "Could not attach communication: " + error.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private void decideTopicSuggestion(String suggestionId, boolean accept) {
        loading.setVisibility(View.VISIBLE);
        statusText.setText(accept ? "Accepting" : "Dismissing");
        executor.execute(() -> {
            try {
                postTopicSuggestionDecision(suggestionId, accept);
                mainHandler.post(() -> {
                    Toast.makeText(this, accept ? "Suggestion accepted" : "Suggestion dismissed", Toast.LENGTH_SHORT).show();
                    loadData();
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    statusText.setText("Live");
                    Toast.makeText(this, "Could not update suggestion: " + error.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private void createAgentNote(String noteText, String targetPhoneNumber) {
        if (noteText == null || noteText.trim().length() == 0) {
            Toast.makeText(this, "Write a note first", Toast.LENGTH_SHORT).show();
            return;
        }

        loading.setVisibility(View.VISIBLE);
        statusText.setText("Saving");
        executor.execute(() -> {
            try {
                postAgentNote(noteText.trim(), targetPhoneNumber == null ? "" : targetPhoneNumber.trim());
                mainHandler.post(() -> {
                    Toast.makeText(this, "Assistant note saved", Toast.LENGTH_SHORT).show();
                    loadData();
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    statusText.setText("Live");
                    Toast.makeText(this, "Could not save note: " + error.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private void archiveAgentNote(String noteId) {
        loading.setVisibility(View.VISIBLE);
        statusText.setText("Archiving");
        executor.execute(() -> {
            try {
                deleteAgentNote(noteId);
                mainHandler.post(() -> {
                    Toast.makeText(this, "Note archived", Toast.LENGTH_SHORT).show();
                    loadData();
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    statusText.setText("Live");
                    Toast.makeText(this, "Could not archive note: " + error.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private void openCalendarConnectUrl() {
        loading.setVisibility(View.VISIBLE);
        statusText.setText("Opening");
        executor.execute(() -> {
            try {
                URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/calendar/connect-url");
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(8000);
                connection.setRequestProperty("accept", "application/json");
                applyAuth(connection);
                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) {
                    throw new IllegalStateException("Calendar connection is not configured yet");
                }
                StringBuilder body = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        body.append(line);
                    }
                }
                String connectUrl = new JSONObject(body.toString()).optString("url");
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    statusText.setText("Live");
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(connectUrl)));
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    statusText.setText("Live");
                    Toast.makeText(this, "Could not open calendar connect: " + error.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private void updateSpendingCap(int cents, boolean continueToActivation) {
        if (cents < 500) {
            Toast.makeText(this, "Minimum cap is $5.", Toast.LENGTH_LONG).show();
            return;
        }
        loading.setVisibility(View.VISIBLE);
        statusText.setText("Saving");
        executor.execute(() -> {
            try {
                JSONObject payload = new JSONObject();
                payload.put("monthlySpendingCapCents", cents);
                JSONObject response = patchJsonForObject(new URL(BuildConfig.BACKEND_BASE_URL + "/v1/billing/spending-limit"), payload);
                JSONObject account = response.optJSONObject("account");
                billingAccount = account == null ? billingAccount : BillingAccount.fromJson(account);
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    Toast.makeText(this, "Spending cap saved", Toast.LENGTH_SHORT).show();
                    showBillingSetup(continueToActivation);
                    loadData();
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    Toast.makeText(this, "Could not save cap: " + error.getMessage(), Toast.LENGTH_LONG).show();
                    showBillingSetup(continueToActivation);
                });
            }
        });
    }

    private void openBillingCheckout() {
        loading.setVisibility(View.VISIBLE);
        statusText.setText("Opening");
        executor.execute(() -> {
            try {
                JSONObject response = postJsonForObject(new URL(BuildConfig.BACKEND_BASE_URL + "/v1/billing/checkout-session"), new JSONObject(), true);
                JSONObject session = response.optJSONObject("session");
                String checkoutUrl = session == null ? "" : session.optString("url");
                if (checkoutUrl.length() == 0) {
                    throw new IllegalStateException("Payment setup did not return a secure URL.");
                }
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    statusText.setText("Billing");
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(checkoutUrl)));
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    Toast.makeText(this, "Could not open payment setup: " + error.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private void activateBilling(boolean continueToActivation) {
        loading.setVisibility(View.VISIBLE);
        statusText.setText("Checking");
        executor.execute(() -> {
            try {
                JSONObject response = postJsonForObject(new URL(BuildConfig.BACKEND_BASE_URL + "/v1/billing/activate"), new JSONObject(), true);
                JSONObject account = response.optJSONObject("account");
                billingAccount = account == null ? billingAccount : BillingAccount.fromJson(account);
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    Toast.makeText(this, billingAccount.isActive() ? "Billing ready" : "Billing still needs a card and cap", Toast.LENGTH_SHORT).show();
                    if (continueToActivation && billingAccount.isActive()) {
                        showAssistantNumberSetup(true);
                    } else {
                        showBillingSetup(continueToActivation);
                    }
                    loadData();
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    Toast.makeText(this, "Could not check billing: " + error.getMessage(), Toast.LENGTH_LONG).show();
                    showBillingSetup(continueToActivation);
                });
            }
        });
    }

    private void decideCalendarEvent(String requestId, boolean accept) {
        loading.setVisibility(View.VISIBLE);
        statusText.setText(accept ? "Creating" : "Declining");
        executor.execute(() -> {
            try {
                postCalendarEventDecision(requestId, accept);
                mainHandler.post(() -> {
                    Toast.makeText(this, accept ? "Calendar event approved" : "Calendar event declined", Toast.LENGTH_SHORT).show();
                    loadData();
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    statusText.setText("Live");
                    Toast.makeText(this, "Could not update event: " + error.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private void postApprovalDecision(String approvalId, boolean accept) throws Exception {
        String action = accept ? "accept" : "decline";
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/approval-requests/" + approvalId + "/" + action);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        applyAuth(connection);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("HTTP " + status);
        }
    }

    private void postCalendarEventDecision(String requestId, boolean accept) throws Exception {
        String action = accept ? "accept" : "decline";
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/calendar/event-requests/" + requestId + "/" + action);
        postJson(url, null);
    }

    private void postAnswerReply(String answerRequestId, String answer) throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/answer-requests/" + answerRequestId + "/reply");
        JSONObject payload = new JSONObject();
        payload.put("answer", answer);
        postJson(url, payload);
    }

    private void postAnswerDecline(String answerRequestId) throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/answer-requests/" + answerRequestId + "/decline");
        postJson(url, null);
    }

    private void postTopic(String title, String description) throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/topics");
        JSONObject payload = new JSONObject();
        payload.put("title", title);
        if (description.length() > 0) {
            payload.put("description", description);
        }
        postJson(url, payload);
    }

    private void postTopicAttachment(String communicationItemId, String topicThreadId) throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/topics/" + topicThreadId + "/communications");
        JSONObject payload = new JSONObject();
        payload.put("communicationItemId", communicationItemId);
        payload.put("confidence", 1.0);
        payload.put("reason", "Attached from Android app.");
        postJson(url, payload);
    }

    private void postTopicSuggestionDecision(String suggestionId, boolean accept) throws Exception {
        String action = accept ? "accept" : "dismiss";
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/topic-suggestions/" + suggestionId + "/" + action);
        postJson(url, null);
    }

    private void postAgentNote(String noteText, String targetPhoneNumber) throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/agent-notes");
        JSONObject payload = new JSONObject();
        payload.put("text", noteText);
        if (targetPhoneNumber.length() > 0) {
            payload.put("targetPhoneNumber", targetPhoneNumber);
        }
        postJson(url, payload);
    }

    private void deleteAgentNote(String noteId) throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/agent-notes/" + noteId);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("DELETE");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        applyAuth(connection);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("HTTP " + status);
        }
    }

    private void requestContactsSync() {
        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.READ_CONTACTS}, REQUEST_CONTACTS);
            return;
        }
        syncPhoneContacts();
    }

    private void syncPhoneContacts() {
        loading.setVisibility(View.VISIBLE);
        statusText.setText("Syncing");
        executor.execute(() -> {
            try {
                List<DeviceContact> contacts = readDeviceContacts();
                int syncedCount = postContactSync(contacts);
                mainHandler.post(() -> {
                    contactSyncCount = syncedCount;
                    loading.setVisibility(View.GONE);
                    statusText.setText(onboardingStatus.readyForBetaUse ? "Active" : "Setup");
                    Toast.makeText(this, syncedCount + " contacts synced", Toast.LENGTH_SHORT).show();
                    if ("assistant".equals(activeTab)) {
                        showAssistant();
                    }
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    statusText.setText(onboardingStatus.readyForBetaUse ? "Active" : "Setup");
                    Toast.makeText(this, "Could not sync contacts: " + error.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private List<DeviceContact> readDeviceContacts() {
        Map<String, DeviceContact> contacts = new LinkedHashMap<>();
        ContentResolver resolver = getContentResolver();
        String[] projection = new String[]{
                ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                ContactsContract.CommonDataKinds.Phone.NUMBER,
                ContactsContract.CommonDataKinds.Phone.TYPE,
                ContactsContract.CommonDataKinds.Phone.LABEL
        };
        try (Cursor cursor = resolver.query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                projection,
                null,
                null,
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC"
        )) {
            if (cursor == null) {
                return new ArrayList<>();
            }

            int idColumn = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.CONTACT_ID);
            int nameColumn = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME);
            int numberColumn = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);
            int typeColumn = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.TYPE);
            int labelColumn = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.LABEL);

            while (cursor.moveToNext()) {
                String contactId = cursor.getString(idColumn);
                String displayName = cursor.getString(nameColumn);
                String number = cursor.getString(numberColumn);
                if (contactId == null || displayName == null || displayName.trim().length() == 0 || number == null || number.trim().length() == 0) {
                    continue;
                }
                int type = typeColumn >= 0 ? cursor.getInt(typeColumn) : ContactsContract.CommonDataKinds.Phone.TYPE_OTHER;
                String customLabel = labelColumn >= 0 ? cursor.getString(labelColumn) : null;
                String label = ContactsContract.CommonDataKinds.Phone.getTypeLabel(getResources(), type, customLabel).toString();
                DeviceContact contact = contacts.get(contactId);
                if (contact == null) {
                    contact = new DeviceContact(contactId, displayName.trim());
                    contacts.put(contactId, contact);
                }
                contact.phoneNumbers.add(new DevicePhoneNumber(number.trim(), label));
            }
        }
        return new ArrayList<>(contacts.values());
    }

    private int postContactSync(List<DeviceContact> contacts) throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/contacts/sync");
        JSONArray items = new JSONArray();
        for (DeviceContact contact : contacts) {
            items.put(contact.toJson());
        }
        JSONObject payload = new JSONObject();
        payload.put("contacts", items);
        JSONObject response = postJsonForObject(url, payload, true);
        JSONObject result = response.optJSONObject("result");
        return result == null ? 0 : result.optInt("syncedCount", 0);
    }

    private void postJson(URL url, JSONObject payload) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        applyAuth(connection);
        if (payload != null) {
            connection.setRequestProperty("content-type", "application/json");
            connection.setDoOutput(true);
            byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body);
            }
        }

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("HTTP " + status);
        }
    }

    private JSONObject postJsonForObject(URL url, JSONObject payload, boolean authenticated) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        if (authenticated) {
            applyAuth(connection);
        }
        connection.setRequestProperty("content-type", "application/json");
        connection.setDoOutput(true);
        byte[] body = (payload == null ? "{}" : payload.toString()).getBytes(StandardCharsets.UTF_8);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(body);
        }

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException(readError(connection, status));
        }
        return readJson(connection);
    }

    private JSONObject patchJsonForObject(URL url, JSONObject payload) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("PATCH");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        applyAuth(connection);
        connection.setRequestProperty("content-type", "application/json");
        connection.setDoOutput(true);
        byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(body);
        }

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException(readError(connection, status));
        }
        return readJson(connection);
    }

    private JSONObject readJson(HttpURLConnection connection) throws Exception {
        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                body.append(line);
            }
        }
        return new JSONObject(body.toString());
    }

    private String readError(HttpURLConnection connection, int status) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getErrorStream()))) {
            String line = reader.readLine();
            if (line != null && line.length() > 0) {
                return readableError(line, status);
            }
        } catch (Exception ignored) {
        }
        return "HTTP " + status;
    }

    private String readableError(String body, int status) {
        try {
            JSONObject json = new JSONObject(body);
            JSONObject error = json.optJSONObject("error");
            if (error != null) {
                String message = error.optString("message", "");
                if (message.length() > 0) {
                    return message;
                }
            }
        } catch (Exception ignored) {
        }
        return "HTTP " + status;
    }

    private void applyAuth(HttpURLConnection connection) {
        if (authToken != null && authToken.length() > 0) {
            connection.setRequestProperty("authorization", "Bearer " + authToken);
        }
    }

    private void updateCallerRelationship(String callerId, String relationship, String trustLevel) {
        loading.setVisibility(View.VISIBLE);
        statusText.setText("Saving");
        executor.execute(() -> {
            try {
                patchCallerProfile(callerId, relationship, trustLevel);
                mainHandler.post(() -> {
                    Toast.makeText(this, "Caller updated", Toast.LENGTH_SHORT).show();
                    loadData();
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    statusText.setText("Live");
                    Toast.makeText(this, "Could not update caller: " + error.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private void patchCallerProfile(String callerId, String relationship, String trustLevel) throws Exception {
        URL url = new URL(BuildConfig.BACKEND_BASE_URL + "/v1/callers/" + callerId);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("PATCH");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("accept", "application/json");
        applyAuth(connection);
        connection.setRequestProperty("content-type", "application/json");
        connection.setDoOutput(true);

        JSONObject payload = new JSONObject();
        payload.put("relationship", relationship);
        payload.put("trustLevel", trustLevel);
        byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(body);
        }

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("HTTP " + status);
        }
    }

    private void startFirebasePhoneAuth(String displayName, String phoneNumber) {
        String normalizedPhoneNumber = normalizeFirebasePhoneNumber(phoneNumber);
        if (displayName.trim().length() == 0 || normalizedPhoneNumber.length() == 0) {
            Toast.makeText(this, "Name and mobile number are required.", Toast.LENGTH_LONG).show();
            return;
        }
        if (!isLikelyE164PhoneNumber(normalizedPhoneNumber)) {
            Toast.makeText(this, "Enter a valid mobile number, including area code.", Toast.LENGTH_LONG).show();
            return;
        }
        if (firebaseAuth == null) {
            showFirebaseConfigurationRequired();
            return;
        }
        pendingDisplayName = displayName.trim();
        pendingPhoneNumber = normalizedPhoneNumber;
        clearSignupDiagnostic();
        loading.setVisibility(View.VISIBLE);
        statusText.setText("Sending");
        final int attemptId = ++phoneAuthAttemptId;
        Log.i(LOG_TAG, "Starting Firebase phone auth attempt " + attemptId + " for " + maskedPhoneNumber(pendingPhoneNumber));
        mainHandler.postDelayed(() -> {
            if (attemptId != phoneAuthAttemptId) {
                return;
            }
            phoneAuthAttemptId++;
            loading.setVisibility(View.GONE);
            statusText.setText("Setup");
            String message = "The verification service did not respond within 30 seconds. Check Google Play Services, network access, and Firebase Phone Auth app verification, then try again.";
            recordSignupDiagnostic("Verification request timed out", message);
            Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show();
            showOnboardingWelcome();
        }, PHONE_AUTH_SEND_TIMEOUT_MS);
        try {
            PhoneAuthOptions options = PhoneAuthOptions.newBuilder(firebaseAuth)
                    .setPhoneNumber(pendingPhoneNumber)
                    .setTimeout(60L, TimeUnit.SECONDS)
                    .setActivity(this)
                    .setCallbacks(new PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                        @Override
                        public void onVerificationCompleted(PhoneAuthCredential credential) {
                            mainHandler.post(() -> {
                                if (!isCurrentPhoneAuthAttempt(attemptId)) {
                                    return;
                                }
                                phoneAuthAttemptId++;
                                Log.i(LOG_TAG, "Firebase phone auth auto-verification completed for attempt " + attemptId);
                                statusText.setText("Verifying");
                                signInWithFirebaseCredential(credential);
                            });
                        }

                        @Override
                        public void onVerificationFailed(FirebaseException error) {
                            mainHandler.post(() -> {
                                if (!isCurrentPhoneAuthAttempt(attemptId)) {
                                    return;
                                }
                                phoneAuthAttemptId++;
                                loading.setVisibility(View.GONE);
                                statusText.setText("Setup");
                                String message = readableAuthError(error);
                                recordSignupDiagnostic("Verification request failed", message);
                                Toast.makeText(MainActivity.this, "Could not send code: " + message, Toast.LENGTH_LONG).show();
                                showOnboardingWelcome();
                            });
                        }

                        @Override
                        public void onCodeSent(String verificationId, PhoneAuthProvider.ForceResendingToken token) {
                            mainHandler.post(() -> {
                                if (!isCurrentPhoneAuthAttempt(attemptId)) {
                                    return;
                                }
                                phoneAuthAttemptId++;
                                Log.i(LOG_TAG, "Firebase phone auth code sent for attempt " + attemptId);
                                loading.setVisibility(View.GONE);
                                statusText.setText("Verify");
                                statusText.setBackground(makeRounded(COLOR_WARN, 999));
                                Toast.makeText(MainActivity.this, "Verification code sent", Toast.LENGTH_SHORT).show();
                                showPhoneCodeEntry(verificationId);
                            });
                        }
                    })
                    .build();
            PhoneAuthProvider.verifyPhoneNumber(options);
        } catch (RuntimeException error) {
            phoneAuthAttemptId++;
            loading.setVisibility(View.GONE);
            statusText.setText("Setup");
            String message = readableAuthError(error);
            recordSignupDiagnostic("Verification request crashed before sending", message);
            Toast.makeText(this, "Could not send code: " + message, Toast.LENGTH_LONG).show();
            showOnboardingWelcome();
        }
    }

    private boolean isCurrentPhoneAuthAttempt(int attemptId) {
        return attemptId == phoneAuthAttemptId;
    }

    private void clearSignupDiagnostic() {
        getSharedPreferences(APP_PREFS, MODE_PRIVATE)
                .edit()
                .remove(PREF_LAST_SIGNUP_ERROR)
                .apply();
    }

    private void recordSignupDiagnostic(String title, String detail) {
        String message = title + "\n" + detail;
        Log.w(LOG_TAG, message);
        getSharedPreferences(APP_PREFS, MODE_PRIVATE)
                .edit()
                .putString(PREF_LAST_SIGNUP_ERROR, message)
                .apply();
    }

    private String maskedPhoneNumber(String value) {
        if (value == null || value.length() < 5) {
            return "unknown";
        }
        return "***" + value.substring(value.length() - 4);
    }

    private String normalizeFirebasePhoneNumber(String value) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.length() == 0) {
            return "";
        }
        String digits = trimmed.replaceAll("[^0-9]", "");
        if (trimmed.startsWith("+")) {
            return "+" + digits;
        }
        if (digits.length() == 10) {
            return "+1" + digits;
        }
        if (digits.length() == 11 && digits.startsWith("1")) {
            return "+" + digits;
        }
        return digits.length() > 0 ? "+" + digits : "";
    }

    private boolean isLikelyE164PhoneNumber(String value) {
        return value.matches("^\\+[1-9][0-9]{9,14}$");
    }

    private String readableAuthError(Exception error) {
        String message = error.getMessage();
        if (message == null || message.trim().length() == 0) {
            return "Please check the number and try again.";
        }
        return message;
    }

    private void completeFirebasePhoneAuth(String verificationId, String code) {
        if (code.trim().length() == 0) {
            Toast.makeText(this, "Enter the verification code.", Toast.LENGTH_LONG).show();
            return;
        }
        loading.setVisibility(View.VISIBLE);
        statusText.setText("Verifying");
        signInWithFirebaseCredential(PhoneAuthProvider.getCredential(verificationId, code.trim()));
    }

    private void signInWithFirebaseCredential(PhoneAuthCredential credential) {
        firebaseAuth.signInWithCredential(credential).addOnCompleteListener(task -> {
            if (!task.isSuccessful()) {
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    Toast.makeText(this, "Could not verify phone: " + errorMessage(task), Toast.LENGTH_LONG).show();
                });
                return;
            }
            FirebaseUser user = firebaseAuth.getCurrentUser();
            if (user == null) {
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    Toast.makeText(this, "Could not start session.", Toast.LENGTH_LONG).show();
                });
                return;
            }
            user.getIdToken(true).addOnCompleteListener(tokenTask -> {
                if (!tokenTask.isSuccessful() || tokenTask.getResult() == null) {
                    mainHandler.post(() -> {
                        loading.setVisibility(View.GONE);
                        Toast.makeText(this, "Could not start session: " + errorMessage(tokenTask), Toast.LENGTH_LONG).show();
                    });
                    return;
                }
                authToken = tokenTask.getResult().getToken();
                executor.execute(() -> {
                    try {
                        JSONObject payload = new JSONObject();
                        payload.put("displayName", pendingDisplayName);
                        JSONObject response = patchJsonForObject(new URL(BuildConfig.BACKEND_BASE_URL + "/v1/me/config"), payload);
                        JSONObject userJson = response.optJSONObject("user");
                        currentUser = userJson == null ? UserSummary.empty() : UserSummary.fromJson(userJson);
                        mainHandler.post(() -> {
                            loading.setVisibility(View.GONE);
                            Toast.makeText(this, "Phone verified", Toast.LENGTH_SHORT).show();
                            showAssistantProfileSetup();
                        });
                    } catch (Exception error) {
                        mainHandler.post(() -> {
                            loading.setVisibility(View.GONE);
                            Toast.makeText(this, "Could not create account: " + error.getMessage(), Toast.LENGTH_LONG).show();
                        });
                    }
                });
            });
        });
    }

    private String errorMessage(Task<?> task) {
        Exception error = task.getException();
        return error == null || error.getMessage() == null ? "Unknown error" : error.getMessage();
    }

    private void saveAssistantProfile(String assistantName, boolean continueToActivation) {
        loading.setVisibility(View.VISIBLE);
        statusText.setText("Saving");
        executor.execute(() -> {
            try {
                JSONObject payload = new JSONObject();
                payload.put("assistantName", assistantName.trim().length() > 0 ? assistantName.trim() : "Assistant");
                payload.put("greetingStyle", currentUser.greetingStyle.length() > 0 ? currentUser.greetingStyle : "warm");
                payload.put("disclosureStyle", "standard");
                payload.put("warmth", currentUser.warmth > 0 ? currentUser.warmth : 4);
                payload.put("brevity", 4);
                payload.put("proactivity", 3);
                JSONObject response = patchJsonForObject(new URL(BuildConfig.BACKEND_BASE_URL + "/v1/me/assistant-profile"), payload);
                JSONObject user = response.optJSONObject("user");
                currentUser = user == null ? currentUser : UserSummary.fromJson(user);
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    Toast.makeText(this, continueToActivation ? "Assistant named" : "Assistant saved", Toast.LENGTH_SHORT).show();
                    if (continueToActivation) {
                        if (billingStepRequiredAndIncomplete()) {
                            showBillingSetup(true);
                            loadData();
                        } else if (currentUser.retellPhoneNumber.length() > 0) {
                            showForwarding(true);
                            loadData();
                        } else {
                            requestAssistantNumber("", true);
                        }
                    } else {
                        activeTab = "assistant";
                        renderTabs();
                        showAssistant();
                        loadData();
                    }
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    Toast.makeText(this, "Could not save assistant: " + error.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private void requestAssistantNumber(String areaCodeText) {
        requestAssistantNumber(areaCodeText, true);
    }

    private void requestAssistantNumber(String areaCodeText, boolean continueToActivation) {
        loading.setVisibility(View.VISIBLE);
        statusText.setText("Assigning");
        executor.execute(() -> {
            try {
                JSONObject payload = new JSONObject();
                if (areaCodeText.trim().length() > 0) {
                    payload.put("areaCode", Integer.parseInt(areaCodeText.trim()));
                }
                JSONObject response = postJsonForObject(new URL(BuildConfig.BACKEND_BASE_URL + "/v1/onboarding/assistant-number"), payload, true);
                JSONObject user = response.optJSONObject("user");
                currentUser = user == null ? currentUser : UserSummary.fromJson(user);
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    Toast.makeText(this, "Assistant number assigned", Toast.LENGTH_SHORT).show();
                    showForwarding(continueToActivation);
                    loadData();
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    loading.setVisibility(View.GONE);
                    Toast.makeText(this, "Could not assign number: " + error.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    private void dismissNotification(String notificationId) {
        executor.execute(() -> {
            try {
                postJson(new URL(BuildConfig.BACKEND_BASE_URL + "/v1/notifications/" + notificationId + "/dismiss"), new JSONObject());
                mainHandler.post(() -> {
                    Toast.makeText(this, "Notification dismissed", Toast.LENGTH_SHORT).show();
                    loadData();
                });
            } catch (Exception error) {
                mainHandler.post(() -> Toast.makeText(this, "Could not dismiss notification: " + error.getMessage(), Toast.LENGTH_LONG).show());
            }
        });
    }

    private LinearLayout panel() {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(18), dp(18), dp(18), dp(18));
        panel.setBackground(makeRoundedStroke(COLOR_CARD, COLOR_LINE, 18));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            panel.setElevation(dp(1));
        }
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, 0, 0, dp(12));
        panel.setLayoutParams(params);
        return panel;
    }

    private LinearLayout row() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        return row;
    }

    private void setScreenTitle(String title) {
        setScreenTitle(title, true);
    }

    private void setScreenTitle(String title, boolean resetScroll) {
        if (headerTitle != null) {
            headerTitle.setText(title);
        }
        if (!FirebaseApp.getApps(this).isEmpty()) {
            FirebaseCrashlytics.getInstance().setCustomKey("screen", title);
        }
        if (resetScroll && scrollView != null) {
            scrollView.post(() -> scrollView.scrollTo(0, 0));
        }
    }

    private void recordCrashBreadcrumb(String action) {
        if (FirebaseApp.getApps(this).isEmpty()) {
            return;
        }
        FirebaseCrashlytics.getInstance().log("action:" + action);
    }

    private View titleBlock(String title, String subtitle) {
        LinearLayout block = new LinearLayout(this);
        block.setOrientation(LinearLayout.VERTICAL);
        block.setPadding(0, 0, 0, dp(16));
        block.addView(text(title, 22, COLOR_ON_ATMOSPHERE, Typeface.BOLD));
        TextView subtitleView = text(subtitle, 15, COLOR_ON_ATMOSPHERE_MUTED, Typeface.NORMAL);
        subtitleView.setLineSpacing(dp(3), 1.0f);
        subtitleView.setPadding(0, dp(5), 0, 0);
        block.addView(subtitleView);
        return block;
    }

    private TextView sectionLine(String label, String value) {
        TextView view = text(label + "\n" + value, 15, COLOR_INK, Typeface.NORMAL);
        view.setPadding(0, dp(8), 0, dp(4));
        view.setLineSpacing(dp(2), 1.0f);
        return view;
    }

    private TextView sectionHeader(String value) {
        TextView text = text(value, 13, COLOR_ON_ATMOSPHERE_MUTED, Typeface.BOLD);
        text.setAllCaps(true);
        text.setPadding(0, dp(16), 0, dp(8));
        return text;
    }

    private TextView label(String value) {
        TextView text = text(value, 12, COLOR_MUTED, Typeface.BOLD);
        text.setAllCaps(true);
        text.setPadding(0, dp(6), 0, dp(3));
        return text;
    }

    private TextView body(String value) {
        TextView text = text(value, 15, COLOR_MUTED, Typeface.NORMAL);
        text.setLineSpacing(dp(3), 1.0f);
        text.setPadding(0, dp(5), 0, 0);
        return text;
    }

    private TextView text(String value, int sp, int color, int style) {
        TextView text = new TextView(this);
        text.setText(value);
        text.setTextSize(sp);
        text.setTextColor(color);
        text.setTypeface(Typeface.DEFAULT, style);
        text.setIncludeFontPadding(false);
        return text;
    }

    private EditText input(String hint) {
        EditText input = new EditText(this);
        input.setHint(hint);
        input.setTextSize(15);
        input.setTextColor(COLOR_INK);
        input.setHintTextColor(COLOR_MUTED);
        input.setSingleLine(false);
        input.setBackground(makeRoundedStroke(COLOR_CARD, COLOR_LINE, 14));
        input.setPadding(dp(12), dp(10), dp(12), dp(10));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, 0, 0, dp(10));
        input.setLayoutParams(params);
        return input;
    }

    private Button smallButton(String label) {
        return primaryButton(label);
    }

    private Button primaryButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(14);
        button.setTextColor(Color.WHITE);
        button.setBackground(makeRounded(COLOR_BLUE, 14));
        polishButton(button);
        button.setPadding(dp(12), 0, dp(12), 0);
        return button;
    }

    private Button secondaryButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(14);
        button.setTextColor(COLOR_INK);
        button.setBackground(makeRoundedStroke(COLOR_CARD, COLOR_LINE, 14));
        polishButton(button);
        button.setPadding(dp(12), 0, dp(12), 0);
        return button;
    }

    private void polishButton(Button button) {
        button.setMinWidth(0);
        button.setMinimumWidth(0);
        button.setMinHeight(0);
        button.setMinimumHeight(0);
        button.setGravity(Gravity.CENTER);
        button.setIncludeFontPadding(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            button.setStateListAnimator(null);
            button.setElevation(0);
        }
    }

    private void addEmptyState(String title, String message) {
        LinearLayout empty = panel();
        empty.setGravity(Gravity.CENTER_HORIZONTAL);
        TextView titleView = text(title, 18, COLOR_INK, Typeface.BOLD);
        titleView.setGravity(Gravity.CENTER);
        empty.addView(titleView);
        TextView messageView = body(message);
        messageView.setGravity(Gravity.CENTER);
        empty.addView(messageView);
        content.addView(empty);
    }

    private View quietPanel(String title, String message) {
        LinearLayout quiet = panel();
        quiet.setBackground(makeRoundedStroke(COLOR_SUBTLE, COLOR_LINE, 8));
        quiet.addView(text(title, 16, COLOR_INK, Typeface.BOLD));
        quiet.addView(body(message));
        return quiet;
    }

    private android.graphics.drawable.GradientDrawable makeCalmBackground() {
        android.graphics.drawable.GradientDrawable drawable = new android.graphics.drawable.GradientDrawable(
                android.graphics.drawable.GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{COLOR_TWILIGHT_TOP, COLOR_TWILIGHT_MID, COLOR_TWILIGHT_BOTTOM}
        );
        return drawable;
    }

    private android.graphics.drawable.GradientDrawable makeRounded(int color, int radiusDp) {
        android.graphics.drawable.GradientDrawable drawable = new android.graphics.drawable.GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radiusDp));
        return drawable;
    }

    private android.graphics.drawable.GradientDrawable makeRoundedStroke(int color, int strokeColor, int radiusDp) {
        android.graphics.drawable.GradientDrawable drawable = makeRounded(color, radiusDp);
        drawable.setStroke(dp(1), strokeColor);
        return drawable;
    }

    private void dial(String value) {
        Intent intent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(value)));
        startActivity(intent);
    }

    private void copyText(String value) {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        clipboard.setPrimaryClip(ClipData.newPlainText("Phone Agent", value));
        Toast.makeText(this, "Copied", Toast.LENGTH_SHORT).show();
    }

    private TopicThread findTopic(String topicId) {
        for (TopicThread topic : topicThreads) {
            if (topic.id.equals(topicId)) {
                return topic;
            }
        }
        return null;
    }

    private CommunicationItem findCommunication(String communicationItemId) {
        for (CommunicationItem item : communicationItems) {
            if (item.id.equals(communicationItemId)) {
                return item;
            }
        }
        return null;
    }

    private void handleIntent(Intent intent) {
        if (intent == null) {
            return;
        }
        String action = intent.getAction();
        String approvalId = intent.getStringExtra(EXTRA_APPROVAL_ID);
        String answerId = intent.getStringExtra(EXTRA_ANSWER_ID);
        String notificationTarget = intent.getStringExtra(EXTRA_NOTIFICATION_TARGET);
        if (approvalId != null && approvalId.length() > 0 && ACTION_APPROVE_TRANSFER.equals(action)) {
            activeTab = "assistant";
            decideApproval(approvalId, true);
        } else if (approvalId != null && approvalId.length() > 0 && ACTION_DECLINE_TRANSFER.equals(action)) {
            activeTab = "assistant";
            decideApproval(approvalId, false);
        } else if (answerId != null && answerId.length() > 0) {
            activeTab = "assistant";
            pendingNotificationTarget = "assistant/answers/" + answerId;
            if (authToken.length() > 0) {
                renderTabs();
                loadData();
            }
        } else if (notificationTarget != null && notificationTarget.length() > 0) {
            activeTab = "assistant";
            pendingNotificationTarget = notificationTarget;
            if (authToken.length() > 0) {
                renderTabs();
                loadData();
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < 26) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Live call requests",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Alerts when Phone Agent needs approval or a quick answer during a live call.");
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        manager.createNotificationChannel(channel);
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQUEST_NOTIFICATIONS);
        }
    }

    private void notifyForNewProductNotifications(List<AppNotification> notifications) {
        for (AppNotification notification : notifications) {
            if (!notifiedProductNotificationIds.contains(notification.id)) {
                notifiedProductNotificationIds.add(notification.id);
                showProductNotification(notification);
            }
        }
    }

    private void showProductNotification(AppNotification notification) {
        if (isLiveStateNotification(notification) || isLiveRequestNotification(notification)) {
            return;
        }
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setAction(ACTION_OPEN_NOTIFICATION);
        openIntent.putExtra(EXTRA_NOTIFICATION_TARGET, notification.target);

        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
                : new Notification.Builder(this);
        builder.setSmallIcon(notification.icon())
                .setContentTitle(notification.title)
                .setContentText(notification.body)
                .setContentIntent(PendingIntent.getActivity(this, notification.notificationId(), openIntent, immutablePendingIntentFlags()))
                .setAutoCancel(true)
                .setPriority(notification.androidPriority());
        addNotificationActions(builder, notification);

        manager.notify(notification.notificationId(), builder.build());
    }

    private void addNotificationActions(Notification.Builder builder, AppNotification notification) {
        if ("live_transfer_request".equals(notification.type)) {
            String approvalId = lastPathSegment(notification.target);
            if (approvalId.length() > 0) {
                Intent accept = notificationActionIntent(ACTION_APPROVE_TRANSFER, notification.target, notification.notificationId());
                accept.putExtra(EXTRA_APPROVAL_ID, approvalId);
                builder.addAction(android.R.drawable.checkbox_on_background, "Accept", PendingIntent.getBroadcast(this, notification.notificationId() + 1, accept, actionPendingIntentFlags(false)));

                Intent decline = notificationActionIntent(ACTION_DECLINE_TRANSFER, notification.target, notification.notificationId());
                decline.putExtra(EXTRA_APPROVAL_ID, approvalId);
                builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", PendingIntent.getBroadcast(this, notification.notificationId() + 2, decline, actionPendingIntentFlags(false)));
            }
        } else if ("live_answer_request".equals(notification.type)) {
            Intent reply = notificationActionIntent(ACTION_REPLY_ANSWER, notification.target, notification.notificationId());
            reply.putExtra(EXTRA_ANSWER_ID, lastPathSegment(notification.target));
            PendingIntent replyIntent = PendingIntent.getBroadcast(this, notification.notificationId() + 3, reply, actionPendingIntentFlags(true));
            RemoteInput remoteInput = new RemoteInput.Builder(EXTRA_INLINE_REPLY)
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

    private boolean isLiveActionType(String type) {
        return "live_answer_request".equals(type) || "live_transfer_request".equals(type);
    }

    private boolean isLiveStateNotification(AppNotification notification) {
        return "live_call_state".equals(notification.type);
    }

    private boolean isLiveRequestNotification(AppNotification notification) {
        return "live_transfer_request".equals(notification.type) || "live_answer_request".equals(notification.type);
    }

    private boolean hasPendingRequestForNotification(AppNotification notification) {
        String requestId = lastPathSegment(notification.target);
        if ("live_answer_request".equals(notification.type)) {
            for (AnswerRequest answerRequest : answerRequests) {
                if (answerRequest.id.equals(requestId)) {
                    return true;
                }
            }
        }
        if ("live_transfer_request".equals(notification.type)) {
            for (ApprovalRequest approvalRequest : approvalRequests) {
                if (approvalRequest.id.equals(requestId)) {
                    return true;
                }
            }
        }
        return false;
    }

    private Intent notificationActionIntent(String action, String target, int notificationId) {
        Intent intent = new Intent(this, NotificationActionReceiver.class);
        intent.setAction(action);
        intent.putExtra(EXTRA_NOTIFICATION_TARGET, target);
        intent.putExtra(EXTRA_NOTIFICATION_ID, notificationId);
        return intent;
    }

    private int immutablePendingIntentFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return flags;
    }

    private int actionPendingIntentFlags(boolean mutable) {
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

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private int systemBarHeight(String resourceName) {
        int resourceId = getResources().getIdentifier(resourceName, "dimen", "android");
        if (resourceId <= 0) {
            return 0;
        }
        return getResources().getDimensionPixelSize(resourceId);
    }

    private static final class DevicePhoneNumber {
        final String number;
        final String label;

        DevicePhoneNumber(String number, String label) {
            this.number = number;
            this.label = label;
        }

        JSONObject toJson() throws Exception {
            JSONObject json = new JSONObject();
            json.put("number", number);
            if (label != null && label.length() > 0) {
                json.put("label", label);
            }
            return json;
        }
    }

    private static final class DeviceContact {
        final String sourceContactId;
        final String displayName;
        final List<DevicePhoneNumber> phoneNumbers = new ArrayList<>();

        DeviceContact(String sourceContactId, String displayName) {
            this.sourceContactId = sourceContactId;
            this.displayName = displayName;
        }

        JSONObject toJson() throws Exception {
            JSONObject json = new JSONObject();
            json.put("source", "android_contacts");
            json.put("sourceContactId", sourceContactId);
            json.put("displayName", displayName);
            JSONArray phones = new JSONArray();
            for (DevicePhoneNumber phoneNumber : phoneNumbers) {
                phones.put(phoneNumber.toJson());
            }
            json.put("phoneNumbers", phones);
            return json;
        }
    }

    private static final class UserSummary {
        final String userId;
        final String displayName;
        final String primaryPhoneNumber;
        final String retellPhoneNumber;
        final String assistantName;
        final String greetingStyle;
        final String disclosureStyle;
        final int warmth;
        final int brevity;
        final int proactivity;

        private UserSummary(
                String userId,
                String displayName,
                String primaryPhoneNumber,
                String retellPhoneNumber,
                String assistantName,
                String greetingStyle,
                String disclosureStyle,
                int warmth,
                int brevity,
                int proactivity
        ) {
            this.userId = userId;
            this.displayName = displayName;
            this.primaryPhoneNumber = primaryPhoneNumber;
            this.retellPhoneNumber = retellPhoneNumber;
            this.assistantName = assistantName;
            this.greetingStyle = greetingStyle;
            this.disclosureStyle = disclosureStyle;
            this.warmth = warmth;
            this.brevity = brevity;
            this.proactivity = proactivity;
        }

        static UserSummary empty() {
            return new UserSummary("", "", "", "", "Assistant", "warm", "standard", 4, 3, 3);
        }

        static UserSummary fromJson(JSONObject json) {
            JSONObject phoneRouting = json.optJSONObject("phoneRouting");
            JSONObject assistantProfile = json.optJSONObject("assistantProfile");
            return new UserSummary(
                    json.optString("userId"),
                    json.optString("displayName"),
                    phoneRouting == null ? "" : phoneRouting.optString("primaryPhoneNumber"),
                    phoneRouting == null ? "" : phoneRouting.optString("retellPhoneNumber"),
                    assistantProfile == null ? "Assistant" : assistantProfile.optString("assistantName", "Assistant"),
                    assistantProfile == null ? "warm" : assistantProfile.optString("greetingStyle", "warm"),
                    assistantProfile == null ? "standard" : assistantProfile.optString("disclosureStyle", "standard"),
                    assistantProfile == null ? 4 : assistantProfile.optInt("warmth", 4),
                    assistantProfile == null ? 3 : assistantProfile.optInt("brevity", 3),
                    assistantProfile == null ? 3 : assistantProfile.optInt("proactivity", 3)
            );
        }
    }

    private static final class BillingAccount {
        final String status;
        final String subscriptionStatus;
        final int monthlySpendingCapCents;
        final int currentPeriodSpendCents;
        final String cardBrand;
        final String cardLast4;

        private BillingAccount(
                String status,
                String subscriptionStatus,
                int monthlySpendingCapCents,
                int currentPeriodSpendCents,
                String cardBrand,
                String cardLast4
        ) {
            this.status = status;
            this.subscriptionStatus = subscriptionStatus;
            this.monthlySpendingCapCents = monthlySpendingCapCents;
            this.currentPeriodSpendCents = currentPeriodSpendCents;
            this.cardBrand = cardBrand;
            this.cardLast4 = cardLast4;
        }

        static BillingAccount empty() {
            return new BillingAccount("payment_required", "", 2500, 0, "", "");
        }

        static BillingAccount fromJson(JSONObject json) {
            JSONObject paymentMethod = json.optJSONObject("paymentMethod");
            return new BillingAccount(
                    json.optString("status", "payment_required"),
                    json.optString("providerSubscriptionStatus"),
                    json.optInt("monthlySpendingCapCents", 2500),
                    json.optInt("currentPeriodSpendCents", 0),
                    paymentMethod == null ? "" : paymentMethod.optString("brand"),
                    paymentMethod == null ? "" : paymentMethod.optString("last4")
            );
        }

        boolean isActive() {
            return "active".equals(status);
        }

        boolean hasPaymentMethod() {
            return cardLast4.length() > 0;
        }

        String statusLabel() {
            if ("active".equals(status)) {
                return "Billing ready";
            }
            if ("past_due".equals(status)) {
                return "Payment needs attention";
            }
            if ("cap_reached".equals(status)) {
                return "Spending cap reached";
            }
            if (hasPaymentMethod()) {
                return "Card added";
            }
            return "Payment method needed";
        }

        String paymentMethodLabel() {
            if (!hasPaymentMethod()) {
                return "No card yet";
            }
            String brand = cardBrand.length() > 0 ? capitalize(cardBrand) : "Card";
            return brand + " ending " + cardLast4;
        }

        String formattedCap() {
            return formatCents(monthlySpendingCapCents) + "/mo";
        }

        String formattedSpend() {
            return formatCents(currentPeriodSpendCents);
        }

        private static String formatCents(int cents) {
            return "$" + String.format(Locale.US, "%.2f", cents / 100.0);
        }

        private static String capitalize(String value) {
            if (value.length() == 0) {
                return value;
            }
            return value.substring(0, 1).toUpperCase(Locale.US) + value.substring(1);
        }
    }

    private static final class AppNotification {
        final String id;
        final String type;
        final String priority;
        final String title;
        final String body;
        final String target;

        private AppNotification(String id, String type, String priority, String title, String body, String target) {
            this.id = id;
            this.type = type;
            this.priority = priority;
            this.title = title;
            this.body = body;
            this.target = target;
        }

        static AppNotification fromJson(JSONObject json) {
            return new AppNotification(
                    json.optString("id"),
                    json.optString("type"),
                    json.optString("priority", "normal"),
                    json.optString("title", "Phone Agent"),
                    json.optString("body", "Notification"),
                    json.optString("target", "assistant")
            );
        }

        int notificationId() {
            return Math.abs(id.hashCode()) + 120000;
        }

        int androidPriority() {
            if ("urgent".equals(priority) || "high".equals(priority)) {
                return Notification.PRIORITY_HIGH;
            }
            if ("low".equals(priority)) {
                return Notification.PRIORITY_LOW;
            }
            return Notification.PRIORITY_DEFAULT;
        }

        int icon() {
            if ("calendar_change".equals(type)) {
                return android.R.drawable.ic_menu_my_calendar;
            }
            if ("call_summary".equals(type)) {
                return android.R.drawable.sym_call_incoming;
            }
            return android.R.drawable.ic_dialog_info;
        }

        String typeLabel() {
            if ("live_transfer_request".equals(type)) {
                return "Transfer";
            }
            if ("live_answer_request".equals(type)) {
                return "Answer";
            }
            if ("call_summary".equals(type)) {
                return "Summary";
            }
            if ("calendar_change".equals(type)) {
                return "Calendar";
            }
            if ("topic_suggestion".equals(type)) {
                return "Topic";
            }
            return "Notification";
        }
    }

    private static final class OnboardingStatus {
        final boolean readyForBetaUse;
        final int completedCount;
        final int totalCount;
        final String nextActionLabel;
        final List<OnboardingStep> checklist;

        private OnboardingStatus(
                boolean readyForBetaUse,
                int completedCount,
                int totalCount,
                String nextActionLabel,
                List<OnboardingStep> checklist
        ) {
            this.readyForBetaUse = readyForBetaUse;
            this.completedCount = completedCount;
            this.totalCount = totalCount;
            this.nextActionLabel = nextActionLabel;
            this.checklist = checklist;
        }

        static OnboardingStatus empty() {
            return new OnboardingStatus(false, 0, 0, "", new ArrayList<>());
        }

        static OnboardingStatus fromJson(JSONObject json) {
            JSONArray rawChecklist = json.optJSONArray("checklist");
            List<OnboardingStep> parsedChecklist = new ArrayList<>();
            if (rawChecklist != null) {
                for (int i = 0; i < rawChecklist.length(); i++) {
                    JSONObject step = rawChecklist.optJSONObject(i);
                    if (step != null) {
                        parsedChecklist.add(OnboardingStep.fromJson(step));
                    }
                }
            }

            JSONObject nextAction = json.optJSONObject("nextAction");
            return new OnboardingStatus(
                    json.optBoolean("readyForBetaUse", false),
                    json.optInt("completedCount", 0),
                    json.optInt("totalCount", parsedChecklist.size()),
                    nextAction == null ? "" : nextAction.optString("label"),
                    parsedChecklist
            );
        }
    }

    private static final class OnboardingStep {
        final String id;
        final String label;
        final boolean complete;
        final String action;

        private OnboardingStep(String id, String label, boolean complete, String action) {
            this.id = id;
            this.label = label;
            this.complete = complete;
            this.action = action;
        }

        static OnboardingStep fromJson(JSONObject json) {
            return new OnboardingStep(
                    json.optString("id"),
                    json.optString("label"),
                    json.optBoolean("complete", false),
                    json.optString("action")
            );
        }
    }

    private static final class TopicSuggestion {
        final String id;
        final String communicationItemId;
        final String targetType;
        final String suggestedTopicThreadId;
        final String suggestedTitle;
        final double confidence;
        final String reason;

        private TopicSuggestion(
                String id,
                String communicationItemId,
                String targetType,
                String suggestedTopicThreadId,
                String suggestedTitle,
                double confidence,
                String reason
        ) {
            this.id = id;
            this.communicationItemId = communicationItemId;
            this.targetType = targetType;
            this.suggestedTopicThreadId = suggestedTopicThreadId;
            this.suggestedTitle = suggestedTitle;
            this.confidence = confidence;
            this.reason = reason;
        }

        static TopicSuggestion fromJson(JSONObject json) {
            return new TopicSuggestion(
                    json.optString("id"),
                    json.optString("communicationItemId"),
                    json.optString("targetType", "existing_topic"),
                    json.optString("suggestedTopicThreadId"),
                    json.optString("suggestedTitle"),
                    json.optDouble("confidence", 0),
                    json.optString("reason")
            );
        }

        String displayTitle(TopicThread topic) {
            if (topic != null) {
                return "Attach to " + topic.title;
            }
            if (suggestedTitle.length() > 0) {
                return "Create " + suggestedTitle;
            }
            return "Review topic suggestion";
        }
    }

    private static final class CommunicationItem {
        final String id;
        final String channel;
        final String sourceProvider;
        final String providerItemId;
        final String senderName;
        final String senderPhone;
        final String occurredAt;
        final String bodyText;
        final String transcriptText;
        final String summary;
        final List<TopicAssociation> topicAssociations;

        private CommunicationItem(
                String id,
                String channel,
                String sourceProvider,
                String providerItemId,
                String senderName,
                String senderPhone,
                String occurredAt,
                String bodyText,
                String transcriptText,
                String summary,
                List<TopicAssociation> topicAssociations
        ) {
            this.id = id;
            this.channel = channel;
            this.sourceProvider = sourceProvider;
            this.providerItemId = providerItemId;
            this.senderName = senderName;
            this.senderPhone = senderPhone;
            this.occurredAt = occurredAt;
            this.bodyText = bodyText;
            this.transcriptText = transcriptText;
            this.summary = summary;
            this.topicAssociations = topicAssociations;
        }

        static CommunicationItem fromJson(JSONObject json) {
            JSONObject sender = json.optJSONObject("sender");
            JSONArray associations = json.optJSONArray("topicAssociations");
            List<TopicAssociation> parsedAssociations = new ArrayList<>();
            if (associations != null) {
                for (int i = 0; i < associations.length(); i++) {
                    JSONObject association = associations.optJSONObject(i);
                    if (association != null) {
                        parsedAssociations.add(TopicAssociation.fromJson(association));
                    }
                }
            }

            return new CommunicationItem(
                    json.optString("id"),
                    json.optString("channel", "phone_call"),
                    json.optString("sourceProvider"),
                    json.optString("providerItemId"),
                    sender == null ? "" : sender.optString("displayName"),
                    sender == null ? "" : sender.optString("phoneNumber"),
                    json.optString("occurredAt"),
                    json.optString("bodyText"),
                    json.optString("transcriptText"),
                    json.optString("summary"),
                    parsedAssociations
            );
        }

        String displayTitle() {
            if (senderName.length() > 0) {
                return senderName;
            }
            if (senderPhone.length() > 0) {
                return senderPhone;
            }
            return channelLabel();
        }

        String channelLabel() {
            return channel.replace('_', ' ');
        }

        String previewText() {
            if (summary.length() > 0) {
                return summary;
            }
            if (bodyText.length() > 0) {
                return bodyText;
            }
            if (transcriptText.length() > 0) {
                return transcriptText;
            }
            return "No content available yet.";
        }

        String formattedTime() {
            if (occurredAt == null || occurredAt.length() == 0) {
                return sourceProvider.length() > 0 ? sourceProvider : channelLabel();
            }
            try {
                Instant instant = Instant.parse(occurredAt);
                DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM d, h:mm a", Locale.US)
                        .withZone(ZoneId.systemDefault());
                return formatter.format(instant) + " / " + sourceProvider;
            } catch (Exception ignored) {
                return occurredAt;
            }
        }

        String compactTime() {
            if (occurredAt == null || occurredAt.length() == 0) {
                return channelLabel();
            }
            try {
                Instant instant = Instant.parse(occurredAt);
                DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM d, h:mm a", Locale.US)
                        .withZone(ZoneId.systemDefault());
                return formatter.format(instant);
            } catch (Exception ignored) {
                return occurredAt;
            }
        }

        String secondaryLine() {
            if (senderPhone.length() > 0) {
                return senderPhone;
            }
            if (sourceProvider.length() > 0) {
                return channelLabel() + " / " + sourceProvider;
            }
            return channelLabel();
        }

        String bestContactTarget() {
            return senderPhone == null ? "" : senderPhone;
        }
    }

    private static final class TopicAssociation {
        final String topicThreadId;
        final String mode;

        private TopicAssociation(String topicThreadId, String mode) {
            this.topicThreadId = topicThreadId;
            this.mode = mode;
        }

        static TopicAssociation fromJson(JSONObject json) {
            return new TopicAssociation(
                    json.optString("topicThreadId"),
                    json.optString("mode", "suggested")
            );
        }
    }

    private static final class TopicThread {
        final String id;
        final String title;
        final String description;
        final String status;
        final List<String> communicationItemIds;
        final List<String> decisions;
        final List<String> openQuestions;
        final List<String> tasks;

        private TopicThread(
                String id,
                String title,
                String description,
                String status,
                List<String> communicationItemIds,
                List<String> decisions,
                List<String> openQuestions,
                List<String> tasks
        ) {
            this.id = id;
            this.title = title;
            this.description = description;
            this.status = status;
            this.communicationItemIds = communicationItemIds;
            this.decisions = decisions;
            this.openQuestions = openQuestions;
            this.tasks = tasks;
        }

        static TopicThread fromJson(JSONObject json) {
            return new TopicThread(
                    json.optString("id"),
                    json.optString("title", "Untitled topic"),
                    json.optString("description"),
                    json.optString("status", "active"),
                    strings(json.optJSONArray("communicationItemIds")),
                    objectFieldStrings(json.optJSONArray("decisions"), "title"),
                    objectFieldStrings(json.optJSONArray("openQuestions"), "question"),
                    objectFieldStrings(json.optJSONArray("tasks"), "title")
            );
        }

        String subtitle() {
            if (description.length() > 0) {
                return description;
            }
            return countSummary();
        }

        String countSummary() {
            return communicationItemIds.size() + " communications / " + decisions.size() + " decisions / " + openQuestions.size() + " questions / " + tasks.size() + " tasks";
        }

        String latestStructuredState() {
            if (!openQuestions.isEmpty()) {
                return "Open question: " + openQuestions.get(0);
            }
            if (!tasks.isEmpty()) {
                return "Next task: " + tasks.get(0);
            }
            if (!decisions.isEmpty()) {
                return "Decision: " + decisions.get(0);
            }
            return "";
        }

        private static List<String> strings(JSONArray items) {
            List<String> results = new ArrayList<>();
            if (items == null) {
                return results;
            }
            for (int i = 0; i < items.length(); i++) {
                String value = items.optString(i);
                if (value.length() > 0) {
                    results.add(value);
                }
            }
            return results;
        }

        private static List<String> objectFieldStrings(JSONArray items, String field) {
            List<String> results = new ArrayList<>();
            if (items == null) {
                return results;
            }
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item != null) {
                    String value = item.optString(field);
                    if (value.length() > 0) {
                        results.add(value);
                    }
                }
            }
            return results;
        }
    }

    private static final class ActiveCall {
        final String callSessionId;
        final String providerCallId;
        final String status;
        final String substate;
        final String callerNumber;
        final String callerName;
        final String relationship;
        final String trustLevel;
        final String intent;
        final String urgency;
        final String startedAt;
        final int elapsedSeconds;
        final boolean stale;
        final String pendingApprovalRequestId;
        final String pendingAnswerRequestId;

        private ActiveCall(
                String callSessionId,
                String providerCallId,
                String status,
                String substate,
                String callerNumber,
                String callerName,
                String relationship,
                String trustLevel,
                String intent,
                String urgency,
                String startedAt,
                int elapsedSeconds,
                boolean stale,
                String pendingApprovalRequestId,
                String pendingAnswerRequestId
        ) {
            this.callSessionId = callSessionId;
            this.providerCallId = providerCallId;
            this.status = status;
            this.substate = substate;
            this.callerNumber = callerNumber;
            this.callerName = callerName;
            this.relationship = relationship;
            this.trustLevel = trustLevel;
            this.intent = intent;
            this.urgency = urgency;
            this.startedAt = startedAt;
            this.elapsedSeconds = elapsedSeconds;
            this.stale = stale;
            this.pendingApprovalRequestId = pendingApprovalRequestId;
            this.pendingAnswerRequestId = pendingAnswerRequestId;
        }

        static ActiveCall fromJson(JSONObject json) {
            return new ActiveCall(
                    json.optString("callSessionId"),
                    json.optString("providerCallId"),
                    json.optString("status", "in_progress"),
                    json.optString("substate", "agent_on_call"),
                    json.optString("callerNumber"),
                    json.optString("callerName"),
                    json.optString("relationship", "unknown"),
                    json.optString("trustLevel", "unknown"),
                    json.optString("intent"),
                    json.optString("urgency", "unknown"),
                    json.optString("startedAt"),
                    json.optInt("elapsedSeconds", 0),
                    json.optBoolean("stale", false),
                    json.optString("pendingApprovalRequestId"),
                    json.optString("pendingAnswerRequestId")
            );
        }

        String displayCaller() {
            if (callerName.length() > 0) {
                return callerName;
            }
            if (callerNumber.length() > 0) {
                return callerNumber;
            }
            return "Unknown caller";
        }

        String statusLabel() {
            if ("awaiting_user_answer".equals(substate)) {
                return "needs answer";
            }
            if ("awaiting_user_approval".equals(substate)) {
                return "needs approval";
            }
            if ("bridging_to_user".equals(substate)) {
                return "transferring";
            }
            if ("bridged".equals(substate)) {
                return "bridged";
            }
            if (stale) {
                return "checking";
            }
            return "active";
        }

        int stateColor() {
            if ("awaiting_user_answer".equals(substate) || "awaiting_user_approval".equals(substate)) {
                return COLOR_WARN;
            }
            if ("bridged".equals(substate)) {
                return COLOR_GREEN;
            }
            return COLOR_BLUE;
        }

        String formattedElapsed() {
            int minutes = elapsedSeconds / 60;
            int seconds = elapsedSeconds % 60;
            return String.format(Locale.US, "%d:%02d", minutes, seconds);
        }
    }

    private static final class CallRecord {
        final String providerCallId;
        final String fromNumber;
        final String toNumber;
        final String status;
        final String startedAt;
        final String transcript;
        final String summary;
        final String callerName;
        final String intent;
        final String urgency;
        final String followUp;
        final String callbackNumber;

        private CallRecord(
                String providerCallId,
                String fromNumber,
                String toNumber,
                String status,
                String startedAt,
                String transcript,
                String summary,
                String callerName,
                String intent,
                String urgency,
                String followUp,
                String callbackNumber
        ) {
            this.providerCallId = providerCallId;
            this.fromNumber = fromNumber;
            this.toNumber = toNumber;
            this.status = status;
            this.startedAt = startedAt;
            this.transcript = transcript;
            this.summary = summary;
            this.callerName = callerName;
            this.intent = intent;
            this.urgency = urgency;
            this.followUp = followUp;
            this.callbackNumber = callbackNumber;
        }

        static CallRecord fromJson(JSONObject json) {
            JSONObject summaryObject = json.optJSONObject("summary");
            JSONObject structured = summaryObject == null ? null : summaryObject.optJSONObject("structuredData");
            JSONObject custom = structured == null ? null : structured.optJSONObject("custom_analysis_data");

            return new CallRecord(
                    json.optString("providerCallId"),
                    json.optString("fromNumber"),
                    json.optString("toNumber"),
                    json.optString("status"),
                    json.optString("startedAt"),
                    json.optString("transcript"),
                    summaryObject == null ? "" : summaryObject.optString("text"),
                    custom == null ? "" : custom.optString("caller_name"),
                    custom == null ? "" : custom.optString("caller_intent"),
                    custom == null ? json.optString("urgency", "unknown") : custom.optString("urgency", "unknown"),
                    custom == null ? "" : custom.optString("requested_follow_up"),
                    custom == null ? "" : custom.optString("callback_number")
            );
        }

        String displayCaller() {
            if (callerName.length() > 0) {
                return callerName;
            }
            if (fromNumber.length() > 0) {
                return fromNumber;
            }
            return "Unknown caller";
        }

        String summaryText() {
            if (summary.length() > 0) {
                return summary;
            }
            if (intent.length() > 0) {
                return intent;
            }
            return "No summary available yet.";
        }

        String urgencyLabel() {
            if (urgency == null || urgency.length() == 0) {
                return "unknown";
            }
            return urgency.replace('_', ' ').toLowerCase(Locale.US);
        }

        int urgencyColor() {
            String normalized = urgencyLabel();
            if (normalized.contains("emergency") || normalized.contains("high")) {
                return COLOR_WARN;
            }
            if (normalized.contains("low")) {
                return COLOR_GREEN;
            }
            return COLOR_BLUE;
        }

        String formattedTime() {
            if (startedAt == null || startedAt.length() == 0) {
                return status;
            }
            try {
                Instant instant = Instant.parse(startedAt);
                DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM d, h:mm a", Locale.US)
                        .withZone(ZoneId.systemDefault());
                return formatter.format(instant) + " / " + status;
            } catch (Exception ignored) {
                return startedAt + " / " + status;
            }
        }

        String compactDate() {
            if (startedAt == null || startedAt.length() == 0) {
                return status;
            }
            try {
                Instant instant = Instant.parse(startedAt);
                DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM d, h:mm a", Locale.US)
                        .withZone(ZoneId.systemDefault());
                return formatter.format(instant);
            } catch (Exception ignored) {
                return startedAt;
            }
        }

        String bestCallbackNumber() {
            if (callbackNumber != null && callbackNumber.length() > 0) {
                return callbackNumber;
            }
            if (fromNumber != null && fromNumber.length() > 0) {
                return fromNumber;
            }
            return "";
        }
    }

    private static final class ApprovalRequest {
        final String id;
        final String callerNumber;
        final String callerName;
        final String reason;
        final String urgency;
        final String expiresAt;

        private ApprovalRequest(String id, String callerNumber, String callerName, String reason, String urgency, String expiresAt) {
            this.id = id;
            this.callerNumber = callerNumber;
            this.callerName = callerName;
            this.reason = reason;
            this.urgency = urgency;
            this.expiresAt = expiresAt;
        }

        static ApprovalRequest fromJson(JSONObject json) {
            return new ApprovalRequest(
                    json.optString("id"),
                    json.optString("callerNumber"),
                    json.optString("callerName"),
                    json.optString("reason", "Caller requested live attention."),
                    json.optString("urgency", "unknown"),
                    json.optString("expiresAt")
            );
        }

        String displayCaller() {
            if (callerName.length() > 0) {
                return callerName;
            }
            if (callerNumber.length() > 0) {
                return callerNumber;
            }
            return "Live caller";
        }

        String formattedExpiry() {
            if (expiresAt == null || expiresAt.length() == 0) {
                return "soon";
            }
            try {
                Instant instant = Instant.parse(expiresAt);
                DateTimeFormatter formatter = DateTimeFormatter.ofPattern("h:mm:ss a", Locale.US)
                        .withZone(ZoneId.systemDefault());
                return formatter.format(instant);
            } catch (Exception ignored) {
                return "soon";
            }
        }

    }

    private static final class AnswerRequest {
        final String id;
        final String callerNumber;
        final String callerName;
        final String question;
        final String reason;
        final String urgency;
        final String expiresAt;

        private AnswerRequest(String id, String callerNumber, String callerName, String question, String reason, String urgency, String expiresAt) {
            this.id = id;
            this.callerNumber = callerNumber;
            this.callerName = callerName;
            this.question = question;
            this.reason = reason;
            this.urgency = urgency;
            this.expiresAt = expiresAt;
        }

        static AnswerRequest fromJson(JSONObject json) {
            return new AnswerRequest(
                    json.optString("id"),
                    json.optString("callerNumber"),
                    json.optString("callerName"),
                    json.optString("question", "What should I tell the caller?"),
                    json.optString("reason"),
                    json.optString("urgency", "unknown"),
                    json.optString("expiresAt")
            );
        }

        String displayCaller() {
            if (callerName.length() > 0) {
                return callerName;
            }
            if (callerNumber.length() > 0) {
                return callerNumber;
            }
            return "Live caller";
        }

        String formattedExpiry() {
            if (expiresAt == null || expiresAt.length() == 0) {
                return "soon";
            }
            try {
                Instant instant = Instant.parse(expiresAt);
                DateTimeFormatter formatter = DateTimeFormatter.ofPattern("h:mm:ss a", Locale.US)
                        .withZone(ZoneId.systemDefault());
                return formatter.format(instant);
            } catch (Exception ignored) {
                return "soon";
            }
        }

    }

    private static final class AgentNote {
        final String id;
        final String status;
        final String text;
        final String title;
        final String targetPhoneNumber;
        final String targetCallerName;
        final String topic;

        private AgentNote(String id, String status, String text, String title, String targetPhoneNumber, String targetCallerName, String topic) {
            this.id = id;
            this.status = status;
            this.text = text;
            this.title = title;
            this.targetPhoneNumber = targetPhoneNumber;
            this.targetCallerName = targetCallerName;
            this.topic = topic;
        }

        static AgentNote fromJson(JSONObject json) {
            return new AgentNote(
                    json.optString("id"),
                    json.optString("status", "active"),
                    json.optString("text"),
                    json.optString("title"),
                    json.optString("targetPhoneNumber"),
                    json.optString("targetCallerName"),
                    json.optString("topic")
            );
        }

        String formattedScope() {
            if (targetCallerName.length() > 0) {
                return targetCallerName;
            }
            if (targetPhoneNumber.length() > 0) {
                return targetPhoneNumber;
            }
            if (topic.length() > 0) {
                return topic;
            }
            return "general";
        }
    }

    private static final class CalendarStatus {
        final boolean configured;
        final boolean connected;
        final String connectedEmail;

        private CalendarStatus(boolean configured, boolean connected, String connectedEmail) {
            this.configured = configured;
            this.connected = connected;
            this.connectedEmail = connectedEmail;
        }

        static CalendarStatus fromJson(JSONObject json) {
            return new CalendarStatus(
                    json.optBoolean("configured", false),
                    json.optBoolean("connected", false),
                    json.optString("connectedEmail")
            );
        }

        String statusText() {
            if (!configured) {
                return "Calendar connection is not configured yet.";
            }
            if (connected) {
                return connectedEmail.length() > 0 ? connectedEmail : "Connected to Google Calendar.";
            }
            return "Connect your Google account so the assistant can check free/busy and create or update its own events.";
        }
    }

    private static final class CalendarEventRequest {
        final String id;
        final String action;
        final String status;
        final String callerNumber;
        final String callerName;
        final String title;
        final String description;
        final String startTime;
        final String endTime;
        final String timeZone;
        final String reason;
        final String expiresAt;

        private CalendarEventRequest(
                String id,
                String action,
                String status,
                String callerNumber,
                String callerName,
                String title,
                String description,
                String startTime,
                String endTime,
                String timeZone,
                String reason,
                String expiresAt
        ) {
            this.id = id;
            this.action = action;
            this.status = status;
            this.callerNumber = callerNumber;
            this.callerName = callerName;
            this.title = title;
            this.description = description;
            this.startTime = startTime;
            this.endTime = endTime;
            this.timeZone = timeZone;
            this.reason = reason;
            this.expiresAt = expiresAt;
        }

        static CalendarEventRequest fromJson(JSONObject json) {
            return new CalendarEventRequest(
                    json.optString("id"),
                    json.optString("action", "create"),
                    json.optString("status", "pending"),
                    json.optString("callerNumber"),
                    json.optString("callerName"),
                    json.optString("title", "Calendar event"),
                    json.optString("description"),
                    json.optString("startTime"),
                    json.optString("endTime"),
                    json.optString("timeZone", "America/New_York"),
                    json.optString("reason"),
                    json.optString("expiresAt")
            );
        }

        String displayCaller() {
            if (callerName.length() > 0) {
                return callerName;
            }
            if (callerNumber.length() > 0) {
                return callerNumber;
            }
            return "Caller";
        }

        String formattedTime() {
            try {
                Instant instant = Instant.parse(startTime);
                DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM d, h:mm a", Locale.US)
                        .withZone(ZoneId.systemDefault());
                return formatter.format(instant);
            } catch (Exception ignored) {
                return startTime;
            }
        }

        String formattedExpiry() {
            if (expiresAt == null || expiresAt.length() == 0) {
                return "soon";
            }
            try {
                Instant instant = Instant.parse(expiresAt);
                DateTimeFormatter formatter = DateTimeFormatter.ofPattern("h:mm:ss a", Locale.US)
                        .withZone(ZoneId.systemDefault());
                return formatter.format(instant);
            } catch (Exception ignored) {
                return "soon";
            }
        }

        String statusLabel() {
            if ("update".equals(action) && "updated".equals(status)) {
                return "Updated";
            }
            if ("create".equals(action) && "created".equals(status)) {
                return "Created";
            }
            if ("failed".equals(status)) {
                return "Failed";
            }
            if ("pending".equals(status)) {
                return "Pending";
            }
            return status.length() > 0 ? status : "Calendar";
        }

    }

    private static final class CallerProfile {
        final String id;
        final String primaryPhoneNumber;
        final String displayName;
        final String organization;
        final String relationship;
        final String trustLevel;
        final String lastIntent;
        final String lastCallSummary;
        final int callCount;
        final List<String> memories;

        private CallerProfile(
                String id,
                String primaryPhoneNumber,
                String displayName,
                String organization,
                String relationship,
                String trustLevel,
                String lastIntent,
                String lastCallSummary,
                int callCount,
                List<String> memories
        ) {
            this.id = id;
            this.primaryPhoneNumber = primaryPhoneNumber;
            this.displayName = displayName;
            this.organization = organization;
            this.relationship = relationship;
            this.trustLevel = trustLevel;
            this.lastIntent = lastIntent;
            this.lastCallSummary = lastCallSummary;
            this.callCount = callCount;
            this.memories = memories;
        }

        static CallerProfile fromJson(JSONObject json) {
            JSONArray rawMemories = json.optJSONArray("memories");
            List<String> memories = new ArrayList<>();
            if (rawMemories != null) {
                for (int i = 0; i < rawMemories.length(); i++) {
                    JSONObject memory = rawMemories.optJSONObject(i);
                    if (memory != null && memory.optBoolean("approved", false) && !memory.optBoolean("sensitive", false)) {
                        String text = memory.optString("text");
                        if (text.length() > 0) {
                            memories.add(text);
                        }
                    }
                }
            }

            return new CallerProfile(
                    json.optString("id"),
                    json.optString("primaryPhoneNumber"),
                    json.optString("displayName"),
                    json.optString("organization"),
                    json.optString("relationship", "unknown"),
                    json.optString("trustLevel", "unknown"),
                    json.optString("lastIntent"),
                    json.optString("lastCallSummary"),
                    json.optInt("callCount", 0),
                    memories
            );
        }

        String relationshipLabel() {
            if (relationship == null || relationship.length() == 0) {
                return "unknown";
            }
            return relationship.replace('_', ' ');
        }

        int relationshipColor() {
            if ("family".equals(relationship) || "close_friend".equals(relationship)) {
                return COLOR_GREEN;
            }
            if ("spam".equals(relationship) || "blocked".equals(relationship)) {
                return COLOR_WARN;
            }
            return COLOR_BLUE;
        }
    }
}


