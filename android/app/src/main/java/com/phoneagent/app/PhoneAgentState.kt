package com.phoneagent.app

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.ui.graphics.vector.ImageVector
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

internal data class PhoneAgentUiState(
    val screen: Screen = Screen.CreateAccount,
    val selectedTab: Tab = Tab.Home,
    val status: String = "Setup",
    val dataFreshness: DataFreshness = DataFreshness.fresh(),
    val loading: Boolean = false,
    val error: String? = null,
    val user: UserSummary = UserSummary.empty,
    val billing: BillingAccount = BillingAccount.empty,
    val onboarding: OnboardingStatus = OnboardingStatus.empty,
    val topics: List<TopicThread> = emptyList(),
    val calls: List<CallRecord> = emptyList(),
    val suggestions: List<TopicSuggestion> = emptyList(),
    val notifications: List<AppNotification> = emptyList(),
    val agentNotes: List<AgentNote> = emptyList(),
    val approvalRequests: List<ApprovalRequest> = emptyList(),
    val answerRequests: List<AnswerRequest> = emptyList(),
    val contactSync: ContactSyncStatus = ContactSyncStatus.empty,
    val contactSyncing: Boolean = false,
    val contactPermissionDenied: Boolean = false,
    val activeCall: ActiveCall? = null
)

internal sealed interface Screen {
    data object Startup : Screen
    data object StartupIssue : Screen
    data object Login : Screen
    data object CreateAccount : Screen
    data object VerifyPhone : Screen
    data class CodeEntry(val verificationId: String) : Screen
    data object AssistantName : Screen
    data object Main : Screen
    data object Topics : Screen
    data object Review : Screen
    data object Search : Screen
    data object Forwarding : Screen
    data object Billing : Screen
    data object ProfileSettings : Screen
    data object PhoneContacts : Screen
    data class TopicDetail(val topicId: String) : Screen
    data class CallDetail(val providerCallId: String) : Screen
    data class AddNote(val targetPhoneNumber: String = "") : Screen
}

internal enum class AuthFlow {
    Login,
    CreateAccount
}

internal enum class Tab(val label: String, val icon: ImageVector) {
    Home("Home", Icons.Filled.Home),
    Assistant("Assistant", Icons.Filled.Headphones),
    Profile("Profile", Icons.Filled.Person)
}

internal data class AppActions(
    val selectTab: (Tab) -> Unit,
    val refresh: () -> Unit,
    val openLogin: () -> Unit,
    val openCreateAccount: () -> Unit,
    val startGoogleAuth: (AuthFlow) -> Unit,
    val startEmailPasswordAuth: (AuthFlow, String, String) -> Unit,
    val sendPasswordReset: (String) -> Unit,
    val startPhoneVerification: (String) -> Unit,
    val verifyPhoneCode: (String, String) -> Unit,
    val saveAssistantName: (String) -> Unit,
    val openTopics: () -> Unit,
    val openReview: () -> Unit,
    val openSearch: () -> Unit,
    val openTopic: (String) -> Unit,
    val openCall: (String) -> Unit,
    val openAddNote: (String) -> Unit,
    val openProfileSettings: () -> Unit,
    val openPhoneContacts: () -> Unit,
    val syncPhoneContacts: () -> Unit,
    val disconnectPhoneContacts: () -> Unit,
    val openSystemSettings: () -> Unit,
    val saveAgentNote: (String, String, String) -> Unit,
    val archiveAgentNote: (String) -> Unit,
    val acceptTransfer: (String) -> Unit,
    val declineTransfer: (String) -> Unit,
    val sendLiveAnswer: (String, String) -> Unit,
    val declineLiveAnswer: (String) -> Unit,
    val back: () -> Unit,
    val openForwarding: () -> Unit,
    val openBilling: () -> Unit,
    val openCheckout: () -> Unit,
    val activateBilling: () -> Unit,
    val cancelSubscription: () -> Unit,
    val removeAccount: () -> Unit,
    val signOut: () -> Unit,
    val dial: () -> Unit,
    val createTopic: (String, String) -> Unit,
    val acceptSuggestion: (String) -> Unit,
    val dismissSuggestion: (String) -> Unit,
    val callNumber: (String) -> Unit
)

