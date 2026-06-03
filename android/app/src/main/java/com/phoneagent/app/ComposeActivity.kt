package com.phoneagent.app

import android.Manifest
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.core.view.WindowCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.google.firebase.messaging.FirebaseMessaging
import com.phoneagent.app.data.AgentNoteCreateRequest
import com.phoneagent.app.data.AssistantProfileUpdate
import com.phoneagent.app.data.PushTokenRegistrationRequest
import com.phoneagent.app.data.TopicCreateRequest
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.TimeUnit

@AndroidEntryPoint
class ComposeActivity : ComponentActivity() {
    companion object {
        const val ACTION_PUSH_REFRESH = "com.phoneagent.app.PUSH_REFRESH"
    }

    private val scope = CoroutineScope(Dispatchers.Main)
    private val viewModel: PhoneAgentViewModel by viewModels()
    @Inject internal lateinit var firebaseAuth: FirebaseAuth
    @Inject internal lateinit var contactReader: AndroidContactReader
    @Inject internal lateinit var analyticsTracker: PhoneAgentAnalyticsTracker
    private var uiState: PhoneAgentUiState
        get() = viewModel.uiState.value
        set(value) {
            viewModel.setState(value)
        }
    private var pendingDisplayName = ""
    private lateinit var contactsPermissionLauncher: ActivityResultLauncher<String>

