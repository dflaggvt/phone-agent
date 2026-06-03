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
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Assignment
import androidx.compose.material.icons.automirrored.filled.NoteAdd
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SettingsPhone
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import androidx.room.withTransaction
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.google.firebase.messaging.FirebaseMessaging
import com.phoneagent.app.data.local.CachedCallEntity
import com.phoneagent.app.data.local.CachedNotificationEntity
import com.phoneagent.app.data.local.CachedSingletonEntity
import com.phoneagent.app.data.local.CachedTopicEntity
import com.phoneagent.app.data.local.CachedTopicSuggestionEntity
import com.phoneagent.app.data.local.PhoneAgentDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class ComposeActivity : ComponentActivity() {
    companion object {
        const val ACTION_PUSH_REFRESH = "com.phoneagent.app.PUSH_REFRESH"
        private const val CACHE_USER = "user"
        private const val CACHE_BILLING = "billing"
        private const val CACHE_ONBOARDING = "onboarding"
        private const val CACHE_ACTIVE_CALL = "active_call"
    }

    private val scope = CoroutineScope(Dispatchers.Main)
    private var uiState by mutableStateOf(PhoneAgentUiState())
    private var firebaseAuth: FirebaseAuth? = null
    private lateinit var database: PhoneAgentDatabase
    private var pendingDisplayName = ""

    private val pushReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            scope.launch { loadData(forceStatus = true) }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        database = PhoneAgentDatabase.get(applicationContext)
        requestNotificationPermission()
        setContent {
            PhoneAgentTheme {
                PhoneAgentApp(
                    state = uiState,
                    actions = AppActions(
                        selectTab = ::selectTab,
                        refresh = { scope.launch { loadData(forceStatus = true) } },
                        startSignup = ::startPhoneAuth,
                        verifyCode = ::verifyPhoneCode,
                        saveAssistantName = ::saveAssistantName,
                        openTopic = ::openTopic,
                        openCall = ::openCall,
                        openAddNote = ::openAddNote,
                        saveAgentNote = ::saveAgentNote,
                        back = ::backToTab,
                        openForwarding = { uiState = uiState.copy(screen = Screen.Forwarding) },
                        openBilling = { uiState = uiState.copy(screen = Screen.Billing) },
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
        firebaseAuth = FirebaseAuth.getInstance()
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
    }

    private fun openTopic(topicId: String) {
        uiState = uiState.copy(screen = Screen.TopicDetail(topicId))
    }

    private fun openCall(providerCallId: String) {
        uiState = uiState.copy(screen = Screen.CallDetail(providerCallId))
    }

    private fun openAddNote(targetPhoneNumber: String) {
        uiState = uiState.copy(screen = Screen.AddNote(targetPhoneNumber))
    }

    private fun backToTab() {
        uiState = uiState.copy(screen = Screen.Main)
    }

    private fun startPhoneAuth(displayName: String, phoneNumber: String) {
        val auth = firebaseAuth ?: return
        val normalized = normalizePhone(phoneNumber)
        if (displayName.trim().isEmpty() || !normalized.matches(Regex("^\\+[1-9][0-9]{9,14}$"))) {
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
                    authedPatch("/v1/me/config", JSONObject().put("displayName", pendingDisplayName.ifBlank { "Phone Agent User" }))
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
                val payload = JSONObject()
                    .put("assistantName", name.trim().ifBlank { "Assistant" })
                    .put("greetingStyle", "warm")
                    .put("disclosureStyle", "standard")
                    .put("warmth", 4)
                    .put("brevity", 4)
                    .put("proactivity", 3)
                authedPatch("/v1/me/assistant-profile", payload)
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
        uiState = uiState.copy(loading = true, status = if (forceStatus) "Syncing" else uiState.status)
        try {
            val loaded = withContext(Dispatchers.IO) {
                val token = user.idToken()
                LoadedData(
                    me = getJson("/v1/me", token).optJSONObject("user")?.let(::UserSummary) ?: UserSummary.empty,
                    billing = getJson("/v1/billing/account", token).optJSONObject("account")?.let(::BillingAccount) ?: BillingAccount.empty,
                    onboarding = getJson("/v1/onboarding/status", token).optJSONObject("status")?.let(::OnboardingStatus) ?: OnboardingStatus.empty,
                    topics = getJson("/v1/topics", token).optJSONArray("topics").toList(::TopicThread),
                    calls = getJson("/v1/calls", token).optJSONArray("calls").toList(::CallRecord),
                    suggestions = getJson("/v1/topic-suggestions", token).optJSONArray("suggestions").toList(::TopicSuggestion),
                    notifications = getJson("/v1/notifications?unread=true", token).optJSONArray("notifications").toList(::AppNotification),
                    activeCall = getJson("/v1/calls/active", token).optJSONObject("activeCall")?.let(::ActiveCall)
                )
            }
            uiState = uiState.copy(
                loading = false,
                status = if (loaded.activeCall != null) "Live" else if (loaded.onboarding.ready) "Active" else "Setup",
                user = loaded.me,
                billing = loaded.billing,
                onboarding = loaded.onboarding,
                topics = loaded.topics,
                calls = loaded.calls,
                suggestions = loaded.suggestions,
                notifications = loaded.notifications,
                activeCall = loaded.activeCall,
                screen = if (keepScreen) uiState.screen else if (uiState.screen is Screen.Auth || uiState.screen is Screen.CodeEntry || uiState.screen is Screen.Startup || uiState.screen is Screen.StartupIssue) Screen.Main else uiState.screen,
                error = null
            )
            runCatching { cacheLoadedData(loaded) }
                .onFailure { FirebaseCrashlytics.getInstance().recordException(it) }
        } catch (error: Exception) {
            val issueScreen = if (uiState.screen is Screen.Startup) Screen.StartupIssue else uiState.screen
            uiState = uiState.copy(
                loading = false,
                screen = issueScreen,
                status = if (uiState.user.id.isNotEmpty()) uiState.status else "Setup",
                error = readableError(error)
            )
        }
    }

    private fun signOut() {
        firebaseAuth?.signOut()
        scope.launch(Dispatchers.IO) { clearCache() }
        uiState = PhoneAgentUiState(screen = Screen.Auth, status = "Setup")
    }

    private suspend fun hydrateFromCache(): Boolean {
        val cached = readCachedData() ?: return false
        if (firebaseAuth?.currentUser == null) return false
        uiState = uiState.copy(
            loading = false,
            status = if (cached.activeCall != null) "Live" else if (cached.onboarding.ready) "Active" else "Setup",
            user = cached.me,
            billing = cached.billing,
            onboarding = cached.onboarding,
            topics = cached.topics,
            calls = cached.calls,
            suggestions = cached.suggestions,
            notifications = cached.notifications,
            activeCall = cached.activeCall,
            screen = if (uiState.screen is Screen.Startup || uiState.screen is Screen.StartupIssue) Screen.Main else uiState.screen,
            error = null
        )
        return true
    }

    private suspend fun readCachedData(): LoadedData? = withContext(Dispatchers.IO) {
        val dao = database.cacheDao()
        val user = dao.singleton(CACHE_USER)
        val billing = dao.singleton(CACHE_BILLING)
        val onboarding = dao.singleton(CACHE_ONBOARDING)
        val activeCall = dao.singleton(CACHE_ACTIVE_CALL)
        val topics = dao.topics()
        val calls = dao.calls()
        val suggestions = dao.topicSuggestions()
        val notifications = dao.notifications()
        val hasCachedState = user != null ||
            billing != null ||
            onboarding != null ||
            activeCall != null ||
            topics.isNotEmpty() ||
            calls.isNotEmpty() ||
            suggestions.isNotEmpty() ||
            notifications.isNotEmpty()
        if (!hasCachedState) return@withContext null
        LoadedData(
            me = user?.json?.let { UserSummary(cachedJson(it)) } ?: UserSummary.empty,
            billing = billing?.json?.let { BillingAccount(cachedJson(it)) } ?: BillingAccount.empty,
            onboarding = onboarding?.json?.let { OnboardingStatus(cachedJson(it)) } ?: OnboardingStatus.empty,
            topics = topics.map { TopicThread(cachedJson(it.json)) },
            calls = calls.map { CallRecord(cachedJson(it.json)) },
            suggestions = suggestions.map { TopicSuggestion(cachedJson(it.json)) },
            notifications = notifications.map { AppNotification(cachedJson(it.json)) },
            activeCall = activeCall?.json?.let { ActiveCall(cachedJson(it)) }
        )
    }

    private suspend fun cacheLoadedData(loaded: LoadedData) = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        database.withTransaction {
            val dao = database.cacheDao()
            dao.upsertSingleton(CachedSingletonEntity(CACHE_USER, loaded.me.json.toString(), now))
            dao.upsertSingleton(CachedSingletonEntity(CACHE_BILLING, loaded.billing.json.toString(), now))
            dao.upsertSingleton(CachedSingletonEntity(CACHE_ONBOARDING, loaded.onboarding.json.toString(), now))
            if (loaded.activeCall == null) {
                dao.deleteSingleton(CACHE_ACTIVE_CALL)
            } else {
                dao.upsertSingleton(CachedSingletonEntity(CACHE_ACTIVE_CALL, loaded.activeCall.json.toString(), now))
            }

            dao.clearTopics()
            if (loaded.topics.isNotEmpty()) {
                dao.upsertTopics(
                    loaded.topics.map { topic ->
                        CachedTopicEntity(
                            id = stableCacheId("topic", topic.id, topic.json),
                            title = topic.title,
                            description = topic.description,
                            communicationCount = topic.communicationCount,
                            cachedAtEpochMs = now,
                            json = topic.json.toString()
                        )
                    }
                )
            }

            dao.clearCalls()
            if (loaded.calls.isNotEmpty()) {
                dao.upsertCalls(
                    loaded.calls.map { call ->
                        CachedCallEntity(
                            id = stableCacheId("call", call.providerCallId, call.json),
                            displayCaller = call.displayCaller,
                            phoneNumber = call.phone,
                            occurredAt = call.occurredAt,
                            cachedAtEpochMs = now,
                            json = call.json.toString()
                        )
                    }
                )
            }

            dao.clearTopicSuggestions()
            if (loaded.suggestions.isNotEmpty()) {
                dao.upsertTopicSuggestions(
                    loaded.suggestions.map { suggestion ->
                        CachedTopicSuggestionEntity(
                            id = stableCacheId("suggestion", suggestion.id, suggestion.json),
                            title = suggestion.title,
                            confidence = suggestion.confidence,
                            cachedAtEpochMs = now,
                            json = suggestion.json.toString()
                        )
                    }
                )
            }

            dao.clearNotifications()
            if (loaded.notifications.isNotEmpty()) {
                dao.upsertNotifications(
                    loaded.notifications.map { notification ->
                        CachedNotificationEntity(
                            id = stableCacheId("notification", notification.id, notification.json),
                            title = notification.title,
                            cachedAtEpochMs = now,
                            json = notification.json.toString()
                        )
                    }
                )
            }
        }
    }

    private suspend fun clearCache() {
        database.withTransaction {
            val dao = database.cacheDao()
            dao.clearSingletons()
            dao.clearTopics()
            dao.clearCalls()
            dao.clearTopicSuggestions()
            dao.clearNotifications()
        }
    }

    private fun createTopic(title: String, description: String) {
        if (title.trim().isEmpty()) {
            toast("Add a topic title.")
            return
        }
        scope.launch {
            try {
                uiState = uiState.copy(loading = true, status = "Saving")
                val payload = JSONObject().put("title", title.trim())
                if (description.trim().isNotEmpty()) payload.put("description", description.trim())
                authedPost("/v1/topics", payload)
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
                authedPost("/v1/topic-suggestions/$id/${if (accept) "accept" else "dismiss"}", null)
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
                val payload = JSONObject().put("text", note)
                targetPhoneNumber.trim().takeIf { it.isNotBlank() }?.let { payload.put("targetPhoneNumber", normalizePhone(it)) }
                authedPost("/v1/agent-notes", payload)
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
                val session = authedPost("/v1/billing/checkout-session", JSONObject()).optJSONObject("session")
                val url = session?.optString("url").orEmpty()
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
                authedPost("/v1/billing/activate", JSONObject())
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
            val payload = JSONObject()
                .put("token", token)
                .put("platform", "android")
                .put("deviceId", Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID))
                .put("appVersion", BuildConfig.VERSION_NAME)
            authedPost("/v1/push-tokens", payload, user)
        }
    }

    private suspend fun authedPost(path: String, payload: JSONObject?, user: FirebaseUser? = firebaseAuth?.currentUser): JSONObject {
        val token = user?.idToken() ?: error("Sign in required.")
        return withContext(Dispatchers.IO) { request("POST", path, token, payload) }
    }

    private suspend fun authedPatch(path: String, payload: JSONObject): JSONObject {
        val token = firebaseAuth?.currentUser?.idToken() ?: error("Sign in required.")
        return withContext(Dispatchers.IO) { request("PATCH", path, token, payload) }
    }

    private fun getJson(path: String, token: String): JSONObject = request("GET", path, token, null)

    private fun request(method: String, path: String, token: String, payload: JSONObject?): JSONObject {
        val connection = (URL(BuildConfig.BACKEND_BASE_URL + path).openConnection() as HttpURLConnection)
        connection.requestMethod = method
        connection.connectTimeout = 8000
        connection.readTimeout = 8000
        connection.setRequestProperty("accept", "application/json")
        connection.setRequestProperty("authorization", "Bearer $token")
        connection.setRequestProperty("x-phone-agent-action-surface", "compose_app")
        if (payload != null) {
            connection.setRequestProperty("content-type", "application/json")
            connection.doOutput = true
            val body = payload.toString().toByteArray(StandardCharsets.UTF_8)
            connection.outputStream.use { output: OutputStream -> output.write(body) }
        }
        val status = connection.responseCode
        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
        val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        if (status !in 200..299) error("HTTP $status")
        return if (text.isBlank()) JSONObject() else JSONObject(text)
    }

    private suspend fun FirebaseUser.idToken(): String = getIdToken(false).await().token ?: error("Could not start session.")

    private suspend fun <T> com.google.android.gms.tasks.Task<T>.await(): T = suspendCancellableCoroutine { continuation ->
        addOnSuccessListener { continuation.resume(it) }
        addOnFailureListener { continuation.resumeWithException(it) }
    }

    private fun normalizePhone(value: String): String {
        val trimmed = value.trim()
        val digits = trimmed.replace(Regex("[^0-9]"), "")
        return when {
            trimmed.startsWith("+") -> "+$digits"
            digits.length == 10 -> "+1$digits"
            digits.length == 11 && digits.startsWith("1") -> "+$digits"
            digits.isNotEmpty() -> "+$digits"
            else -> ""
        }
    }

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

private data class PhoneAgentUiState(
    val screen: Screen = Screen.Auth,
    val selectedTab: Tab = Tab.Home,
    val status: String = "Setup",
    val loading: Boolean = false,
    val error: String? = null,
    val user: UserSummary = UserSummary.empty,
    val billing: BillingAccount = BillingAccount.empty,
    val onboarding: OnboardingStatus = OnboardingStatus.empty,
    val topics: List<TopicThread> = emptyList(),
    val calls: List<CallRecord> = emptyList(),
    val suggestions: List<TopicSuggestion> = emptyList(),
    val notifications: List<AppNotification> = emptyList(),
    val activeCall: ActiveCall? = null
)

private sealed interface Screen {
    data object Startup : Screen
    data object StartupIssue : Screen
    data object Auth : Screen
    data class CodeEntry(val verificationId: String) : Screen
    data object AssistantName : Screen
    data object Main : Screen
    data object Forwarding : Screen
    data object Billing : Screen
    data class TopicDetail(val topicId: String) : Screen
    data class CallDetail(val providerCallId: String) : Screen
    data class AddNote(val targetPhoneNumber: String = "") : Screen
}

private enum class Tab(val label: String, val icon: ImageVector) {
    Topics("Topics", Icons.Filled.Menu),
    Review("Review", Icons.AutoMirrored.Filled.Assignment),
    Home("Home", Icons.Filled.Home),
    Assistant("Assistant", Icons.Filled.Headphones),
    Search("Search", Icons.Filled.Search)
}

private data class AppActions(
    val selectTab: (Tab) -> Unit,
    val refresh: () -> Unit,
    val startSignup: (String, String) -> Unit,
    val verifyCode: (String, String) -> Unit,
    val saveAssistantName: (String) -> Unit,
    val openTopic: (String) -> Unit,
    val openCall: (String) -> Unit,
    val openAddNote: (String) -> Unit,
    val saveAgentNote: (String, String) -> Unit,
    val back: () -> Unit,
    val openForwarding: () -> Unit,
    val openBilling: () -> Unit,
    val openCheckout: () -> Unit,
    val activateBilling: () -> Unit,
    val signOut: () -> Unit,
    val dial: () -> Unit,
    val createTopic: (String, String) -> Unit,
    val acceptSuggestion: (String) -> Unit,
    val dismissSuggestion: (String) -> Unit,
    val callNumber: (String) -> Unit
)

@Composable
private fun PhoneAgentApp(state: PhoneAgentUiState, actions: AppActions) {
    BackHandler(
        enabled = when (state.screen) {
            Screen.Forwarding, Screen.Billing -> true
            is Screen.TopicDetail -> true
            is Screen.CallDetail -> true
            is Screen.AddNote -> true
            else -> false
        }
    ) {
        actions.back()
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(TwilightTop, TwilightMid, TwilightBottom)))
    ) {
        when (val screen = state.screen) {
            Screen.Startup -> StartupScreen(state, actions)
            Screen.StartupIssue -> StartupIssueScreen(state, actions)
            Screen.Auth -> AuthScreen(state, actions)
            is Screen.CodeEntry -> CodeScreen(state, screen.verificationId, actions)
            Screen.AssistantName -> AssistantNameScreen(state, actions)
            Screen.Main -> MainShell(state, actions)
            Screen.Forwarding -> ForwardingScreen(state, actions)
            Screen.Billing -> BillingScreen(state, actions)
            is Screen.TopicDetail -> TopicDetailScreen(state, screen.topicId, actions)
            is Screen.CallDetail -> CallDetailScreen(state, screen.providerCallId, actions)
            is Screen.AddNote -> AddNoteScreen(state, screen.targetPhoneNumber, actions)
        }
        if (state.loading && state.screen !is Screen.Startup && state.screen !is Screen.Auth && state.screen !is Screen.CodeEntry && state.screen !is Screen.AssistantName) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Brand)
            }
        }
    }
}

