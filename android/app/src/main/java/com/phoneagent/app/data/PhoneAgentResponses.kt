package com.phoneagent.app.data

import com.phoneagent.app.ActiveCall
import com.phoneagent.app.AppNotification
import com.phoneagent.app.BillingAccount
import com.phoneagent.app.CallRecord
import com.phoneagent.app.ContactSyncStatus
import com.phoneagent.app.OnboardingStatus
import com.phoneagent.app.TopicSuggestion
import com.phoneagent.app.TopicThread
import com.phoneagent.app.UserSummary
import com.phoneagent.app.toList
import org.json.JSONObject

internal data class UserSummaryResponse(val user: UserSummary) {
    companion object {
        fun from(json: JSONObject): UserSummaryResponse =
            UserSummaryResponse(json.optJSONObject("user")?.let(::UserSummary) ?: UserSummary.empty)
    }
}

internal data class BillingAccountResponse(val account: BillingAccount) {
    companion object {
        fun from(json: JSONObject): BillingAccountResponse =
            BillingAccountResponse(json.optJSONObject("account")?.let(::BillingAccount) ?: BillingAccount.empty)
    }
}

internal data class OnboardingStatusResponse(val status: OnboardingStatus) {
    companion object {
        fun from(json: JSONObject): OnboardingStatusResponse =
            OnboardingStatusResponse(json.optJSONObject("status")?.let(::OnboardingStatus) ?: OnboardingStatus.empty)
    }
}

internal data class TopicListResponse(val topics: List<TopicThread>) {
    companion object {
        fun from(json: JSONObject): TopicListResponse =
            TopicListResponse(json.optJSONArray("topics").toList(::TopicThread))
    }
}

internal data class CallListResponse(val calls: List<CallRecord>) {
    companion object {
        fun from(json: JSONObject): CallListResponse =
            CallListResponse(json.optJSONArray("calls").toList(::CallRecord))
    }
}

internal data class TopicSuggestionListResponse(val suggestions: List<TopicSuggestion>) {
    companion object {
        fun from(json: JSONObject): TopicSuggestionListResponse =
            TopicSuggestionListResponse(json.optJSONArray("suggestions").toList(::TopicSuggestion))
    }
}

internal data class NotificationListResponse(val notifications: List<AppNotification>) {
    companion object {
        fun from(json: JSONObject): NotificationListResponse =
            NotificationListResponse(json.optJSONArray("notifications").toList(::AppNotification))
    }
}

internal data class ContactSyncStatusResponse(val status: ContactSyncStatus) {
    companion object {
        fun from(json: JSONObject): ContactSyncStatusResponse =
            ContactSyncStatusResponse(json.optJSONObject("status")?.let(::ContactSyncStatus) ?: ContactSyncStatus.empty)
    }
}

internal data class ContactSyncResultResponse(val result: ContactSyncStatus) {
    companion object {
        fun from(json: JSONObject): ContactSyncResultResponse =
            ContactSyncResultResponse(json.optJSONObject("result")?.let(::ContactSyncStatus) ?: ContactSyncStatus.empty)
    }
}

internal data class ActiveCallResponse(val activeCall: ActiveCall?) {
    companion object {
        fun from(json: JSONObject): ActiveCallResponse =
            ActiveCallResponse(json.optJSONObject("activeCall")?.let(::ActiveCall))
    }
}

internal data class BillingCheckoutSessionResponse(val url: String) {
    companion object {
        fun from(json: JSONObject): BillingCheckoutSessionResponse =
            BillingCheckoutSessionResponse(json.optJSONObject("session")?.optString("url").orEmpty())
    }
}
