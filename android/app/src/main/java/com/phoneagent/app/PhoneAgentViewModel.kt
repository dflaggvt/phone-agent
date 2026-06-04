package com.phoneagent.app

import androidx.lifecycle.ViewModel
import com.phoneagent.app.data.PhoneAgentRepository
import com.phoneagent.app.data.ProductAnalyticsEventInput
import com.phoneagent.app.data.PushTokenRegistrationRequest
import com.phoneagent.app.data.TopicCreateRequest
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

@HiltViewModel
internal class PhoneAgentViewModel @Inject constructor(
    private val repository: PhoneAgentRepository
) : ViewModel() {
    private val mutableUiState = MutableStateFlow(PhoneAgentUiState())
    val uiState: StateFlow<PhoneAgentUiState> = mutableUiState.asStateFlow()

    fun setState(state: PhoneAgentUiState) {
        mutableUiState.value = state
    }

    suspend fun hydrateFromCache(): AppSnapshot? {
        val snapshot = repository.readCachedSnapshot() ?: return null
        applySnapshot(snapshot, keepScreen = false)
        return snapshot
    }

    suspend fun refreshData(token: String, forceStatus: Boolean, keepScreen: Boolean): AppSnapshot {
        mutableUiState.value = mutableUiState.value.copy(
            loading = true,
            status = if (forceStatus) "Syncing" else mutableUiState.value.status
        )
        val snapshot = repository.loadAppSnapshot(token)
        applySnapshot(snapshot, keepScreen = keepScreen)
        repository.cacheSnapshot(snapshot)
        return snapshot
    }

    suspend fun clearCache() {
        repository.clearCache()
    }

    suspend fun createTopic(token: String, request: TopicCreateRequest) {
        repository.createTopic(token, request)
    }

    suspend fun decideTopicSuggestion(token: String, suggestionId: String, accept: Boolean) {
        repository.decideTopicSuggestion(token, suggestionId, accept)
    }

    suspend fun registerPushToken(token: String, request: PushTokenRegistrationRequest) {
        repository.registerPushToken(token, request)
    }

    suspend fun submitAnalyticsEvent(token: String, event: ProductAnalyticsEventInput) {
        repository.submitAnalyticsEvent(token, event)
    }

    private fun applySnapshot(snapshot: AppSnapshot, keepScreen: Boolean) {
        val current = mutableUiState.value
        mutableUiState.value = current.copy(
            loading = false,
            status = if (snapshot.activeCall != null) "Live" else if (snapshot.onboarding.ready) "Active" else "Setup",
            dataFreshness = snapshot.dataFreshness,
            user = snapshot.me,
            billing = snapshot.billing,
            onboarding = snapshot.onboarding,
            topics = snapshot.topics,
            calls = snapshot.calls,
            suggestions = snapshot.suggestions,
            notifications = snapshot.notifications,
            agentNotes = snapshot.agentNotes,
            approvalRequests = snapshot.approvalRequests,
            answerRequests = snapshot.answerRequests,
            contactSync = snapshot.contactSync,
            contactSyncing = false,
            activeCall = snapshot.activeCall,
            screen = when {
                keepScreen -> current.screen
                current.screen is Screen.Auth ||
                    current.screen is Screen.CodeEntry ||
                    current.screen is Screen.Startup ||
                    current.screen is Screen.StartupIssue -> Screen.Main
                else -> current.screen
            },
            error = null
        )
    }
}