internal data class AppSnapshot(
    val me: UserSummary,
    val billing: BillingAccount,
    val onboarding: OnboardingStatus,
    val topics: List<TopicThread>,
    val calls: List<CallRecord>,
    val suggestions: List<TopicSuggestion>,
    val notifications: List<AppNotification>,
    val agentNotes: List<AgentNote> = emptyList(),
    val approvalRequests: List<ApprovalRequest> = emptyList(),
    val answerRequests: List<AnswerRequest> = emptyList(),
    val contactSync: ContactSyncStatus,
    val activeCall: ActiveCall?,
    val dataFreshness: DataFreshness = DataFreshness.fresh()
)

internal enum class FreshnessState {
    Fresh,
    Cached,
    Stale,
    Offline
}

internal data class DataFreshness(
    val state: FreshnessState,
    val cachedAtEpochMs: Long? = null
) {
    val shouldShow: Boolean = state != FreshnessState.Fresh
    val displayLabel: String
        get() = when (state) {
            FreshnessState.Fresh -> "Up to date"
            FreshnessState.Cached -> "Saved ${ageLabel()}"
            FreshnessState.Stale -> "Stale ${ageLabel()}"
            FreshnessState.Offline -> "Offline / saved ${ageLabel()}"
        }

    fun offline(): DataFreshness =
        copy(state = FreshnessState.Offline)

    private fun ageLabel(): String {
        val cachedAt = cachedAtEpochMs ?: return "earlier"
        val ageMs = (System.currentTimeMillis() - cachedAt).coerceAtLeast(0)
        val minutes = ageMs / 60_000
        val hours = minutes / 60
        return when {
            minutes < 1 -> "just now"
            minutes < 60 -> "${minutes}m ago"
            hours < 24 -> "${hours}h ago"
            else -> "${hours / 24}d ago"
        }
    }

    companion object {
        fun fresh(cachedAtEpochMs: Long = System.currentTimeMillis()): DataFreshness =
            DataFreshness(FreshnessState.Fresh, cachedAtEpochMs)

        fun cached(cachedAtEpochMs: Long, hasLiveCall: Boolean, nowEpochMs: Long = System.currentTimeMillis()): DataFreshness {
            val staleAfterMs = if (hasLiveCall) 5 * 60_000L else 30 * 60_000L
            val state = if (nowEpochMs - cachedAtEpochMs > staleAfterMs) FreshnessState.Stale else FreshnessState.Cached
            return DataFreshness(state, cachedAtEpochMs)
        }
    }
}

internal data class UserSummary(val json: JSONObject) {
    val id: String = json.optString("id").ifBlank { json.optString("userId") }
    val displayName: String = json.optString("displayName")
    val assistantName: String = json.optString("assistantName", "Assistant")
    private val auth: JSONObject? = json.optJSONObject("auth")
    val email: String = auth?.optString("email").orEmpty()
    val phoneNumber: String = auth?.optString("phoneNumber").orEmpty()
    val phoneVerified: Boolean = auth?.optString("phoneVerificationStatus") == "verified" || auth?.optString("primaryPhoneVerifiedAt").orEmpty().isNotBlank()
    private val phoneRouting: JSONObject? = json.optJSONObject("phoneRouting")
    val assistantNumber: String = phoneRouting?.optString("assistantPhoneNumber").orEmpty()
    val assistantNumberProvisioningStatus: String = phoneRouting?.optString("assistantNumberProvisioningStatus", "unassigned") ?: "unassigned"
    val assistantNumberDisplay: String = when {
        assistantNumber.isNotBlank() -> assistantNumber
        assistantNumberProvisioningStatus == "provisioning" -> "Assigning number"
        assistantNumberProvisioningStatus == "failed" -> "Needs support"
        assistantNumberProvisioningStatus == "needs_operator_review" -> "Needs support"
        else -> "Not assigned"
    }
    val initials: String = displayName.split(" ").mapNotNull { it.firstOrNull()?.uppercase() }.take(2).joinToString("").ifBlank { "PA" }

    companion object {
        val empty = UserSummary(JSONObject())
    }
}

