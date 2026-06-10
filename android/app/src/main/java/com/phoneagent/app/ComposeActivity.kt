package com.phoneagent.app

import android.Manifest
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
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.phoneagent.app.data.AgentNoteCreateRequest
import com.phoneagent.app.data.TopicCreateRequest
import com.phoneagent.app.data.remote.PhoneAgentApiException
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@AndroidEntryPoint
class ComposeActivity : ComponentActivity() {
    companion object {
        const val ACTION_PUSH_REFRESH = "com.phoneagent.app.PUSH_REFRESH"
    }

    private val scope = CoroutineScope(Dispatchers.Main)
    private val viewModel: PhoneAgentViewModel by viewModels()
    private val homeScreenViewModel: HomeScreenViewModel by viewModels()
    private val onboardingViewModel: OnboardingViewModel by viewModels()
    private val billingViewModel: BillingViewModel by viewModels()
    private val contactsViewModel: ContactsViewModel by viewModels()
    private val assistantLiveViewModel: AssistantLiveViewModel by viewModels()
    @Inject internal lateinit var firebaseAuth: FirebaseAuth
    @Inject internal lateinit var contactReader: AndroidContactReader
    @Inject internal lateinit var analyticsTracker: PhoneAgentAnalyticsTracker
    private var uiState: PhoneAgentUiState
        get() = viewModel.uiState.value
        set(value) {
            viewModel.setState(value)
        }
    private lateinit var contactsPermissionLauncher: ActivityResultLauncher<String>
    private lateinit var onboardingCoordinator: PhoneOnboardingCoordinator
    private lateinit var billingCoordinator: BillingCoordinator
    private lateinit var contactSyncCoordinator: ContactSyncCoordinator
    private lateinit var fcmRegistrationCoordinator: FcmRegistrationCoordinator

