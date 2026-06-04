package com.phoneagent.app

import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import org.json.JSONObject

internal fun previewActions() = AppActions(
    selectTab = {},
    refresh = {},
    startGoogleSignin = {},
    startSignup = {},
    verifyCode = { _, _ -> },
    saveAssistantName = {},
    openTopics = {},
    openReview = {},
    openSearch = {},
    openTopic = {},
    openCall = {},
    openAddNote = {},
    openProfileSettings = {},
    openPhoneContacts = {},
    syncPhoneContacts = {},
    disconnectPhoneContacts = {},
    openSystemSettings = {},
    saveAgentNote = { _, _, _ -> },
    archiveAgentNote = {},
    acceptTransfer = {},
    declineTransfer = {},
    sendLiveAnswer = { _, _ -> },
    declineLiveAnswer = {},
    back = {},
    openForwarding = {},
    openBilling = {},
    openCheckout = {},
    activateBilling = {},
    cancelSubscription = {},
    removeAccount = {},
    signOut = {},
    dial = {},
    createTopic = { _, _ -> },
    acceptSuggestion = {},
    dismissSuggestion = {},
    callNumber = {}
)

internal fun previewState(selectedTab: Tab = Tab.Home, screen: Screen = Screen.Main) = PhoneAgentUiState(
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
    notifications = listOf(AppNotification(JSONObject("""{"title":"Calendar changed","body":"Addison created one approved event."}"""))),
    agentNotes = listOf(
        AgentNote(JSONObject("""{"id":"note_1","status":"active","text":"If Theresa calls, tell her I am leaving around 6:15 and can pick up dinner.","topic":"Family Schedule"}"""))
    ),
    approvalRequests = listOf(
        ApprovalRequest(JSONObject("""{"id":"approval_1","callerName":"Greg","reason":"Contractor says he needs a decision on the plumbing change while he is on-site.","urgency":"high"}"""))
    ),
    answerRequests = listOf(
        AnswerRequest(JSONObject("""{"id":"answer_1","callerName":"Theresa","question":"What state does Daryl live in?","urgency":"normal"}"""))
    ),
    contactSync = ContactSyncStatus(JSONObject("""{"syncedCount":128,"phoneNumberCount":184,"lastSyncedAt":"2026-06-03T12:30:00.000Z"}"""))
)

@Preview(showBackground = true, widthDp = 393, heightDp = 873)
@Composable
private fun HomePreview() {
    PhoneAgentTheme { PhoneAgentApp(previewState(Tab.Home), previewActions()) }
}

@Preview(showBackground = true, widthDp = 393, heightDp = 873)
@Composable
private fun TopicsPreview() {
    PhoneAgentTheme { PhoneAgentApp(previewState(screen = Screen.Topics), previewActions()) }
}

@Preview(showBackground = true, widthDp = 393, heightDp = 873)
@Composable
private fun ReviewPreview() {
    PhoneAgentTheme { PhoneAgentApp(previewState(screen = Screen.Review), previewActions()) }
}

@Preview(showBackground = true, widthDp = 393, heightDp = 873)
@Composable
private fun AssistantPreview() {
    PhoneAgentTheme { PhoneAgentApp(previewState(Tab.Assistant), previewActions()) }
}

@Preview(showBackground = true, widthDp = 393, heightDp = 873)
@Composable
private fun SearchPreview() {
    PhoneAgentTheme { PhoneAgentApp(previewState(screen = Screen.Search), previewActions()) }
}

@Preview(showBackground = true, widthDp = 393, heightDp = 873)
@Composable
private fun ProfilePreview() {
    PhoneAgentTheme { PhoneAgentApp(previewState(Tab.Profile), previewActions()) }
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
private fun PhoneContactsPreview() {
    PhoneAgentTheme { PhoneAgentApp(previewState(screen = Screen.PhoneContacts), previewActions()) }
}

@Preview(showBackground = true, widthDp = 393, heightDp = 873)
@Composable
private fun AddNotePreview() {
    PhoneAgentTheme { PhoneAgentApp(previewState(screen = Screen.AddNote("+17032988965")), previewActions()) }
}