@Composable
private fun StartupScreen(state: PhoneAgentUiState, actions: AppActions) {
    Box(Modifier.fillMaxSize().statusBarsPadding().padding(20.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Surface(Modifier.size(72.dp), shape = CircleShape, color = Color.White.copy(alpha = 0.94f)) {
                Box(contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Brand, strokeWidth = 4.dp)
                }
            }
            Spacer(Modifier.height(16.dp))
            Text("Setting up your assistant", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(6.dp))
            Text(
                "Syncing your account, assistant number, calls, topics, and live requests.",
                color = Color.White.copy(alpha = 0.82f),
                fontSize = 15.sp,
                lineHeight = 21.sp
            )
        }
    }
}

@Composable
private fun StartupIssueScreen(state: PhoneAgentUiState, actions: AppActions) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().statusBarsPadding(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item { Header("Welcome", state.copy(status = "Setup"), {}, showRefresh = false) }
        item {
            Text("Could not finish setup", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
            Text("We could not load your account state. You can retry or start over.", color = Color.White.copy(alpha = 0.84f), fontSize = 15.sp, lineHeight = 21.sp)
        }
        item { ErrorCard(state.error ?: "Something interrupted setup. Please try again.") }
        item {
            WorkCard {
                PrimaryButton("Try again", Icons.Filled.Refresh) { actions.refresh() }
                Spacer(Modifier.height(6.dp))
                SecondaryButton("Start over", Modifier.fillMaxWidth(), actions.signOut)
            }
        }
    }
}

