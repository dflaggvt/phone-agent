package com.phoneagent.app

import androidx.lifecycle.ViewModel
import com.phoneagent.app.data.AgentNoteCreateRequest
import com.phoneagent.app.data.AssistantProfileUpdate
import com.phoneagent.app.data.DeviceContactInput
import com.phoneagent.app.data.PhoneAgentRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

internal data class HomeScreenSummary(
    val topicCount: Int = 0,
    val recentCallCount: Int = 0,
    val needsAttentionCount: Int = 0,
    val hasLiveCall: Boolean = false
)

@HiltViewModel
internal class HomeScreenViewModel @Inject constructor() : ViewModel() {
    private val mutableSummary = MutableStateFlow(HomeScreenSummary())
    val summary: StateFlow<HomeScreenSummary> = mutableSummary.asStateFlow()

    fun update(snapshot: AppSnapshot) {
        mutableSummary.value = HomeScreenSummary(
            topicCount = snapshot.topics.size,
            recentCallCount = snapshot.calls.size,
            needsAttentionCount = snapshot.suggestions.size + snapshot.notifications.size,
            hasLiveCall = snapshot.activeCall != null
        )
    }
}

@HiltViewModel
internal class OnboardingViewModel @Inject constructor(
    private val repository: PhoneAgentRepository
) : ViewModel() {
    suspend fun updateDisplayName(token: String, displayName: String) {
        repository.updateDisplayName(token, displayName)
    }

    suspend fun updateAssistantProfile(token: String, profile: AssistantProfileUpdate) {
        repository.updateAssistantProfile(token, profile)
    }
}

@HiltViewModel
internal class BillingViewModel @Inject constructor(
    private val repository: PhoneAgentRepository
) : ViewModel() {
    suspend fun createCheckoutSession(token: String): String =
        repository.createBillingCheckoutSession(token)

    suspend fun createCustomerPortalSession(token: String): String =
        repository.createBillingCustomerPortalSession(token)

    suspend fun activateBilling(token: String): BillingAccount =
        repository.activateBilling(token)

    suspend fun cancelSubscription(token: String): BillingAccount =
        repository.cancelSubscription(token)
}

@HiltViewModel
internal class ContactsViewModel @Inject constructor(
    private val repository: PhoneAgentRepository
) : ViewModel() {
    suspend fun syncContacts(token: String, contacts: List<DeviceContactInput>): ContactSyncStatus =
        repository.syncContacts(token, contacts)

    suspend fun disconnectContacts(token: String): ContactSyncStatus =
        repository.disconnectContacts(token)
}

@HiltViewModel
internal class AssistantLiveViewModel @Inject constructor(
    private val repository: PhoneAgentRepository
) : ViewModel() {
    private val mutableLiveState = MutableStateFlow<ActiveCall?>(null)
    val liveState: StateFlow<ActiveCall?> = mutableLiveState.asStateFlow()

    fun update(snapshot: AppSnapshot) {
        mutableLiveState.value = snapshot.activeCall
    }

    suspend fun createAgentNote(token: String, request: AgentNoteCreateRequest) {
        repository.createAgentNote(token, request)
    }

    suspend fun archiveAgentNote(token: String, noteId: String) {
        repository.archiveAgentNote(token, noteId)
    }

    suspend fun acceptTransfer(token: String, approvalRequestId: String) {
        repository.acceptTransfer(token, approvalRequestId)
    }

    suspend fun declineTransfer(token: String, approvalRequestId: String) {
        repository.declineTransfer(token, approvalRequestId)
    }

    suspend fun sendLiveAnswer(token: String, answerRequestId: String, answer: String) {
        repository.sendLiveAnswer(token, answerRequestId, answer)
    }

    suspend fun declineLiveAnswer(token: String, answerRequestId: String) {
        repository.declineLiveAnswer(token, answerRequestId)
    }
}
