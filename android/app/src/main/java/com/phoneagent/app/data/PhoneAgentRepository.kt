package com.phoneagent.app.data

import androidx.room.withTransaction
import com.phoneagent.app.ActiveCall
import com.phoneagent.app.AgentNote
import com.phoneagent.app.AnswerRequest
import com.phoneagent.app.AppNotification
import com.phoneagent.app.ApprovalRequest
import com.phoneagent.app.AppSnapshot
import com.phoneagent.app.BillingAccount
import com.phoneagent.app.CallRecord
import com.phoneagent.app.ContactSyncStatus
import com.phoneagent.app.DataFreshness
import com.phoneagent.app.OnboardingStatus
import com.phoneagent.app.TopicSuggestion
import com.phoneagent.app.TopicThread
import com.phoneagent.app.UserSummary
import com.phoneagent.app.cachedJson
import com.phoneagent.app.data.remote.PhoneAgentBackendClient
import com.phoneagent.app.data.local.CachedCallEntity
import com.phoneagent.app.data.local.CachedNotificationEntity
import com.phoneagent.app.data.local.CachedSingletonEntity
import com.phoneagent.app.data.local.CachedTopicEntity
import com.phoneagent.app.data.local.CachedTopicSuggestionEntity
import com.phoneagent.app.data.local.PhoneAgentDatabase
import com.phoneagent.app.stableCacheId
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