@Composable
private fun MainShell(state: PhoneAgentUiState, actions: AppActions) {
    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Header(state.selectedTab.label, state, actions.refresh)
        AnimatedContent(state.selectedTab, modifier = Modifier.weight(1f), label = "tab") { tab ->
            Box(Modifier.fillMaxSize()) {
                when (tab) {
                    Tab.Home -> HomeScreen(state, actions)
                    Tab.Topics -> TopicsScreen(state, actions)
                    Tab.Review -> ReviewScreen(state, actions)
                    Tab.Assistant -> AssistantScreen(state, actions)
                    Tab.Search -> SearchScreen(state, actions)
                }
            }
        }
        BottomNav(state.selectedTab, actions.selectTab)
    }
}

@Composable
private fun Header(title: String, state: PhoneAgentUiState, onRefresh: () -> Unit, showRefresh: Boolean = true) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            title,
            color = Color.White,
            fontSize = 26.sp,
            lineHeight = 30.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )
        StatusPill(state.status)
        Spacer(Modifier.width(8.dp))
        Surface(Modifier.size(40.dp), shape = CircleShape, color = Color.White.copy(alpha = 0.94f)) {
            Box(contentAlignment = Alignment.Center) {
                Text(state.user.initials.ifBlank { "PA" }, color = Ink, fontWeight = FontWeight.Bold)
            }
        }
        if (showRefresh) {
            IconButton(onClick = onRefresh) {
                Icon(Icons.Filled.Refresh, contentDescription = "Refresh", tint = Color.White.copy(alpha = 0.8f))
            }
        }
    }
}