    private val pushReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            scope.launch { loadData(forceStatus = true) }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        contactsPermissionLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                uiState = uiState.copy(contactPermissionDenied = false)
                track("contacts_permission_result", screen = "phone_contacts", action = "permission", result = "granted")
                syncPhoneContacts()
            } else {
                uiState = uiState.copy(contactSyncing = false, contactPermissionDenied = true, status = if (uiState.onboarding.ready) "Active" else "Setup")
                toast("Contacts permission was not granted.")
                track("contacts_permission_result", screen = "phone_contacts", action = "permission", result = "denied")
            }
        }
        requestNotificationPermission()
        setContent {
            val state by viewModel.uiState.collectAsState()
            PhoneAgentTheme {
                PhoneAgentApp(
                    state = state,
                    actions = AppActions(
                        selectTab = ::selectTab,
                        refresh = { scope.launch { loadData(forceStatus = true) } },
                        startSignup = ::startPhoneAuth,
                        verifyCode = ::verifyPhoneCode,
                        saveAssistantName = ::saveAssistantName,
                        openTopic = ::openTopic,
                        openCall = ::openCall,
                        openAddNote = ::openAddNote,
                        openProfileSettings = ::openProfileSettings,
                        openPhoneContacts = ::openPhoneContacts,
                        syncPhoneContacts = ::requestPhoneContactSync,
                        openSystemSettings = ::openSystemSettings,
                        saveAgentNote = ::saveAgentNote,
                        back = ::backToTab,
                        openForwarding = ::openForwarding,
                        openBilling = ::openBilling,
                        openCheckout = ::openBillingCheckout,
                        activateBilling = ::activateBilling,
                        signOut = ::signOut,
                        dial = ::dial,
                        createTopic = ::createTopic,
                        acceptSuggestion = { id -> decideTopicSuggestion(id, true) },
                        dismissSuggestion = { id -> decideTopicSuggestion(id, false) },
                        callNumber = ::dialPhoneNumber
                    )
                )
            }
        }
        registerReceiverCompat()
        track("app_opened", screen = "startup", result = "created")
        initialize()
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    override fun onDestroy() {
        runCatching { unregisterReceiver(pushReceiver) }
        super.onDestroy()
    }

    private fun initialize() {
        if (FirebaseApp.getApps(this).isEmpty()) {
            uiState = uiState.copy(
                screen = Screen.Auth,
                status = "Setup",
                error = "Authentication is not configured for this build."
            )
            return
        }
        FirebaseCrashlytics.getInstance().setCustomKey("ui", "compose")
        if (firebaseAuth?.currentUser == null) {
            uiState = uiState.copy(screen = Screen.Auth, status = "Setup", loading = false)
        } else {
            uiState = uiState.copy(screen = Screen.Startup, status = "Syncing", loading = true, error = null)
            scope.launch {
                hydrateFromCache()
                loadData(forceStatus = true)
            }
            scope.launch { registerFcmToken() }
        }
    }

    private fun handleIntent(intent: Intent?) {
        val target = intent?.getStringExtra(NotificationActionReceiver.EXTRA_NOTIFICATION_TARGET).orEmpty()
        if (target.startsWith("assistant")) {
            uiState = uiState.copy(selectedTab = Tab.Assistant, screen = Screen.Main)
            scope.launch { loadData(forceStatus = true) }
        }
    }

    private fun registerReceiverCompat() {
        val filter = IntentFilter(ACTION_PUSH_REFRESH)
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(pushReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            registerReceiver(pushReceiver, filter)
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1001)
        }
    }

    private fun selectTab(tab: Tab) {
        uiState = uiState.copy(selectedTab = tab, screen = Screen.Main, error = null)
        FirebaseCrashlytics.getInstance().setCustomKey("screen", tab.label)
        track("tab_selected", screen = tab.label.lowercase(), action = "select", objectType = "tab", objectId = tab.label.lowercase())
    }

    private fun openTopic(topicId: String) {
        uiState = uiState.copy(screen = Screen.TopicDetail(topicId))
        track("topic_opened", screen = "topic_detail", action = "open", objectType = "topic", objectId = topicId)
    }

    private fun openCall(providerCallId: String) {
        uiState = uiState.copy(screen = Screen.CallDetail(providerCallId))
        track("call_row_opened", screen = "call_detail", action = "open", objectType = "call", objectId = providerCallId)
    }

    private fun openAddNote(targetPhoneNumber: String) {
        uiState = uiState.copy(screen = Screen.AddNote(targetPhoneNumber))
        track("note_composer_opened", screen = "add_note", action = "open")
    }

    private fun openProfileSettings() {
        uiState = uiState.copy(screen = Screen.ProfileSettings)
        track("profile_opened", screen = "profile", action = "open")
    }

    private fun openForwarding() {
        uiState = uiState.copy(screen = Screen.Forwarding)
        track("forwarding_opened", screen = "forwarding", action = "open")
    }

    private fun openBilling() {
        uiState = uiState.copy(screen = Screen.Billing)
        track("billing_setup_opened", screen = "billing", action = "open")
    }

    private fun openPhoneContacts() {
        uiState = uiState.copy(screen = Screen.PhoneContacts)
        track(
            "contacts_opened",
            screen = "phone_contacts",
            action = "open",
            attributes = mapOf("synced_count" to uiState.contactSync.syncedCount)
        )
    }

    private fun requestPhoneContactSync() {
        if (checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            uiState = uiState.copy(contactSyncing = true, status = "Syncing", contactPermissionDenied = false)
            track("contacts_permission_requested", screen = "phone_contacts", action = "permission")
            contactsPermissionLauncher.launch(Manifest.permission.READ_CONTACTS)
            return
        }
        syncPhoneContacts()
    }

    private fun syncPhoneContacts() {
        scope.launch {
            try {
                uiState = uiState.copy(contactSyncing = true, loading = true, status = "Syncing", error = null, contactPermissionDenied = false)
                    val contacts = withContext(Dispatchers.IO) { contactReader.readPhoneContacts() }
                val status = viewModel.syncContacts(requireToken(), contacts)
                uiState = uiState.copy(contactSyncing = false, loading = false, contactSync = status, status = if (uiState.onboarding.ready) "Active" else "Setup")
                toast("${status.syncedCount} contacts synced")
                track(
                    "contacts_sync_succeeded",
                    screen = "phone_contacts",
                    action = "sync",
                    result = "success",
                    attributes = mapOf(
                        "synced_count" to status.syncedCount,
                        "phone_number_count" to status.phoneNumberCount
                    )
                )
                loadData(forceStatus = true, keepScreen = true)
            } catch (error: Exception) {
                uiState = uiState.copy(contactSyncing = false, loading = false, status = if (uiState.onboarding.ready) "Active" else "Setup", error = readableError(error))
                toast("Could not sync contacts.")
                track("contacts_sync_failed", screen = "phone_contacts", action = "sync", result = "failed")
            }
        }
    }

    private fun openSystemSettings() {
        startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null)))
    }

    private fun backToTab() {
        uiState = uiState.copy(screen = Screen.Main)
    }

    private fun startPhoneAuth(displayName: String, phoneNumber: String) {
        val auth = firebaseAuth ?: return
        val normalized = normalizePhone(phoneNumber)
        if (displayName.trim().isEmpty() || !isValidE164Phone(normalized)) {
            toast("Enter your name and a valid mobile number.")
            return
        }
        pendingDisplayName = displayName.trim()
        uiState = uiState.copy(loading = true, status = "Sending", error = null)
        val options = PhoneAuthOptions.newBuilder(auth)
            .setPhoneNumber(normalized)
            .setTimeout(60L, TimeUnit.SECONDS)
            .setActivity(this)
            .setCallbacks(object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                    signInWithCredential(credential)
                }

                override fun onVerificationFailed(error: FirebaseException) {
                    uiState = uiState.copy(loading = false, status = "Setup", error = readableError(error))
                    toast("Could not send code.")
                }

                override fun onCodeSent(verificationId: String, token: PhoneAuthProvider.ForceResendingToken) {
                    uiState = uiState.copy(
                        loading = false,
                        status = "Verify",
                        screen = Screen.CodeEntry(verificationId),
                        error = null
                    )
                }
            })
            .build()
        runCatching { PhoneAuthProvider.verifyPhoneNumber(options) }
            .onFailure {
                uiState = uiState.copy(loading = false, status = "Setup", error = readableError(it))
            }
    }

    private fun verifyPhoneCode(verificationId: String, code: String) {
        if (code.trim().isEmpty()) {
            toast("Enter the verification code.")
            return
        }
        uiState = uiState.copy(loading = true, status = "Verifying")
        signInWithCredential(PhoneAuthProvider.getCredential(verificationId, code.trim()))
    }

    private fun signInWithCredential(credential: PhoneAuthCredential) {
        val auth = firebaseAuth ?: return
        auth.signInWithCredential(credential).addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                uiState = uiState.copy(loading = false, status = "Setup", error = task.exception?.message ?: "Could not verify phone.")
                return@addOnCompleteListener
            }
            scope.launch {
                try {
                    viewModel.updateDisplayName(requireToken(), pendingDisplayName.ifBlank { "Phone Agent User" })
                    scope.launch { registerFcmToken() }
                    uiState = uiState.copy(loading = false, status = "Setup", screen = Screen.AssistantName, error = null)
                    loadData(forceStatus = true, keepScreen = true)
                } catch (error: Exception) {
                    uiState = uiState.copy(loading = false, status = "Setup", error = readableError(error))
                }
            }
        }
    }

    private fun saveAssistantName(name: String) {
        scope.launch {
            try {
                uiState = uiState.copy(loading = true, status = "Saving")
                viewModel.updateAssistantProfile(
                    requireToken(),
                    AssistantProfileUpdate(
                        assistantName = name.trim().ifBlank { "Assistant" },
                        greetingStyle = "warm",
                        disclosureStyle = "standard",
                        warmth = 4,
                        brevity = 4,
                        proactivity = 3
                    )
                )
                uiState = uiState.copy(loading = false, screen = Screen.Main, selectedTab = Tab.Home)
                loadData(forceStatus = true)
            } catch (error: Exception) {
                uiState = uiState.copy(loading = false, status = "Setup", error = readableError(error))
            }
        }
    }

    private suspend fun loadData(forceStatus: Boolean = false, keepScreen: Boolean = false) {
        val user = firebaseAuth?.currentUser
        if (user == null) {
            uiState = uiState.copy(screen = Screen.Auth, loading = false, status = "Setup")
            return
        }
        track("data_refresh_started", screen = uiState.selectedTab.label.lowercase(), action = "refresh")
        try {
            val loaded = viewModel.refreshData(user.idToken(), forceStatus, keepScreen)
            track(
                "data_refresh_succeeded",
                screen = uiState.selectedTab.label.lowercase(),
                action = "refresh",
                result = "success",
                attributes = mapOf(
                    "topics_count" to loaded.topics.size,
                    "calls_count" to loaded.calls.size,
                    "notifications_count" to loaded.notifications.size,
                    "synced_count" to loaded.contactSync.syncedCount
                )
            )
        } catch (error: Exception) {
            val issueScreen = if (uiState.screen is Screen.Startup) Screen.StartupIssue else uiState.screen
            uiState = uiState.copy(
                loading = false,
                screen = issueScreen,
                status = if (uiState.user.id.isNotEmpty()) uiState.status else "Setup",
                error = readableError(error)
            )
            track("data_refresh_failed", screen = uiState.selectedTab.label.lowercase(), action = "refresh", result = "failed")
        }
    }

    private fun signOut() {
        track("logout_completed", screen = "profile", action = "logout", result = "success")
        firebaseAuth?.signOut()
        scope.launch { viewModel.clearCache() }
        uiState = PhoneAgentUiState(screen = Screen.Auth, status = "Setup")
    }

    private suspend fun hydrateFromCache(): Boolean {
        if (firebaseAuth?.currentUser == null) return false
        return viewModel.hydrateFromCache() != null
    }

    private fun createTopic(title: String, description: String) {
        if (title.trim().isEmpty()) {
            toast("Add a topic title.")
            return
        }
        scope.launch {
            try {
                uiState = uiState.copy(loading = true, status = "Saving")
                viewModel.createTopic(
                    requireToken(),
                    TopicCreateRequest(title = title.trim(), description = description.trim().ifBlank { null })
                )
                toast("Topic created")
                uiState = uiState.copy(loading = false, screen = Screen.Main, selectedTab = Tab.Topics)
                loadData(forceStatus = true)
            } catch (error: Exception) {
                uiState = uiState.copy(loading = false, error = readableError(error))
            }
        }
    }

    private fun decideTopicSuggestion(id: String, accept: Boolean) {
        scope.launch {
            try {
                uiState = uiState.copy(loading = true, status = "Saving")
                viewModel.decideTopicSuggestion(requireToken(), id, accept)
                loadData(forceStatus = true)
            } catch (error: Exception) {
                uiState = uiState.copy(loading = false, error = readableError(error))
            }
        }
    }

    private fun saveAgentNote(text: String, targetPhoneNumber: String) {
        val note = text.trim()
        if (note.isBlank()) {
            toast("Write a note first.")
            return
        }
        scope.launch {
            try {
                uiState = uiState.copy(loading = true, status = "Saving", error = null)
                viewModel.createAgentNote(
                    requireToken(),
                    AgentNoteCreateRequest(
                        text = note,
                        targetPhoneNumber = targetPhoneNumber.trim().takeIf { it.isNotBlank() }?.let(::normalizePhone)
                    )
                )
                toast("Assistant note saved")
                uiState = uiState.copy(loading = false, screen = Screen.Main, selectedTab = Tab.Assistant)
                loadData(forceStatus = true)
            } catch (error: Exception) {
                uiState = uiState.copy(loading = false, status = "Active", error = readableError(error))
            }
        }
    }

    private fun openBillingCheckout() {
        scope.launch {
            try {
                uiState = uiState.copy(loading = true, status = "Opening")
                val url = viewModel.createBillingCheckoutSession(requireToken())
                if (url.isEmpty()) error("Payment setup did not return a secure URL.")
                uiState = uiState.copy(loading = false, status = "Billing")
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            } catch (error: Exception) {
                uiState = uiState.copy(loading = false, error = "Could not open payment setup.")
            }
        }
    }

    private fun activateBilling() {
        scope.launch {
            try {
                uiState = uiState.copy(loading = true, status = "Checking")
                viewModel.activateBilling(requireToken())
                loadData(forceStatus = true)
            } catch (error: Exception) {
                uiState = uiState.copy(loading = false, error = "Could not check billing yet.")
            }
        }
    }

    private fun dial() {
        val assistantNumber = uiState.user.assistantNumber.ifBlank { BuildConfig.PHONE_AGENT_NUMBER }
        val code = "*71${assistantNumber.toForwardingDigits()}"
        startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(code)}")))
    }

    private fun dialPhoneNumber(value: String) {
        if (value.isBlank()) return
        startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(value)}")))
    }

    private suspend fun registerFcmToken() {
        val user = firebaseAuth?.currentUser ?: return
        runCatching {
            val token = withTimeoutOrNull(5000) { FirebaseMessaging.getInstance().token.await() } ?: return@runCatching
            viewModel.registerPushToken(
                user.idToken(),
                PushTokenRegistrationRequest(
                    token = token,
                    deviceId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID),
                    appVersion = BuildConfig.VERSION_NAME
                )
            )
        }
    }

    private fun track(
        eventName: String,
        screen: String? = null,
        action: String? = null,
        result: String? = null,
        objectType: String? = null,
        objectId: String? = null,
        attributes: Map<String, Any> = emptyMap()
    ) {
        analyticsTracker.track(scope, eventName, screen, action, result, objectType, objectId, attributes)
    }

    private suspend fun requireToken(user: FirebaseUser? = firebaseAuth?.currentUser): String =
        user?.idToken() ?: error("Sign in required.")

    private fun readableError(error: Throwable): String {
        val message = error.message.orEmpty()
        return when {
            message.contains("network", ignoreCase = true) ||
                message.contains("timeout", ignoreCase = true) ||
                message.contains("unreachable", ignoreCase = true) ||
                message.contains("unable to resolve host", ignoreCase = true) ||
                message.contains("no address associated", ignoreCase = true) ->
                "We could not reach Phone Agent. Check your connection and try again."
            message.contains("HTTP 401", ignoreCase = true) || message.contains("HTTP 403", ignoreCase = true) ->
                "Please sign in again to continue."
            message.contains("HTTP", ignoreCase = true) ->
                "Phone Agent could not finish that request. Please try again."
            message.isNotBlank() && message.length <= 120 -> message
            else -> "Something went wrong. Please try again."
        }
    }

    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
}
