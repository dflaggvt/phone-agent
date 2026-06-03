package com.phoneagent.app.data

import androidx.room.withTransaction
import com.phoneagent.app.ActiveCall
import com.phoneagent.app.AppNotification
import com.phoneagent.app.AppSnapshot
import com.phoneagent.app.BillingAccount
import com.phoneagent.app.CallRecord
import com.phoneagent.app.ContactSyncStatus
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
            contactSync = ContactSyncStatusResponse.from(getJson(token, "/v1/contacts/status")).status,
            activeCall = ActiveCallResponse.from(getJson(token, "/v1/calls/active")).activeCall
        )

    suspend fun readCachedSnapshot(): AppSnapshot? = withContext(Dispatchers.IO) {
        val dao = database.cacheDao()
        val user = dao.singleton(CACHE_USER)
        val billing = dao.singleton(CACHE_BILLING)
        val onboarding = dao.singleton(CACHE_ONBOARDING)
        val contactSync = dao.singleton(CACHE_CONTACTS)
        val activeCall = dao.singleton(CACHE_ACTIVE_CALL)
        val topics = dao.topics()
        val calls = dao.calls()
        val suggestions = dao.topicSuggestions()
        val notifications = dao.notifications()
        val hasCachedState = user != null ||
            billing != null ||
            onboarding != null ||
            contactSync != null ||
            activeCall != null ||
            topics.isNotEmpty() ||
            calls.isNotEmpty() ||
            suggestions.isNotEmpty() ||
            notifications.isNotEmpty()
        if (!hasCachedState) return@withContext null
        AppSnapshot(
            me = user?.json?.let { UserSummary(cachedJson(it)) } ?: UserSummary.empty,
            billing = billing?.json?.let { BillingAccount(cachedJson(it)) } ?: BillingAccount.empty,
            onboarding = onboarding?.json?.let { OnboardingStatus(cachedJson(it)) } ?: OnboardingStatus.empty,
            topics = topics.map { TopicThread(cachedJson(it.json)) },
            calls = calls.map { CallRecord(cachedJson(it.json)) },
            suggestions = suggestions.map { TopicSuggestion(cachedJson(it.json)) },
            notifications = notifications.map { AppNotification(cachedJson(it.json)) },
            contactSync = contactSync?.json?.let { ContactSyncStatus(cachedJson(it)) } ?: ContactSyncStatus.empty,
            activeCall = activeCall?.json?.let { ActiveCall(cachedJson(it)) }
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
        postJson(token, "/v1/topic-suggestions/${pathSegment(suggestionId)}/$action", null)
    }

    suspend fun createAgentNote(token: String, request: AgentNoteCreateRequest) {
        postJson(token, "/v1/agent-notes", request.toJson())
    }

    suspend fun createBillingCheckoutSession(token: String): String {
        return BillingCheckoutSessionResponse.from(postJson(token, "/v1/billing/checkout-session", JSONObject())).url
    }

    suspend fun activateBilling(token: String) {
        postJson(token, "/v1/billing/activate", JSONObject())
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
    }
}

private fun JSONObject.putContacts(contacts: List<DeviceContactInput>): JSONObject =
    put("contacts", JSONArray().apply { contacts.forEach { put(it.toJson()) } })

private fun pathSegment(value: String): String =
    URLEncoder.encode(value, StandardCharsets.UTF_8.toString()).replace("+", "%20")