@Composable
private fun StatusPill(status: String) {
    val color = when (status) {
        "Active" -> Success
        "Live" -> Warning
        "Syncing" -> Info
        "Setup" -> Warning
        else -> Color(0xFF7A7392)
    }
    Surface(shape = CircleShape, color = color) {
        Text(status, modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp), color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun BottomNav(selected: Tab, onSelect: (Tab) -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        color = Color.White.copy(alpha = 0.94f),
        shape = RoundedCornerShape(20.dp),
        shadowElevation = 6.dp
    ) {
        Row(Modifier.height(66.dp).padding(6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Tab.entries.forEach { tab ->
                val active = tab == selected
                Surface(
                    modifier = Modifier.weight(1f).fillMaxHeight().clip(RoundedCornerShape(16.dp)).clickable { onSelect(tab) },
                    color = if (active) TwilightBottom else Color.Transparent,
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                        Icon(tab.icon, contentDescription = tab.label, tint = if (active) Color.White else Muted)
                        Text(tab.label, color = if (active) Color.White else Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun AuthScreen(state: PhoneAgentUiState, actions: AppActions) {
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    OnboardingFrame(title = "Your phone should only ring when it should.", state = state) {
        OutlinedTextField(name, { name = it }, label = { Text("Your name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(phone, { phone = it }, label = { Text("Mobile number") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(12.dp))
        PrimaryButton(if (state.loading) "Sending code" else "Send code", Icons.AutoMirrored.Filled.Send, enabled = !state.loading) { actions.startSignup(name, phone) }
    }
}

@Composable
private fun CodeScreen(state: PhoneAgentUiState, verificationId: String, actions: AppActions) {
    var code by remember { mutableStateOf("") }
    OnboardingFrame(title = "Enter your verification code.", state = state) {
        OutlinedTextField(code, { code = it }, label = { Text("Verification code") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(12.dp))
        PrimaryButton(if (state.loading) "Verifying" else "Verify", Icons.AutoMirrored.Filled.Send, enabled = !state.loading) { actions.verifyCode(verificationId, code) }
    }
}

@Composable
private fun AssistantNameScreen(state: PhoneAgentUiState, actions: AppActions) {
    var name by remember { mutableStateOf(state.user.assistantName.ifBlank { "Assistant" }) }
    OnboardingFrame(title = "Name your assistant.", state = state) {
        Text("Callers will hear this name. You can change it later.", color = Muted, fontSize = 15.sp, lineHeight = 20.sp)
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(name, { name = it }, label = { Text("Assistant name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(12.dp))
        PrimaryButton(if (state.loading) "Saving" else "Continue", Icons.AutoMirrored.Filled.Send, enabled = !state.loading) { actions.saveAssistantName(name) }
    }
}

@Composable
private fun OnboardingFrame(title: String, state: PhoneAgentUiState, content: @Composable ColumnScope.() -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().statusBarsPadding(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item { Header("Welcome", state, {}, showRefresh = false) }
        item {
            Text(title, color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold, lineHeight = 29.sp)
            Text("Set up a calm communication layer that answers first, remembers context, and brings you in when it matters.", color = Color.White.copy(alpha = 0.84f), fontSize = 15.sp, lineHeight = 21.sp)
        }
        state.error?.let { item { ErrorCard(it) } }
        item { WorkCard { content() } }
    }
}

@Composable
private fun HomeScreen(state: PhoneAgentUiState, actions: AppActions) {
    ScreenList {
        item { SectionLabel("Tracked topics") }
        item {
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (state.topics.isEmpty()) {
                    TopicImageCard(null, actions)
                } else {
                    state.topics.take(8).forEach { TopicImageCard(it, actions) }
                }
            }
        }
        item { SectionLabel("Recent calls") }
        if (state.calls.isEmpty()) {
            item { QuietCard("No calls yet", "Calls handled by your assistant will appear here.") }
        } else {
            state.calls.take(6).forEach { call ->
                item { CallRow(call, actions) }
            }
        }
        item { SectionLabel("Needs attention") }
        if (state.suggestions.isEmpty() && state.notifications.isEmpty()) {
            item { QuietCard("Nothing waiting", "Your assistant will place decisions, questions, and topic suggestions here.") }
        } else {
            state.suggestions.take(3).forEach { item { SuggestionCard(it, actions) } }
            state.notifications.take(3).forEach { item { QuietCard(it.title, it.body) } }
        }
    }
}

@Composable
private fun TopicsScreen(state: PhoneAgentUiState, actions: AppActions) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    ScreenList {
        item {
            Text("Real-world situations with memory, decisions, questions, tasks, and communications.", color = Color.White.copy(alpha = 0.86f), fontSize = 15.sp, lineHeight = 20.sp)
        }
        item { SectionLabel("Active topics") }
        if (state.topics.isEmpty()) {
            item { TopicImageCard(null, actions) }
        } else {
            state.topics.forEach { item { TopicWideCard(it, actions) } }
        }
        item { SectionLabel("Create") }
        item {
            WorkCard {
                Text("Create topic", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Ink)
                Text("Start a topic for a project, family situation, appointment, trip, vendor, or decision.", color = Muted, fontSize = 14.sp, lineHeight = 19.sp)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(title, { title = it }, label = { Text("Topic title") }, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(description, { description = it }, label = { Text("Description, optional") }, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(10.dp))
                PrimaryButton("Create topic", Icons.Filled.Add) { actions.createTopic(title, description) }
            }
        }
    }
}

@Composable
private fun ReviewScreen(state: PhoneAgentUiState, actions: AppActions) {
    ScreenList {
        item { SectionLabel("Topic review") }
        if (state.suggestions.isEmpty()) {
            item { QuietCard("No review items", "Topic suggestions and uncertain assistant decisions will appear here.") }
        } else {
            state.suggestions.forEach { item { SuggestionCard(it, actions) } }
        }
        item { SectionLabel("Calls to organize") }
        state.calls.take(8).forEach { item { CallRow(it, actions) } }
    }
}

@Composable
private fun AssistantScreen(state: PhoneAgentUiState, actions: AppActions) {
    val assistantNumber = state.user.assistantNumber.ifBlank { BuildConfig.PHONE_AGENT_NUMBER }
    ScreenList {
        item {
            WorkCard {
                Text(if (state.activeCall == null) "Assistant is active" else "Assistant is on a call", fontSize = 19.sp, lineHeight = 23.sp, fontWeight = FontWeight.Bold, color = Ink)
                Text(state.activeCall?.displayCaller ?: "Ready to answer, summarize, ask for help, and protect your attention.", color = Muted, fontSize = 14.sp, lineHeight = 19.sp)
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    MetricTile("Needs you", (state.notifications.size + state.suggestions.size).toString(), Modifier.weight(1f))
                    MetricTile("Topics", state.topics.size.toString(), Modifier.weight(1f))
                    MetricTile("Calls", state.calls.size.toString(), Modifier.weight(1f))
                }
            }
        }
        item { SectionLabel("Quick actions") }
        item {
            WorkCard {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ActionTile("Forward", "Setup", Icons.Filled.SettingsPhone, Modifier.weight(1f), actions.openForwarding)
                    ActionTile("Billing", state.billing.display, Icons.Filled.CreditCard, Modifier.weight(1f), actions.openBilling)
                }
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ActionTile("Test call", state.user.assistantNumberDisplay, Icons.Filled.Call, Modifier.weight(1f)) { actions.callNumber(assistantNumber) }
                    ActionTile("Add note", "Next call", Icons.AutoMirrored.Filled.NoteAdd, Modifier.weight(1f)) { actions.openAddNote("") }
                }
            }
        }
        item { SectionLabel("Channels") }
        item {
            WorkCard {
                Text("Phone active", color = Ink, fontWeight = FontWeight.Bold)
                Text("Calendar, contacts, email, and documents will connect here as productized channels.", color = Muted, fontSize = 14.sp, lineHeight = 19.sp)
            }
        }
    }
}

@Composable
private fun SearchScreen(state: PhoneAgentUiState, actions: AppActions) {
    var query by remember { mutableStateOf("") }
    val topics = state.topics.filter { query.isBlank() || it.title.contains(query, true) || it.description.contains(query, true) }
    val calls = state.calls.filter { query.isBlank() || it.displayCaller.contains(query, true) || it.phone.contains(query, true) }
    ScreenList {
        item {
            CalmTextField(
                value = query,
                onValueChange = { query = it },
                label = "Search people, topics, decisions...",
                modifier = Modifier.fillMaxWidth()
            )
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("All", "Topics", "People", "Calls").forEach {
                    CalmFilterChip(label = it, selected = it == "All", onClick = {})
                }
            }
        }
        item { SectionLabel("Best matches") }
        if (topics.isEmpty() && calls.isEmpty()) {
            item { QuietCard("No results yet", "Search becomes more useful as your assistant builds topic memory.") }
        } else {
            topics.take(4).forEach { item { TopicSearchRow(it, actions) } }
            calls.take(4).forEach { item { CallRow(it, actions) } }
        }
    }
}

@Composable
private fun ForwardingScreen(state: PhoneAgentUiState, actions: AppActions) {
    val context = LocalContext.current
    val assistantNumber = state.user.assistantNumber.ifBlank { BuildConfig.PHONE_AGENT_NUMBER }
    val assistantNumberDisplay = state.user.assistantNumberDisplay
    val missedCallCode = "*71${assistantNumber.toForwardingDigits()}"
    val fullForwardCode = "*72${assistantNumber.toForwardingDigits()}"
    DetailFrame(title = "Forward calls", state = state, actions = actions) {
        item {
            Surface(color = Color.White.copy(alpha = 0.12f), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f))) {
                Column(Modifier.padding(12.dp)) {
                    Text("Recommended", color = SuccessLight, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Text("Missed-call forwarding", color = Color.White, fontSize = 21.sp, lineHeight = 25.sp, fontWeight = FontWeight.Bold)
                    Text("Unanswered calls go to ${state.user.assistantName.ifBlank { "your assistant" }}.", color = Color.White.copy(alpha = 0.82f), fontSize = 14.sp, lineHeight = 19.sp)
                    Spacer(Modifier.height(8.dp))
                    Text(missedCallCode, color = Color(0xFFD8D1FF), fontSize = 23.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(6.dp))
                    Text("Assistant number     $assistantNumberDisplay", color = Color.White.copy(alpha = 0.86f), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        PrimaryButton("Dial code", Icons.Filled.Call, Modifier.weight(1f), onClick = actions.dial)
                        SecondaryButton("Copy number", Modifier.weight(1f)) {
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                            clipboard.setPrimaryClip(android.content.ClipData.newPlainText("Assistant number", assistantNumber))
                        }
                    }
                }
            }
        }
        item {
            GlassRows(
                listOf(
                    "Full forwarding" to fullForwardCode,
                    "Turn forwarding off" to "*73"
                )
            )
        }
    }
}

@Composable
private fun BillingScreen(state: PhoneAgentUiState, actions: AppActions) {
    DetailFrame(title = "Billing", state = state, actions = actions) {
        item {
            WorkCard {
                Text("Choose your spending limit", color = Ink, fontSize = 19.sp, lineHeight = 23.sp, fontWeight = FontWeight.Bold)
                Text("Phone Agent Personal is $19/month and includes your assistant number and 50 assistant minutes. You can change or pause this anytime.", color = Muted, fontSize = 14.sp, lineHeight = 19.sp)
                Spacer(Modifier.height(8.dp))
                Text("Current status: ${state.billing.display}", color = Ink, fontWeight = FontWeight.Bold)
                Text("Monthly cap: ${state.billing.capDisplay}", color = Muted, fontSize = 14.sp)
            }
        }
        item {
            WorkCard {
                PrimaryButton("Add card", Icons.Filled.CreditCard, onClick = actions.openCheckout)
                Spacer(Modifier.height(6.dp))
                SecondaryButton("Check billing status", Modifier.fillMaxWidth(), actions.activateBilling)
            }
        }
    }
}

@Composable
private fun TopicDetailScreen(state: PhoneAgentUiState, topicId: String, actions: AppActions) {
    val topic = state.topics.firstOrNull { it.id == topicId }
    DetailFrame(title = "Topic", state = state, actions = actions) {
        if (topic == null) {
            item { QuietCard("Topic not found", "Refresh and try again.") }
        } else {
            item { TopicHero(topic) }
            item { QuietCard("Current brief", topic.description.ifBlank { "No structured state yet. The assistant will build a brief as related communications are attached." }) }
            item { SectionLabel("Needs attention") }
            item { QuietCard("No open items", "Decisions, questions, tasks, and conflicts will appear here when extracted or created.") }
            item { SectionLabel("Timeline") }
            if (topic.timeline.isEmpty()) {
                item { QuietCard("No communications yet", "Calls, notes, calendar events, and documents will appear here when attached.") }
            } else {
                topic.timeline.forEach { item { QuietCard(it.title, it.body) } }
            }
        }
    }
}

@Composable
private fun CallDetailScreen(state: PhoneAgentUiState, providerCallId: String, actions: AppActions) {
    val call = state.calls.firstOrNull { it.providerCallId == providerCallId }
    DetailFrame(title = "Call", state = state, actions = actions) {
        if (call == null) {
            item { QuietCard("Call not found", "Refresh and try again.") }
        } else {
            item {
                WorkCard {
                    Text(call.displayCaller, color = Ink, fontSize = 20.sp, fontWeight = FontWeight.Bold, lineHeight = 24.sp)
                    Text(call.phone.ifBlank { "Unknown number" }, color = Muted, fontSize = 14.sp)
                    Text(call.displayTime.ifBlank { call.status }, color = Muted, fontSize = 13.sp)
                    Spacer(Modifier.height(8.dp))
                    Text(call.displaySummary, color = Ink, fontSize = 15.sp, lineHeight = 20.sp)
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        PrimaryButton("Call back", Icons.Filled.Call, Modifier.weight(1f)) { actions.callNumber(call.callbackNumber.ifBlank { call.phone }) }
                        SecondaryButton("Add note", Modifier.weight(1f)) { actions.openAddNote(call.callbackNumber.ifBlank { call.phone }) }
                    }
                }
            }
            item { SectionLabel("Outcome") }
            item {
                WorkCard {
                    DetailLine("Intent", call.intent.ifBlank { "Not captured yet" })
                    DetailLine("Urgency", call.urgencyLabel)
                    DetailLine("Follow-up", call.followUp.ifBlank { "No follow-up captured" })
                }
            }
            item { SectionLabel("Transcript") }
            item {
                WorkCard {
                    if (call.transcript.isBlank()) {
                        Text("No transcript is available yet.", color = Muted, lineHeight = 19.sp)
                    } else {
                        call.transcript.lineSequence()
                            .map { it.trim() }
                            .filter { it.isNotEmpty() }
                            .take(24)
                            .forEachIndexed { index, line ->
                                if (index > 0) Spacer(Modifier.height(6.dp))
                                Text(line, color = Muted, fontSize = 14.sp, lineHeight = 19.sp)
                            }
                    }
                }
            }
        }
    }
}

@Composable
private fun AddNoteScreen(state: PhoneAgentUiState, targetPhoneNumber: String, actions: AppActions) {
    var phone by remember(targetPhoneNumber) { mutableStateOf(targetPhoneNumber) }
    var note by remember { mutableStateOf("") }
    DetailFrame(title = "Add note", state = state, actions = actions) {
        item {
            WorkCard {
                Text("Give ${state.user.assistantName.ifBlank { "your assistant" }} context", color = Ink, fontSize = 20.sp, fontWeight = FontWeight.Bold, lineHeight = 24.sp)
                Text("Use this for something the assistant should know or say on an upcoming call. Notes are temporary context, not permanent memory.", color = Muted, fontSize = 14.sp, lineHeight = 19.sp)
                Spacer(Modifier.height(10.dp))
                CalmTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = "Caller phone, optional",
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    label = { Text("What should the assistant know or say?") },
                    minLines = 3,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Ink,
                        unfocusedTextColor = Ink,
                        focusedContainerColor = Card,
                        unfocusedContainerColor = Card,
                        focusedBorderColor = Line,
                        unfocusedBorderColor = Line,
                        focusedLabelColor = Muted,
                        unfocusedLabelColor = Muted,
                        cursorColor = Brand
                    )
                )
                Spacer(Modifier.height(10.dp))
                PrimaryButton(if (state.loading) "Saving" else "Save note", Icons.Filled.Add, enabled = !state.loading) {
                    actions.saveAgentNote(note, phone)
                }
            }
        }
        item {
            QuietCard(
                "How notes work",
                "If the caller matches the phone number, the assistant can use this note as call context. Leave the phone blank for general context."
            )
        }
    }
}

@Composable
private fun DetailFrame(title: String, state: PhoneAgentUiState, actions: AppActions, content: androidx.compose.foundation.lazy.LazyListScope.() -> Unit) {
    Column(
        Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = actions.back) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White) }
            Text(title, color = Color.White, fontSize = 27.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            StatusPill(state.status)
        }
        LazyColumn(
            Modifier.weight(1f),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            content = content
        )
    }
}

@Composable
private fun ScreenList(content: androidx.compose.foundation.lazy.LazyListScope.() -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 112.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        content = content
    )
}

@Composable
private fun TopicImageCard(topic: TopicThread?, actions: AppActions) {
    val title = topic?.title ?: "Topics will appear here"
    val body = topic?.description?.ifBlank { topic.compactMeta } ?: "The assistant groups related conversations into calm topic cards."
    Box(
        Modifier
            .width(224.dp)
            .height(142.dp)
            .clip(RoundedCornerShape(16.dp))
            .clickable { if (topic == null) actions.selectTab(Tab.Topics) else actions.openTopic(topic.id) }
    ) {
        Image(painterResource(topicImage(topic)), contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.7f)))))
        Column(Modifier.align(Alignment.BottomStart).padding(12.dp)) {
            Text(title, color = Color.White, fontSize = 16.sp, lineHeight = 19.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(body, color = Color.White.copy(alpha = 0.88f), fontSize = 12.sp, lineHeight = 15.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun TopicWideCard(topic: TopicThread, actions: AppActions) {
    Box(
        Modifier
            .fillMaxWidth()
            .height(154.dp)
            .clip(RoundedCornerShape(18.dp))
            .clickable { actions.openTopic(topic.id) }
    ) {
        Image(painterResource(topicImage(topic)), contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.76f)))))
        Column(Modifier.align(Alignment.BottomStart).padding(12.dp)) {
            Text(topic.title, color = Color.White, fontSize = 18.sp, lineHeight = 22.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(topic.compactMeta, color = Color.White.copy(alpha = 0.86f), fontSize = 11.sp, fontWeight = FontWeight.Bold)
            Text(topic.description.ifBlank { "No brief yet." }, color = Color.White.copy(alpha = 0.9f), fontSize = 13.sp, lineHeight = 16.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun TopicHero(topic: TopicThread) {
    Box(Modifier.fillMaxWidth().height(158.dp).clip(RoundedCornerShape(18.dp))) {
        Image(painterResource(topicImage(topic)), contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.78f)))))
        Column(Modifier.align(Alignment.BottomStart).padding(12.dp)) {
            Text(topic.title, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold, lineHeight = 24.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(topic.compactMeta, color = Color.White.copy(alpha = 0.88f), fontWeight = FontWeight.Bold, fontSize = 11.sp)
        }
    }
}

@Composable
private fun CallRow(call: CallRecord, actions: AppActions) {
    WorkCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { actions.openCall(call.providerCallId) }
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(call.displayCaller, color = Ink, fontSize = 17.sp, lineHeight = 21.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(call.phone.ifBlank { "Unknown number" }, color = Muted, fontSize = 13.sp, lineHeight = 17.sp)
                Text(call.displayTime.ifBlank { call.status }, color = Muted, fontSize = 12.sp, lineHeight = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            IconButton(onClick = { actions.callNumber(call.callbackNumber.ifBlank { call.phone }) }) { Icon(Icons.Filled.Call, contentDescription = "Call back", tint = Brand) }
            IconButton(onClick = { actions.openCall(call.providerCallId) }) { Icon(Icons.Filled.Info, contentDescription = "Call details", tint = Brand) }
            IconButton(onClick = { actions.openAddNote(call.callbackNumber.ifBlank { call.phone }) }) { Icon(Icons.Filled.Add, contentDescription = "Add note", tint = Brand) }
        }
    }
}

@Composable
private fun SuggestionCard(suggestion: TopicSuggestion, actions: AppActions) {
    WorkCard {
        Text("Review topic suggestion / ${(suggestion.confidence * 100).toInt()}%", color = Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Text(suggestion.title, color = Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold, lineHeight = 21.sp)
        Text(suggestion.reason, color = Muted, fontSize = 14.sp, lineHeight = 19.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            PrimaryButton("Accept", Icons.AutoMirrored.Filled.Send, Modifier.weight(1f)) { actions.acceptSuggestion(suggestion.id) }
            SecondaryButton("Dismiss", Modifier.weight(1f)) { actions.dismissSuggestion(suggestion.id) }
        }
    }
}

@Composable
private fun TopicSearchRow(topic: TopicThread, actions: AppActions) {
    WorkCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { actions.openTopic(topic.id) }
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(topic.title, color = Ink, fontWeight = FontWeight.Bold, fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(topic.compactMeta, color = Muted, fontSize = 12.sp)
            }
            IconButton(onClick = { actions.openTopic(topic.id) }) { Icon(Icons.Filled.Info, contentDescription = "Open topic", tint = Brand) }
        }
    }
}