internal data class BillingAccount(val json: JSONObject) {
    val status: String = json.optString("status", "payment_required")
    val capCents: Int = json.optInt("monthlySpendingCapCents", 4000)
    val display: String = when (status) {
        "active" -> "Billing ready"
        "payment_method_added" -> "Card added"
        "cap_reached" -> "Cap reached"
        "canceled" -> "Canceled"
        else -> "Payment needed"
    }
    val capDisplay: String = "${'$'}${capCents / 100}/mo"

    companion object {
        val empty = BillingAccount(JSONObject())
    }
}

internal data class OnboardingStatus(val json: JSONObject) {
    val ready: Boolean = json.optBoolean("readyForBetaUse", false)
    private val activation: JSONObject? = json.optJSONObject("activation")
    val phoneVerified: Boolean = activation?.optBoolean("phoneVerified") ?: false
    val assistantProfileConfigured: Boolean = activation?.optBoolean("assistantProfileConfigured") ?: false

    companion object {
        val empty = OnboardingStatus(JSONObject())
    }
}

internal data class ContactSyncStatus(val json: JSONObject) {
    val syncedCount: Int = json.optInt("syncedCount", 0)
    val phoneNumberCount: Int = json.optInt("phoneNumberCount", 0)
    val lastSyncedAt: String = json.optString("lastSyncedAt")
    val summary: String = if (syncedCount > 0) "$syncedCount synced" else "Not synced"
    val detail: String = when {
        syncedCount <= 0 -> "No phone contacts synced yet"
        phoneNumberCount > 0 -> "$phoneNumberCount phone numbers"
        else -> "Names ready for caller recognition"
    }
    val lastSyncDisplay: String = formatCompactDateTime(lastSyncedAt).ifBlank { "Not synced yet" }

    companion object {
        val empty = ContactSyncStatus(JSONObject())
    }
}

internal data class TopicThread(val json: JSONObject) {
    val id: String = json.optString("id")
    val title: String = json.optString("title", "Untitled topic")
    val description: String = json.optString("description")
    val communicationCount: Int = json.optInt("communicationCount", json.optJSONArray("communicationItemIds")?.length() ?: 0)
    val decisionCount: Int = json.optJSONArray("decisions")?.length() ?: 0
    val questionCount: Int = json.optJSONArray("openQuestions")?.length() ?: 0
    val taskCount: Int = json.optJSONArray("tasks")?.length() ?: 0
    val timeline: List<TimelineItem> = json.optJSONArray("timeline").toList(::TimelineItem)
    val isTimelineHydrating: Boolean = communicationCount > 0 && timeline.isEmpty()
    val compactMeta: String = "Active / ${pluralize(communicationCount, "communication")} / ${pluralize(decisionCount, "decision")}"
    val unreadUpdateCount: Int = listOf(
        json.optInt("unreadUpdateCount", 0),
        json.optInt("newUpdateCount", 0),
        json.optInt("unreadCount", 0)
    ).maxOrNull() ?: 0
    val hasUnreadUpdates: Boolean = unreadUpdateCount > 0 ||
        json.optBoolean("hasUnreadUpdates", false) ||
        json.optBoolean("hasNewUpdates", false) ||
        json.optBoolean("isUnread", false)
    val unreadIndicatorLabel: String = when {
        unreadUpdateCount > 9 -> "9+ new"
        unreadUpdateCount > 1 -> "$unreadUpdateCount new"
        hasUnreadUpdates -> "New"
        else -> ""
    }
}

private fun pluralize(count: Int, singular: String): String =
    "$count $singular${if (count == 1) "" else "s"}"

internal data class TimelineItem(val json: JSONObject) {
    val title: String = json.optString("title", json.optString("channel", "Communication"))
    val body: String = json.optString("summary", json.optString("body", "No summary available."))
}