@Singleton
internal class PhoneAgentRepository @Inject constructor(
    private val backendClient: PhoneAgentBackendClient,
    private val database: PhoneAgentDatabase
) {
    suspend fun loadAppSnapshot(token: String): AppSnapshot =
        AppSnapshot(
            me = UserSummaryResponse.from(getJson(token, "/v1/me")).user,
            billing = BillingAccountResponse.from(getJson(token, "/v1/billing/account")).account,
            onboarding = OnboardingStatusResponse.from(getJson(token, "/v1/onboarding/status")).status,
            topics = TopicListResponse.from(getJson(token, "/v1/topics")).topics,
            calls = CallListResponse.from(getJson(token, "/v1/calls")).calls,
            suggestions = TopicSuggestionListResponse.from(getJson(token, "/v1/topic-suggestions")).suggestions,
            notifications = NotificationListResponse.from(getJson(token, "/v1/notifications?unread=true")).notifications,
            agentNotes = AgentNoteListResponse.from(getJson(token, "/v1/agent-notes")).notes,
            approvalRequests = ApprovalRequestListResponse.from(getJson(token, "/v1/approval-requests")).approvalRequests,
            answerRequests = AnswerRequestListResponse.from(getJson(token, "/v1/answer-requests")).answerRequests,
            contactSync = ContactSyncStatusResponse.from(getJson(token, "/v1/contacts/status")).status,
            activeCall = ActiveCallResponse.from(getJson(token, "/v1/calls/active")).activeCall,
            dataFreshness = DataFreshness.fresh()
        )

    suspend fun readCachedSnapshot(): AppSnapshot? = withContext(Dispatchers.IO) {
        val dao = database.cacheDao()
        val user = dao.singleton(CACHE_USER)
        val billing = dao.singleton(CACHE_BILLING)
        val onboarding = dao.singleton(CACHE_ONBOARDING)
        val contactSync = dao.singleton(CACHE_CONTACTS)
        val activeCall = dao.singleton(CACHE_ACTIVE_CALL)
        val agentNotes = dao.singleton(CACHE_AGENT_NOTES)
        val approvalRequests = dao.singleton(CACHE_APPROVAL_REQUESTS)
        val answerRequests = dao.singleton(CACHE_ANSWER_REQUESTS)
        val topics = dao.topics()
        val calls = dao.calls()
        val suggestions = dao.topicSuggestions()
        val notifications = dao.notifications()
        val hasCachedState = user != null ||
            billing != null ||
            onboarding != null ||
            contactSync != null ||
            activeCall != null ||
            agentNotes != null ||
            approvalRequests != null ||
            answerRequests != null ||
            topics.isNotEmpty() ||
            calls.isNotEmpty() ||
            suggestions.isNotEmpty() ||
            notifications.isNotEmpty()
        if (!hasCachedState) return@withContext null
        val activeCallValue = activeCall?.json?.let { ActiveCall(cachedJson(it)) }
        val cachedAt = listOfNotNull(
            user?.cachedAtEpochMs,
            billing?.cachedAtEpochMs,
            onboarding?.cachedAtEpochMs,
            contactSync?.cachedAtEpochMs,
            activeCall?.cachedAtEpochMs,
            agentNotes?.cachedAtEpochMs,
            approvalRequests?.cachedAtEpochMs,
            answerRequests?.cachedAtEpochMs,
            topics.maxOfOrNull { it.cachedAtEpochMs },
            calls.maxOfOrNull { it.cachedAtEpochMs },
            suggestions.maxOfOrNull { it.cachedAtEpochMs },
            notifications.maxOfOrNull { it.cachedAtEpochMs }
        ).maxOrNull() ?: System.currentTimeMillis()
        AppSnapshot(
            me = user?.json?.let { UserSummary(cachedJson(it)) } ?: UserSummary.empty,
            billing = billing?.json?.let { BillingAccount(cachedJson(it)) } ?: BillingAccount.empty,
            onboarding = onboarding?.json?.let { OnboardingStatus(cachedJson(it)) } ?: OnboardingStatus.empty,
            topics = topics.map { TopicThread(cachedJson(it.json)) },
            calls = calls.map { CallRecord(cachedJson(it.json)) },
            suggestions = suggestions.map { TopicSuggestion(cachedJson(it.json)) },
            notifications = notifications.map { AppNotification(cachedJson(it.json)) },
            agentNotes = agentNotes?.json?.let { cachedJson(it).optJSONArray("notes").mapJsonObjects(::AgentNote) } ?: emptyList(),
            approvalRequests = approvalRequests?.json?.let { cachedJson(it).optJSONArray("approvalRequests").mapJsonObjects(::ApprovalRequest) } ?: emptyList(),
            answerRequests = answerRequests?.json?.let { cachedJson(it).optJSONArray("answerRequests").mapJsonObjects(::AnswerRequest) } ?: emptyList(),
            contactSync = contactSync?.json?.let { ContactSyncStatus(cachedJson(it)) } ?: ContactSyncStatus.empty,
            activeCall = activeCallValue,
            dataFreshness = DataFreshness.cached(cachedAt, hasLiveCall = activeCallValue != null)
        )
    }

    suspend fun cacheSnapshot(snapshot: AppSnapshot) = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        database.withTransaction {
            val dao = database.cacheDao()
            dao.upsertSingleton(CachedSingletonEntity(CACHE_USER, snapshot.me.json.toString(), now))
            dao.upsertSingleton(CachedSingletonEntity(CACHE_BILLING, snapshot.billing.json.toString(), now))
            dao.upsertSingleton(CachedSingletonEntity(CACHE_ONBOARDING, snapshot.onboarding.json.toString(), now))
            dao.upsertSingleton(CachedSingletonEntity(CACHE_CONTACTS, snapshot.contactSync.json.toString(), now))
            dao.upsertSingleton(CachedSingletonEntity(CACHE_AGENT_NOTES, JSONObject().put("notes", JSONArray().apply {
                snapshot.agentNotes.forEach { put(it.json) }
            }).toString(), now))
            dao.upsertSingleton(CachedSingletonEntity(CACHE_APPROVAL_REQUESTS, JSONObject().put("approvalRequests", JSONArray().apply {
                snapshot.approvalRequests.forEach { put(it.json) }
            }).toString(), now))
            dao.upsertSingleton(CachedSingletonEntity(CACHE_ANSWER_REQUESTS, JSONObject().put("answerRequests", JSONArray().apply {
                snapshot.answerRequests.forEach { put(it.json) }
            }).toString(), now))
            if (snapshot.activeCall == null) {
                dao.deleteSingleton(CACHE_ACTIVE_CALL)
            } else {
                dao.upsertSingleton(CachedSingletonEntity(CACHE_ACTIVE_CALL, snapshot.activeCall.json.toString(), now))
            }

            dao.clearTopics()
            if (snapshot.topics.isNotEmpty()) {
                dao.upsertTopics(
                    snapshot.topics.map { topic ->
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
            if (snapshot.calls.isNotEmpty()) {
                dao.upsertCalls(
                    snapshot.calls.map { call ->
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
            if (snapshot.suggestions.isNotEmpty()) {
                dao.upsertTopicSuggestions(
                    snapshot.suggestions.map { suggestion ->
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
            if (snapshot.notifications.isNotEmpty()) {
                dao.upsertNotifications(
                    snapshot.notifications.map { notification ->
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

    suspend fun clearCache() = withContext(Dispatchers.IO) {
        database.withTransaction {
            val dao = database.cacheDao()
            dao.clearSingletons()
            dao.clearTopics()
            dao.clearCalls()
            dao.clearTopicSuggestions()
            dao.clearNotifications()
        }
    }

    suspend fun syncContacts(token: String, contacts: List<DeviceContactInput>): ContactSyncStatus {
        val payload = JSONObject().putContacts(contacts)
        return ContactSyncResultResponse.from(postJson(token, "/v1/contacts/sync", payload)).result
    }

    suspend fun disconnectContacts(token: String): ContactSyncStatus =
        ContactSyncStatusResponse.from(backendClient.deleteJson(token, "/v1/contacts/sync")).status

    suspend fun updateDisplayName(token: String, displayName: String) {
        patchJson(token, "/v1/me/config", JSONObject().put("displayName", displayName))
    }

    suspend fun updateAssistantProfile(token: String, profile: AssistantProfileUpdate) {
        patchJson(token, "/v1/me/assistant-profile", profile.toJson())
    }

    suspend fun createTopic(token: String, request: TopicCreateRequest) {
        postJson(token, "/v1/topics", request.toJson())
    }

    suspend fun decideTopicSuggestion(token: String, suggestionId: String, accept: Boolean) {
        val action = if (accept) "accept" else "dismiss"
        postJson(token, "/v1/topic-suggestions/${pathSegment(suggestionId)}/$action", JSONObject())
        database.cacheDao().deleteTopicSuggestion(suggestionId)
    }

    suspend fun createAgentNote(token: String, request: AgentNoteCreateRequest) {
        postJson(token, "/v1/agent-notes", request.toJson())
    }

    suspend fun archiveAgentNote(token: String, noteId: String) {
        backendClient.deleteJson(token, "/v1/agent-notes/${pathSegment(noteId)}")
    }

    suspend fun acceptTransfer(token: String, approvalRequestId: String) {
        postJson(token, "/v1/approval-requests/${pathSegment(approvalRequestId)}/accept", JSONObject())
    }

    suspend fun declineTransfer(token: String, approvalRequestId: String) {
        postJson(token, "/v1/approval-requests/${pathSegment(approvalRequestId)}/decline", JSONObject())
    }

    suspend fun sendLiveAnswer(token: String, answerRequestId: String, answer: String) {
        postJson(token, "/v1/answer-requests/${pathSegment(answerRequestId)}/reply", JSONObject().put("answer", answer))
    }

    suspend fun declineLiveAnswer(token: String, answerRequestId: String) {
        postJson(token, "/v1/answer-requests/${pathSegment(answerRequestId)}/decline", JSONObject())
    }

    suspend fun createBillingCheckoutSession(token: String): String {
        return BillingCheckoutSessionResponse.from(postJson(token, "/v1/billing/checkout-session", JSONObject())).url
    }

    suspend fun createBillingCustomerPortalSession(token: String): String =
        BillingUrlResponse.from(postJson(token, "/v1/billing/customer-portal", JSONObject())).url

    suspend fun activateBilling(token: String): BillingAccount =
        BillingAccountResponse.from(postJson(token, "/v1/billing/activate", JSONObject())).account

    suspend fun cancelSubscription(token: String): BillingAccount =
        BillingAccountResponse.from(postJson(token, "/v1/billing/cancel-subscription", JSONObject())).account

    suspend fun removeAccount(token: String) {
        backendClient.deleteJson(token, "/v1/account")
    }

    suspend fun registerPushToken(token: String, request: PushTokenRegistrationRequest) {
        postJson(token, "/v1/push-tokens", request.toJson())
    }

    suspend fun submitAnalyticsEvent(token: String, event: ProductAnalyticsEventInput) {
        val payload = JSONObject().put("events", JSONArray().put(event.toJson()))
        postJson(token, "/v1/analytics/events", payload)
    }

    private suspend fun getJson(token: String, path: String): JSONObject = backendClient.getJson(token, path)

    private suspend fun postJson(token: String, path: String, payload: JSONObject?): JSONObject =
        backendClient.postJson(token, path, payload)

    private suspend fun patchJson(token: String, path: String, payload: JSONObject): JSONObject =
        backendClient.patchJson(token, path, payload)

    private companion object {
        const val CACHE_USER = "user"
        const val CACHE_BILLING = "billing"
        const val CACHE_ONBOARDING = "onboarding"
        const val CACHE_ACTIVE_CALL = "active_call"
        const val CACHE_CONTACTS = "contacts"
        const val CACHE_AGENT_NOTES = "agent_notes"
        const val CACHE_APPROVAL_REQUESTS = "approval_requests"
        const val CACHE_ANSWER_REQUESTS = "answer_requests"
    }
}

private fun JSONObject.putContacts(contacts: List<DeviceContactInput>): JSONObject =
    put("contacts", JSONArray().apply { contacts.forEach { put(it.toJson()) } })

private fun <T> JSONArray?.mapJsonObjects(factory: (JSONObject) -> T): List<T> =
    if (this == null) {
        emptyList()
    } else {
        (0 until length()).mapNotNull { index ->
            optJSONObject(index)?.let(factory)
        }
    }

private fun pathSegment(value: String): String =
    URLEncoder.encode(value, StandardCharsets.UTF_8.toString()).replace("+", "%20")