@Composable
private fun WorkCard(modifier: Modifier = Modifier.fillMaxWidth(), content: @Composable ColumnScope.() -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Card),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, Line),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = modifier
    ) {
        Column(Modifier.padding(12.dp), content = content)
    }
}

@Composable
private fun QuietCard(title: String, body: String) {
    WorkCard {
        Text(title, color = Ink, fontWeight = FontWeight.Bold, fontSize = 17.sp, lineHeight = 21.sp)
        Text(body, color = Muted, fontSize = 14.sp, lineHeight = 19.sp)
    }
}

@Composable
private fun ErrorCard(message: String) {
    WorkCard {
        Text("Setup issue", color = Ink, fontWeight = FontWeight.Bold)
        Text(message, color = Critical, lineHeight = 20.sp)
    }
}

@Composable
private fun DetailLine(label: String, value: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(label.uppercase(), color = Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Text(value, color = Ink, fontSize = 15.sp, lineHeight = 20.sp)
    }
}

@Composable
private fun SectionLabel(value: String) {
    Text(value.uppercase(), color = Color.White.copy(alpha = 0.84f), fontSize = 12.sp, fontWeight = FontWeight.Bold)
}

@Composable
private fun PrimaryButton(text: String, icon: ImageVector, modifier: Modifier = Modifier.fillMaxWidth(), enabled: Boolean = true, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.height(46.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Brand, disabledContainerColor = Brand.copy(alpha = 0.48f))
    ) {
        Icon(icon, contentDescription = null)
        Spacer(Modifier.width(6.dp))
        Text(text, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun SecondaryButton(text: String, modifier: Modifier = Modifier.fillMaxWidth(), onClick: () -> Unit) {
    OutlinedButton(onClick = onClick, modifier = modifier.height(46.dp), shape = RoundedCornerShape(12.dp)) {
        Text(text, color = Ink, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun MetricTile(label: String, value: String, modifier: Modifier = Modifier) {
    Surface(modifier = modifier.height(58.dp), color = Soft, shape = RoundedCornerShape(12.dp), border = BorderStroke(1.dp, Line)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Text(value, color = Ink, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Text(label, color = Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun ActionRow(title: String, subtitle: String, icon: ImageVector, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable(onClick = onClick).padding(vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(Modifier.size(36.dp), shape = CircleShape, color = Soft) {
            Box(contentAlignment = Alignment.Center) { Icon(icon, contentDescription = null, tint = Brand) }
        }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = Ink, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            Text(subtitle, color = Muted, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun ActionTile(title: String, subtitle: String, icon: ImageVector, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Surface(
        modifier = modifier
            .height(78.dp)
            .clip(RoundedCornerShape(14.dp))
            .clickable(onClick = onClick),
        color = Soft,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, Line)
    ) {
        Row(Modifier.padding(horizontal = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = Brand, modifier = Modifier.size(24.dp))
            Spacer(Modifier.width(8.dp))
            Column(Modifier.weight(1f)) {
                Text(title, color = Ink, fontSize = 15.sp, lineHeight = 18.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(subtitle, color = Muted, fontSize = 12.sp, lineHeight = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
private fun CalmTextField(value: String, onValueChange: (String) -> Unit, label: String, modifier: Modifier = Modifier) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = true,
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = Ink,
            unfocusedTextColor = Ink,
            focusedContainerColor = Card,
            unfocusedContainerColor = Card,
            focusedBorderColor = Line,
            unfocusedBorderColor = Line,
            focusedLabelColor = Muted,
            unfocusedLabelColor = Muted,
            cursorColor = Brand
        )
    )
}

@Composable
private fun CalmFilterChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .height(34.dp)
            .clip(CircleShape)
            .clickable(onClick = onClick),
        shape = CircleShape,
        color = if (selected) Card else Color.White.copy(alpha = 0.14f),
        border = BorderStroke(1.dp, Color.White.copy(alpha = if (selected) 0.0f else 0.30f))
    ) {
        Box(Modifier.padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
            Text(label, color = if (selected) Ink else Color.White.copy(alpha = 0.86f), fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun GlassRows(rows: List<Pair<String, String>>) {
    Surface(color = Color.White.copy(alpha = 0.10f), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, Color.White.copy(alpha = 0.14f))) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            rows.forEach { (title, code) ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text(code, color = Color.White.copy(alpha = 0.82f), fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

private fun topicImage(topic: TopicThread?): Int {
    val text = ((topic?.title ?: "") + " " + (topic?.description ?: "")).lowercase()
    return when {
        text.contains("dog") || text.contains("pet") || text.contains("cat") || text.contains("vet") -> R.drawable.topic_pets_generated
        text.contains("family") || text.contains("wife") || text.contains("kid") || text.contains("parent") -> R.drawable.topic_family_generated
        text.contains("work") || text.contains("client") || text.contains("recruit") || text.contains("job") -> R.drawable.topic_work_generated
        text.contains("travel") || text.contains("trip") || text.contains("flight") || text.contains("hotel") -> R.drawable.topic_travel_generated
        text.contains("medical") || text.contains("doctor") || text.contains("health") -> R.drawable.topic_medical_generated
        text.contains("tax") || text.contains("budget") || text.contains("finance") || text.contains("invoice") -> R.drawable.topic_finance_generated
        text.contains("car") || text.contains("lease") || text.contains("vehicle") -> R.drawable.topic_car_generated
        text.contains("school") || text.contains("sport") || text.contains("coach") -> R.drawable.topic_school_generated
        text.contains("home") || text.contains("basement") || text.contains("contractor") || text.contains("repair") -> R.drawable.topic_home_projects_generated
        else -> R.drawable.topic_general_generated
    }
}

private data class LoadedData(
    val me: UserSummary,
    val billing: BillingAccount,
    val onboarding: OnboardingStatus,
    val topics: List<TopicThread>,
    val calls: List<CallRecord>,
    val suggestions: List<TopicSuggestion>,
    val notifications: List<AppNotification>,
    val activeCall: ActiveCall?
)

private data class UserSummary(val json: JSONObject) {
    val id: String = json.optString("id")
    val displayName: String = json.optString("displayName")
    val assistantName: String = json.optString("assistantName", "Assistant")
    private val phoneRouting: JSONObject? = json.optJSONObject("phoneRouting")
    val assistantNumber: String = phoneRouting?.optString("retellPhoneNumber").orEmpty()
    val assistantNumberDisplay: String = assistantNumber.ifBlank { BuildConfig.PHONE_AGENT_NUMBER_DISPLAY }
    val initials: String = displayName.split(" ").mapNotNull { it.firstOrNull()?.uppercase() }.take(2).joinToString("").ifBlank { "PA" }

    companion object {
        val empty = UserSummary(JSONObject())
    }
}

private data class BillingAccount(val json: JSONObject) {
    val status: String = json.optString("status", "payment_required")
    val capCents: Int = json.optInt("monthlySpendingCapCents", 4000)
    val display: String = when (status) {
        "active" -> "Billing ready"
        "payment_method_added" -> "Card added"
        "cap_reached" -> "Cap reached"
        else -> "Payment needed"
    }
    val capDisplay: String = "${'$'}${capCents / 100}/mo"

    companion object {
        val empty = BillingAccount(JSONObject())
    }
}

private data class OnboardingStatus(val json: JSONObject) {
    val ready: Boolean = json.optBoolean("readyForBetaUse", false)

    companion object {
        val empty = OnboardingStatus(JSONObject())
    }
}

private data class TopicThread(val json: JSONObject) {
    val id: String = json.optString("id")
    val title: String = json.optString("title", "Untitled topic")
    val description: String = json.optString("description")
    val communicationCount: Int = json.optInt("communicationCount", json.optJSONArray("communicationItemIds")?.length() ?: 0)
    val decisionCount: Int = json.optJSONArray("decisions")?.length() ?: 0
    val questionCount: Int = json.optJSONArray("openQuestions")?.length() ?: 0
    val taskCount: Int = json.optJSONArray("tasks")?.length() ?: 0
    val compactMeta: String = "Active / $communicationCount comm / $decisionCount decisions"
    val timeline: List<TimelineItem> = json.optJSONArray("timeline").toList(::TimelineItem)
}

private data class TimelineItem(val json: JSONObject) {
    val title: String = json.optString("title", json.optString("channel", "Communication"))
    val body: String = json.optString("summary", json.optString("body", "No summary available."))
}

private data class CallRecord(val json: JSONObject) {
    val providerCallId: String = json.optString("providerCallId", json.optString("id"))
    val displayCaller: String = json.optString("displayName", json.optString("callerName", json.optString("fromNumber", "Unknown caller")))
    val phone: String = json.optString("fromNumber", json.optString("callerPhoneNumber"))
    val callbackNumber: String = json.optString("callbackNumber", phone)
    val occurredAt: String = json.optString("startedAt", json.optString("createdAt"))
    val displayTime: String = formatCallTime(occurredAt)
    val status: String = json.optString("status", "Handled")
    private val summaryObject: JSONObject? = json.optJSONObject("summary")
    private val structured: JSONObject? = summaryObject?.optJSONObject("structuredData")
    private val custom: JSONObject? = structured?.optJSONObject("custom_analysis_data")
    val summaryText: String = summaryObject?.optString("text").orEmpty().ifBlank { custom?.optString("call_summary").orEmpty() }
    val transcript: String = json.optString("transcript")
    val intent: String = custom?.optString("caller_intent").orEmpty()
    val urgency: String = custom?.optString("urgency", json.optString("urgency", "unknown")).orEmpty().ifBlank { "unknown" }
    val followUp: String = custom?.optString("requested_follow_up").orEmpty()
    val displaySummary: String = summaryText.ifBlank { intent.ifBlank { "No summary is available yet." } }
    val urgencyLabel: String = urgency.replace('_', ' ').lowercase()
}

private fun formatCallTime(value: String): String {
    if (value.isBlank()) return ""
    return runCatching {
        val instant = Instant.parse(value)
        DateTimeFormatter.ofPattern("MMM d, h:mm a").withZone(ZoneId.systemDefault()).format(instant)
    }.getOrElse {
        value.replace("T", " ").replace("Z", "").take(18)
    }
}

private fun String.toForwardingDigits(): String {
    val digits = filter(Char::isDigit)
    return if (digits.length == 11 && digits.startsWith("1")) digits.drop(1) else digits
}

private data class TopicSuggestion(val json: JSONObject) {
    val id: String = json.optString("id")
    val title: String = json.optString("suggestedTopicTitle", json.optString("title", "Suggested topic"))
    val reason: String = json.optString("reason", "The assistant thinks this belongs with related communication.")
    val confidence: Double = json.optDouble("confidence", 0.0)
}

private data class AppNotification(val json: JSONObject) {
    val id: String = json.optString("id", json.optString("notificationId"))
    val title: String = json.optString("title", "Assistant update")
    val body: String = json.optString("body", "Open Phone Agent to review.")
}

private data class ActiveCall(val json: JSONObject) {
    val displayCaller: String = json.optString("callerName", json.optString("fromNumber", "Caller"))
}

private fun cachedJson(value: String): JSONObject = runCatching { JSONObject(value) }.getOrElse { JSONObject() }

private fun stableCacheId(prefix: String, preferred: String, json: JSONObject): String {
    return preferred.ifBlank { "${prefix}_${json.toString().hashCode()}" }
}

private fun <T> JSONArray?.toList(mapper: (JSONObject) -> T): List<T> {
    if (this == null) return emptyList()
    val result = ArrayList<T>()
    for (index in 0 until length()) {
        optJSONObject(index)?.let { result.add(mapper(it)) }
    }
    return result
}

private fun previewActions() = AppActions(
    selectTab = {},
    refresh = {},
    startSignup = { _, _ -> },
    verifyCode = { _, _ -> },
    saveAssistantName = {},
    openTopic = {},
    openCall = {},
    openAddNote = {},
    saveAgentNote = { _, _ -> },
    back = {},
    openForwarding = {},
    openBilling = {},
    openCheckout = {},
    activateBilling = {},
    signOut = {},
    dial = {},
    createTopic = { _, _ -> },
    acceptSuggestion = {},
    dismissSuggestion = {},
    callNumber = {}
)

private fun previewState(selectedTab: Tab = Tab.Home, screen: Screen = Screen.Main) = PhoneAgentUiState(
    screen = screen,
    selectedTab = selectedTab,
    status = "Active",
    user = UserSummary(JSONObject("""{"displayName":"Daryl Flagg","assistantName":"Addison","phoneRouting":{"retellPhoneNumber":"+19143593659"}}""")),
    billing = BillingAccount(JSONObject("""{"status":"active","monthlySpendingCapCents":4000}""")),
    topics = listOf(
        TopicThread(JSONObject("""{"id":"topic_basement","title":"Basement Project","description":"Inspection, estimate, budget, and contractor decisions for the basement renovation.","communicationCount":4,"decisions":[{"title":"Framing approved"}],"timeline":[{"title":"Contractor call","summary":"Greg asked whether the estimate includes permit fees and said the plumbing change is needed by Friday."}]}""")),
        TopicThread(JSONObject("""{"id":"topic_family","title":"Family Schedule","description":"School logistics, practice pickups, dinner plans, and shared calendar changes.","communicationCount":3}"""))
    ),
    calls = listOf(
        CallRecord(JSONObject("""{"providerCallId":"call_1","fromNumber":"+17032988965","startedAt":"2026-06-01T22:07:00Z","summary":{"text":"Theresa asked when you are leaving work and whether you can pick up dinner.","structuredData":{"custom_analysis_data":{"caller_name":"Theresa","caller_intent":"Coordinate dinner and commute timing","urgency":"low","requested_follow_up":"Send ETA before leaving work"}}},"transcript":"Agent: Hi, this is Addison. Who am I speaking with?\nCaller: It is Theresa. Can you ask Daryl when he is leaving work?\nAgent: I can do that and send him the message."}""")),
        CallRecord(JSONObject("""{"providerCallId":"call_2","fromNumber":"+15551230000","startedAt":"2026-06-01T21:42:00Z","summary":{"text":"Unknown caller asked for a callback about an insurance quote."}}"""))
    ),
    suggestions = listOf(
        TopicSuggestion(JSONObject("""{"id":"suggestion_1","suggestedTopicTitle":"Dinner Plans","reason":"Theresa's call appears related to recurring family logistics.","confidence":0.91}"""))
    ),
    notifications = listOf(AppNotification(JSONObject("""{"title":"Calendar changed","body":"Addison created one approved event."}""")))
)

@Preview(showBackground = true, widthDp = 393, heightDp = 873)
@Composable
private fun HomePreview() {
    PhoneAgentTheme { PhoneAgentApp(previewState(Tab.Home), previewActions()) }
}

@Preview(showBackground = true, widthDp = 393, heightDp = 873)
@Composable
private fun TopicsPreview() {
    PhoneAgentTheme { PhoneAgentApp(previewState(Tab.Topics), previewActions()) }
}

@Preview(showBackground = true, widthDp = 393, heightDp = 873)
@Composable
private fun ReviewPreview() {
    PhoneAgentTheme { PhoneAgentApp(previewState(Tab.Review), previewActions()) }
}

@Preview(showBackground = true, widthDp = 393, heightDp = 873)
@Composable
private fun AssistantPreview() {
    PhoneAgentTheme { PhoneAgentApp(previewState(Tab.Assistant), previewActions()) }
}

@Preview(showBackground = true, widthDp = 393, heightDp = 873)
@Composable
private fun SearchPreview() {
    PhoneAgentTheme { PhoneAgentApp(previewState(Tab.Search), previewActions()) }
}

@Preview(showBackground = true, widthDp = 393, heightDp = 873)
@Composable
private fun TopicDetailPreview() {
    PhoneAgentTheme { PhoneAgentApp(previewState(screen = Screen.TopicDetail("topic_basement")), previewActions()) }
}

@Preview(showBackground = true, widthDp = 393, heightDp = 873)
@Composable
private fun CallDetailPreview() {
    PhoneAgentTheme { PhoneAgentApp(previewState(screen = Screen.CallDetail("call_1")), previewActions()) }
}

@Preview(showBackground = true, widthDp = 393, heightDp = 873)
@Composable
private fun ForwardingPreview() {
    PhoneAgentTheme { PhoneAgentApp(previewState(screen = Screen.Forwarding), previewActions()) }
}

@Preview(showBackground = true, widthDp = 393, heightDp = 873)
@Composable
private fun AddNotePreview() {
    PhoneAgentTheme { PhoneAgentApp(previewState(screen = Screen.AddNote("+17032988965")), previewActions()) }
}