    private val pushReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            scope.launch { loadData(forceStatus = true) }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        contactsPermissionLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            contactSyncCoordinator.onPermissionResult(granted)
        }
        fcmRegistrationCoordinator = FcmRegistrationCoordinator(applicationContext, scope, firebaseAuth, viewModel)
        onboardingCoordinator = PhoneOnboardingCoordinator(
            activity = this,
            scope = scope,
            firebaseAuth = firebaseAuth,
            onboardingViewModel = onboardingViewModel,
            getState = { uiState },
            setState = { uiState = it },
            tokenProvider = { requireToken() },
            clearLocalCache = { viewModel.clearCache() },
            registerPushToken = { fcmRegistrationCoordinator.registerCurrentToken() },
            refreshData = { forceStatus, keepScreen -> loadData(forceStatus = forceStatus, keepScreen = keepScreen) },
            readableError = ::readableError,
            toast = ::toast
        )
        billingCoordinator = BillingCoordinator(
            activity = this,
            scope = scope,
            billingViewModel = billingViewModel,
            getState = { uiState },
            setState = { uiState = it },
            tokenProvider = { requireToken() },
            refreshData = { forceStatus, keepScreen -> loadData(forceStatus = forceStatus, keepScreen = keepScreen) }
        )
        contactSyncCoordinator = ContactSyncCoordinator(
            scope = scope,
            contactReader = contactReader,
            contactsViewModel = contactsViewModel,
            hasContactsPermission = { checkSelfPermission(Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED },
            requestContactsPermission = { contactsPermissionLauncher.launch(Manifest.permission.READ_CONTACTS) },
            getState = { uiState },
            setState = { uiState = it },
            tokenProvider = { requireToken() },
            refreshData = { forceStatus, keepScreen -> loadData(forceStatus = forceStatus, keepScreen = keepScreen) },
            readableError = ::readableError,
            toast = ::toast,
            track = { eventName, screen, action, result, attributes ->
                track(eventName, screen = screen, action = action, result = result, attributes = attributes)
            }
        )
        requestNotificationPermission()
        setContent {
            val state by viewModel.uiState.collectAsState()
            PhoneAgentTheme {
                PhoneAgentApp(
                    state = state,
                    actions = AppActions(
                        selectTab = ::selectTab,
                        refresh = { scope.launch { loadData(forceStatus = true) } },
                        openLogin = { uiState = uiState.copy(screen = Screen.Login, error = null) },
                        openCreateAccount = { uiState = uiState.copy(screen = Screen.CreateAccount, error = null) },
                        startGoogleAuth = onboardingCoordinator::startGoogleAuth,
                        startEmailPasswordAuth = onboardingCoordinator::startEmailPasswordAuth,
                        sendPasswordReset = onboardingCoordinator::sendPasswordReset,
                        startPhoneVerification = onboardingCoordinator::startPhoneVerification,
                        verifyPhoneCode = onboardingCoordinator::verifyPhoneCode,
                        saveAssistantName = onboardingCoordinator::saveAssistantName,
                        openTopics = ::openTopics,
                        openReview = ::openReview,
                        openSearch = ::openSearch,
                        openTopic = ::openTopic,
                        openCall = ::openCall,
                        openAddNote = ::openAddNote,
                        openProfileSettings = ::openProfileSettings,
                        openPhoneContacts = ::openPhoneContacts,
                        syncPhoneContacts = contactSyncCoordinator::requestSync,
                        disconnectPhoneContacts = contactSyncCoordinator::disconnectContacts,
                        openSystemSettings = ::openSystemSettings,
                        saveAgentNote = ::saveAgentNote,
                        archiveAgentNote = ::archiveAgentNote,
                        acceptTransfer = ::acceptTransfer,
                        declineTransfer = ::declineTransfer,
                        sendLiveAnswer = ::sendLiveAnswer,
                        declineLiveAnswer = ::declineLiveAnswer,
                        back = ::backToTab,
                        openForwarding = ::openForwarding,
                        openBilling = ::openBilling,
                        openCheckout = billingCoordinator::openBillingManagement,
                        activateBilling = billingCoordinator::activateBilling,
                        cancelSubscription = billingCoordinator::cancelSubscription,
                        removeAccount = ::removeAccount,
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

    override fun onPause() {
        if (::billingCoordinator.isInitialized) {
            billingCoordinator.onHostPause()
        }
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        if (::billingCoordinator.isInitialized) {
            billingCoordinator.onHostResume()
        }
    }

    override fun onDestroy() {
        runCatching { unregisterReceiver(pushReceiver) }
        super.onDestroy()
    }

    private fun initialize() {
        if (FirebaseApp.getApps(this).isEmpty()) {
            uiState = uiState.copy(
                screen = Screen.AuthChoice,
                status = "Setup",
                error = "Authentication is not configured for this build."
            )
            return
        }
        FirebaseCrashlytics.getInstance().setCustomKey("ui", "compose")
        if (firebaseAuth?.currentUser == null) {
            uiState = uiState.copy(screen = Screen.AuthChoice, status = "Setup", loading = false)
        } else {
            uiState = uiState.copy(screen = Screen.Startup, status = "Syncing", loading = true, error = null)
            scope.launch {
                hydrateFromCache()
                loadData(forceStatus = true)
            }
            fcmRegistrationCoordinator.register()
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
        ContextCompat.registerReceiver(this, pushReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
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

    private fun openTopics() {
        uiState = uiState.copy(screen = Screen.Topics, error = null)
        track("topics_opened", screen = "topics", action = "open")
    }

    private fun openReview() {
        uiState = uiState.copy(screen = Screen.Review, error = null)
        track("review_opened", screen = "review", action = "open")
    }

    private fun openSearch() {
        uiState = uiState.copy(screen = Screen.Search, error = null)
        track("search_opened", screen = "search", action = "open")
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
        uiState = uiState.copy(screen = Screen.Main, selectedTab = Tab.Profile, error = null)
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

    private fun openSystemSettings() {
        startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null)))
    }

    private fun backToTab() {
        uiState = uiState.copy(screen = Screen.Main)
    }

    private suspend fun loadData(forceStatus: Boolean = false, keepScreen: Boolean = false) {
        val user = firebaseAuth?.currentUser
        if (user == null) {
            uiState = uiState.copy(screen = Screen.AuthChoice, loading = false, status = "Setup")
            return
        }
        track("data_refresh_started", screen = uiState.selectedTab.label.lowercase(), action = "refresh")
        try {
            val loaded = viewModel.refreshData(user.idToken(), forceStatus, keepScreen)
            homeScreenViewModel.update(loaded)
            assistantLiveViewModel.update(loaded)
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
            val hasCachedShell = uiState.user.id.isNotEmpty()
            val issueScreen = when {
                hasCachedShell && uiState.screen is Screen.Startup -> Screen.Main
                uiState.screen is Screen.Startup -> Screen.StartupIssue
                else -> uiState.screen
            }
            uiState = uiState.copy(
                loading = false,
                screen = issueScreen,
                status = if (hasCachedShell) "Offline" else "Setup",
                dataFreshness = if (hasCachedShell) uiState.dataFreshness.offline() else uiState.dataFreshness,
                error = readableError(error)
            )
            track("data_refresh_failed", screen = uiState.selectedTab.label.lowercase(), action = "refresh", result = "failed")
        }
    }

    private fun signOut() {
        track("logout_completed", screen = "profile", action = "logout", result = "success")
        onboardingCoordinator.clearCredentialState()
        firebaseAuth?.signOut()
        scope.launch { viewModel.clearCache() }
        uiState = PhoneAgentUiState(screen = Screen.AuthChoice, status = "Setup")
    }

    private fun removeAccount() {
        scope.launch {
            try {
                uiState = uiState.copy(loading = true, status = "Removing", error = null)
                viewModel.removeAccount(requireToken())
                track("account_removed", screen = "profile", action = "delete", result = "success")
                runCatching { firebaseAuth?.currentUser?.delete()?.await() }
                onboardingCoordinator.clearCredentialState()
                firebaseAuth?.signOut()
                viewModel.clearCache()
                uiState = PhoneAgentUiState(screen = Screen.AuthChoice, status = "Setup")
                toast("Account removed.")
            } catch (error: Exception) {
                uiState = uiState.copy(loading = false, status = "Profile", error = readableError(error))
                track("account_remove_failed", screen = "profile", action = "delete", result = "failed")
            }
        }
    }

    private suspend fun hydrateFromCache(): Boolean {
        if (firebaseAuth?.currentUser == null) return false
        val snapshot = viewModel.hydrateFromCache() ?: return false
        homeScreenViewModel.update(snapshot)
        assistantLiveViewModel.update(snapshot)
        return true
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
                uiState = uiState.copy(loading = false, screen = Screen.Topics)
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

    private fun saveAgentNote(text: String, targetPhoneNumber: String, topic: String) {
        val note = text.trim()
        if (note.isBlank()) {
            toast("Write a note first.")
            return
        }
        scope.launch {
            try {
                uiState = uiState.copy(loading = true, status = "Saving", error = null)
                assistantLiveViewModel.createAgentNote(
                    requireToken(),
                    AgentNoteCreateRequest(
                        text = note,
                        targetPhoneNumber = targetPhoneNumber.trim().takeIf { it.isNotBlank() }?.let(::normalizePhone),
                        topic = topic.trim().takeIf { it.isNotBlank() }
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

    private fun archiveAgentNote(noteId: String) {
        scope.launch {
            try {
                uiState = uiState.copy(loading = true, status = "Saving", error = null)
                assistantLiveViewModel.archiveAgentNote(requireToken(), noteId)
                toast("Assistant note archived")
                loadData(forceStatus = true, keepScreen = true)
            } catch (error: Exception) {
                uiState = uiState.copy(loading = false, error = readableError(error))
            }
        }
    }

    private fun acceptTransfer(approvalRequestId: String) {
        submitLiveAction(successMessage = "Transfer approved.") {
            assistantLiveViewModel.acceptTransfer(requireToken(), approvalRequestId)
        }
    }

    private fun declineTransfer(approvalRequestId: String) {
        submitLiveAction(successMessage = "Transfer declined.") {
            assistantLiveViewModel.declineTransfer(requireToken(), approvalRequestId)
        }
    }

    private fun sendLiveAnswer(answerRequestId: String, answer: String) {
        if (answer.trim().isBlank()) {
            toast("Write an answer first.")
            return
        }
        submitLiveAction(successMessage = "Answer sent to assistant.") {
            assistantLiveViewModel.sendLiveAnswer(requireToken(), answerRequestId, answer.trim())
        }
    }

    private fun declineLiveAnswer(answerRequestId: String) {
        submitLiveAction(successMessage = "Assistant will take a message.") {
            assistantLiveViewModel.declineLiveAnswer(requireToken(), answerRequestId)
        }
    }

    private fun submitLiveAction(successMessage: String, action: suspend () -> Unit) {
        scope.launch {
            try {
                uiState = uiState.copy(loading = true, status = "Saving", error = null)
                action()
                toast(successMessage)
                loadData(forceStatus = true, keepScreen = true)
            } catch (error: Exception) {
                val message = readableError(error)
                uiState = uiState.copy(loading = false, error = message)
                toast(message)
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
            error is PhoneAgentApiException && error.apiCode == "answer_request_expired" ->
                "This answer request expired. The assistant can no longer relay it."
            error is PhoneAgentApiException && error.apiCode == "approval_request_expired" ->
                "This transfer request expired. The assistant is taking a message."
            error is PhoneAgentApiException && (error.statusCode == 401 || error.statusCode == 403) ->
                "Please sign in again to continue."
            error is PhoneAgentApiException && message.isNotBlank() && message.length <= 120 ->
                message
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