internal data class CallRecord(val json: JSONObject) {
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

internal data class TopicSuggestion(val json: JSONObject) {
    val id: String = json.optString("id")
    val communicationItemId: String = json.optString("communicationItemId")
    val targetType: String = json.optString("targetType", "new_topic")
    private val rawTitle: String = json.optString(
        "suggestedTopicTitle",
        json.optString("suggestedTitle", json.optString("title", "Untitled topic"))
    )
    val title: String = if (targetType == "new_topic") cleanTopicSuggestionTitle(rawTitle) else rawTitle
    val reason: String = json.optString("reason", "The assistant thinks this belongs with related communication.")
    val confidence: Double = json.optDouble("confidence", 0.0)
    private val source: JSONObject? = json.optJSONObject("sourceCommunication")
    val sourceCommunicationId: String = source?.optString("id").orEmpty()
    val dedupeKey: String = communicationItemId.ifBlank { sourceCommunicationId.ifBlank { id } }
    private val sourceName: String = source?.optString("displayName").orEmpty()
    private val sourceNumber: String = source?.optString("phoneNumber").orEmpty()
    private val sourceTime: String = formatCallTime(source?.optString("occurredAt").orEmpty())
    val sourceSummary: String = source?.optString("summary").orEmpty()
    val sourceLabel: String = buildList {
        val channel = source?.optString("channelLabel").orEmpty().ifBlank { "Communication" }
        val caller = sourceName.ifBlank { sourceNumber.ifBlank { "unknown caller" } }
        add("$channel from $caller")
        if (sourceTime.isNotBlank()) add(sourceTime)
    }.joinToString(" / ")
    val compactSourceLabel: String = buildList {
        val channel = source?.optString("channelLabel").orEmpty().ifBlank { "Communication" }
        val caller = sourceName.ifBlank { sourceNumber.ifBlank { "unknown caller" } }
        add("From $caller")
        add(channel)
        if (sourceTime.isNotBlank()) add(sourceTime)
    }.joinToString(" · ")
    val isExistingTopic: Boolean = targetType == "existing_topic"
    val reviewLabel: String = if (isExistingTopic) "Topic match" else "Suggested topic"
    val compactReason: String = compactSentence(sourceSummary.ifBlank { reason })
    val actionPreview: String = if (isExistingTopic) {
        "Add the source call to this topic."
    } else {
        "Create this topic and attach the source call."
    }
    val acceptLabel: String = if (isExistingTopic) "Add to topic" else "Create topic"
    val dismissLabel: String = "Dismiss"
    val acceptedToast: String = if (isExistingTopic) "Call added to topic." else "Topic created."
}

internal data class AppNotification(val json: JSONObject) {
    val id: String = json.optString("id", json.optString("notificationId"))
    val title: String = json.optString("title", "Assistant update")
    val body: String = json.optString("body", "Open Call Held to review.")
}

internal data class AgentNote(val json: JSONObject) {
    val id: String = json.optString("id")
    val status: String = json.optString("status", "active")
    val text: String = json.optString("text")
    val title: String = json.optString("title")
    val targetPhoneNumber: String = json.optString("targetPhoneNumber")
    val targetCallerName: String = json.optString("targetCallerName")
    val topic: String = json.optString("topic")
    val createdAt: String = json.optString("createdAt")
    val displayTitle: String = title.ifBlank {
        when {
            topic.isNotBlank() -> topic
            targetCallerName.isNotBlank() -> targetCallerName
            targetPhoneNumber.isNotBlank() -> targetPhoneNumber
            else -> "General note"
        }
    }
    val scopeLabel: String = when {
        topic.isNotBlank() && targetPhoneNumber.isNotBlank() -> "$topic / $targetPhoneNumber"
        topic.isNotBlank() -> topic
        targetCallerName.isNotBlank() -> targetCallerName
        targetPhoneNumber.isNotBlank() -> targetPhoneNumber
        else -> "General context"
    }
}

internal data class ApprovalRequest(val json: JSONObject) {
    val id: String = json.optString("id")
    val callerName: String = json.optString("callerName")
    val callerNumber: String = json.optString("callerNumber")
    val reason: String = json.optString("reason", "Caller requested live attention.")
    val urgency: String = json.optString("urgency", "unknown").replace('_', ' ')
    val displayCaller: String = callerName.ifBlank { callerNumber.ifBlank { "Caller" } }
    val expiresAt: String = json.optString("expiresAt")
}

internal data class AnswerRequest(val json: JSONObject) {
    val id: String = json.optString("id")
    val callerName: String = json.optString("callerName")
    val callerNumber: String = json.optString("callerNumber")
    val question: String = json.optString("question", "The caller has a question.")
    val reason: String = json.optString("reason")
    val urgency: String = json.optString("urgency", "unknown").replace('_', ' ')
    val displayCaller: String = callerName.ifBlank { callerNumber.ifBlank { "Caller" } }
    val expiresAt: String = json.optString("expiresAt")
}

internal data class ActiveCall(val json: JSONObject) {
    val displayCaller: String = json.optString("callerName", json.optString("fromNumber", "Caller"))
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

private fun formatCompactDateTime(value: String): String {
    if (value.isBlank()) return ""
    return runCatching {
        val instant = Instant.parse(value)
        DateTimeFormatter.ofPattern("MMM d, h:mm a").withZone(ZoneId.systemDefault()).format(instant)
    }.getOrDefault("")
}

internal fun String.toForwardingDigits(): String {
    val digits = filter(Char::isDigit)
    return if (digits.length == 11 && digits.startsWith("1")) digits.drop(1) else digits
}

internal fun cachedJson(value: String): JSONObject = runCatching { JSONObject(value) }.getOrElse { JSONObject() }

private fun compactSentence(value: String, maxLength: Int = 120): String {
    val normalized = value.replace(Regex("\\s+"), " ").trim()
    if (normalized.length <= maxLength) return normalized
    val sentenceEnd = listOf('.', '?', '!').map { normalized.indexOf(it) }
        .filter { it in 24 until maxLength }
        .minOrNull()
    if (sentenceEnd != null) return normalized.take(sentenceEnd + 1)
    return normalized.take(maxLength - 3).trimEnd() + "..."
}

internal fun cleanTopicSuggestionTitle(value: String): String {
    val original = value.replace(Regex("\\s+"), " ").trim()
    if (original.isBlank()) return "Suggested topic"

    var title = stripTopicDateAndTimeSuffix(original)
        .replace(Regex("^(scheduling and coordination|coordination|logistics|planning)\\s+for\\s+", RegexOption.IGNORE_CASE), "")
        .replace(Regex("\\s+(scheduling and coordination|coordination|logistics|planning)\\s+for\\s+[A-Z][A-Za-z'-]+(\\s+[A-Z][A-Za-z'-]+){0,2}$", RegexOption.IGNORE_CASE), "")
        .replace(Regex("^[A-Z][A-Za-z'-]+(\\s+[A-Z][A-Za-z'-]+)?'s\\s+"), "")
        .replace(Regex("\\s+for\\s+[A-Z][A-Za-z'-]+(\\s+[A-Z][A-Za-z'-]+){1,2}$"), "")
        .replace(Regex("[.:;,]+$"), "")
        .trim()

    title = stripTopicDateAndTimeSuffix(title).replace(Regex("\\s+"), " ").trim()
    return when {
        title.isBlank() -> original
        title.length > 64 -> original
        title.split(" ").filter(String::isNotBlank).size > 6 -> original
        generatedTopicTitlePhrases.any { title.contains(it, ignoreCase = true) } -> original
        else -> title
    }
}

private fun stripTopicDateAndTimeSuffix(value: String): String {
    val month = "(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)"
    return value
        .replace(Regex("\\s*\\([^)]*($month|\\d{1,2}:\\d{2}|\\b(am|pm)\\b)[^)]*\\)\\s*$", RegexOption.IGNORE_CASE), "")
        .replace(Regex("\\s+(on|for)\\s+$month\\s+\\d{1,2}(,\\s*\\d{4})?(\\s+(at\\s+)?\\d{1,2}(:\\d{2})?\\s*(am|pm)?)?\\s*$", RegexOption.IGNORE_CASE), "")
        .replace(Regex("\\s+(at|by)\\s+\\d{1,2}(:\\d{2})?\\s*(am|pm)\\s*$", RegexOption.IGNORE_CASE), "")
        .trim()
}

private val generatedTopicTitlePhrases = listOf(
    "called about",
    "call from",
    "called to"
)

internal fun stableCacheId(prefix: String, preferred: String, json: JSONObject): String {
    return preferred.ifBlank { "${prefix}_${json.toString().hashCode()}" }
}

internal fun <T> JSONArray?.toList(mapper: (JSONObject) -> T): List<T> {
    if (this == null) return emptyList()
    val result = ArrayList<T>()
    for (index in 0 until length()) {
        optJSONObject(index)?.let { result.add(mapper(it)) }
    }
    return result
}
