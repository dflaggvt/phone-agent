package com.phoneagent.app

import android.content.Context
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.material.icons.automirrored.filled.NoteAdd
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SettingsPhone
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
@Composable
internal fun PhoneAgentApp(state: PhoneAgentUiState, actions: AppActions) {
    BackHandler(
        enabled = when (state.screen) {
            Screen.Forwarding, Screen.Billing, Screen.ProfileSettings, Screen.PhoneContacts -> true
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
            Screen.ProfileSettings -> ProfileSettingsScreen(state, actions)
            Screen.PhoneContacts -> PhoneContactsScreen(state, actions)
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
        item { Header("Welcome", state.copy(status = "Setup"), {}, showRefresh = false, showPresence = false) }
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
        Header(state.selectedTab.label, state, actions.refresh, actions.openProfileSettings)
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
private fun Header(title: String, state: PhoneAgentUiState, onRefresh: () -> Unit, onPresenceClick: () -> Unit = {}, showRefresh: Boolean = true, showPresence: Boolean = true) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                title,
                color = Color.White,
                fontSize = 26.sp,
                lineHeight = 30.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (state.dataFreshness.shouldShow) {
                Text(
                    state.dataFreshness.displayLabel,
                    color = Color.White.copy(alpha = 0.74f),
                    fontSize = 11.sp,
                    lineHeight = 14.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
        if (showPresence) {
            AssistantPresence(state, onPresenceClick)
        }
        if (showRefresh) {
            IconButton(onClick = onRefresh) {
                Icon(Icons.Filled.Refresh, contentDescription = "Refresh", tint = Color.White.copy(alpha = 0.8f))
            }
        }
    }
}

@Composable
private fun AssistantPresence(state: PhoneAgentUiState, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val presence = presenceState(state)
    Surface(
        modifier = modifier
            .height(38.dp)
            .clip(CircleShape)
            .clickable(onClick = onClick),
        shape = CircleShape,
        color = Color.White.copy(alpha = 0.92f),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.20f))
    ) {
        Row(Modifier.padding(start = 10.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(Modifier.size(8.dp), shape = CircleShape, color = presence.color) {}
            Spacer(Modifier.width(7.dp))
            Text(presence.label, color = Ink, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1)
            Spacer(Modifier.width(8.dp))
            Surface(Modifier.size(30.dp), shape = CircleShape, color = Soft) {
                Box(contentAlignment = Alignment.Center) {
                    Text(state.user.initials.ifBlank { "PA" }, color = Ink, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

private data class PresenceState(val label: String, val color: Color)

private fun presenceState(state: PhoneAgentUiState): PresenceState {
    return when {
        state.dataFreshness.state == FreshnessState.Offline -> PresenceState("Offline", Muted)
        state.activeCall != null -> PresenceState("Live", Warning)
        state.notifications.isNotEmpty() || state.suggestions.isNotEmpty() -> PresenceState("Needs you", Critical)
        state.status == "Syncing" -> PresenceState("Syncing", Info)
        state.status == "Setup" -> PresenceState("Setup", Warning)
        state.status == "Active" -> PresenceState("Ready", Success)
        else -> PresenceState(state.status.ifBlank { "Ready" }, Muted)
    }
}

private fun assistantStatusSentence(state: PhoneAgentUiState): String {
    val assistantName = state.user.assistantName.ifBlank { "Assistant" }
    return when (presenceState(state).label) {
        "Needs you" -> "$assistantName needs you"
        "Live" -> "$assistantName is live"
        "Ready" -> "$assistantName is ready"
        "Setup" -> "$assistantName needs setup"
        "Syncing" -> "$assistantName is syncing"
        "Offline" -> "$assistantName is offline"
        "Paused" -> "$assistantName is paused"
        else -> "$assistantName is ready"
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
        item { Header("Welcome", state, {}, showRefresh = false, showPresence = false) }
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
    var filter by remember { mutableStateOf("All") }
    val liveRequestCount = state.approvalRequests.size + state.answerRequests.size
    ScreenList {
        item {
            Text("Review is where calls, topic suggestions, and live requests get cleaned up before they become memory.", color = Color.White.copy(alpha = 0.86f), fontSize = 15.sp, lineHeight = 20.sp)
        }
        item {
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("All", "Topics", "Calls", "Live", "Updates").forEach { label ->
                    CalmFilterChip(label = label, selected = filter == label, onClick = { filter = label })
                }
            }
        }
        if ((filter == "All" || filter == "Topics") && state.suggestions.isNotEmpty()) {
            item { SectionLabel("Topic suggestions") }
            state.suggestions.forEach { item { SuggestionCard(it, actions) } }
        }
        if ((filter == "All" || filter == "Live") && liveRequestCount > 0) {
            item { SectionLabel("Live requests") }
            state.approvalRequests.forEach { item { TransferRequestCard(it, actions) } }
            state.answerRequests.forEach { item { AnswerRequestCard(it, actions) } }
        }
        if ((filter == "All" || filter == "Updates") && state.notifications.isNotEmpty()) {
            item { SectionLabel("Assistant updates") }
            state.notifications.forEach { item { QuietCard(it.title, it.body) } }
        }
        if ((filter == "All" || filter == "Calls") && state.calls.isNotEmpty()) {
            item { SectionLabel("Calls to organize") }
            state.calls.take(12).forEach { item { CallRow(it, actions) } }
        }
        if (
            (filter == "Topics" && state.suggestions.isEmpty()) ||
            (filter == "Live" && liveRequestCount == 0) ||
            (filter == "Updates" && state.notifications.isEmpty()) ||
            (filter == "Calls" && state.calls.isEmpty()) ||
            (filter == "All" && state.suggestions.isEmpty() && liveRequestCount == 0 && state.notifications.isEmpty() && state.calls.isEmpty())
        ) {
            item { QuietCard("Nothing to review", "When the assistant needs cleanup, approval, or organization, it will appear here.") }
        }
    }
}

@Composable
private fun AssistantScreen(state: PhoneAgentUiState, actions: AppActions) {
    val assistantNumber = state.user.assistantNumber.ifBlank { BuildConfig.PHONE_AGENT_NUMBER }
    val liveRequestCount = state.approvalRequests.size + state.answerRequests.size
    ScreenList {
        item {
            WorkCard {
                Text(if (state.activeCall == null) "Assistant is active" else "Assistant is on a call", fontSize = 19.sp, lineHeight = 23.sp, fontWeight = FontWeight.Bold, color = Ink)
                Text(state.activeCall?.displayCaller ?: "Ready to answer, summarize, ask for help, and protect your attention.", color = Muted, fontSize = 14.sp, lineHeight = 19.sp)
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    MetricTile("Needs you", (state.notifications.size + state.suggestions.size + liveRequestCount).toString(), Modifier.weight(1f))
                    MetricTile("Topics", state.topics.size.toString(), Modifier.weight(1f))
                    MetricTile("Calls", state.calls.size.toString(), Modifier.weight(1f))
                }
            }
        }
        item { SectionLabel("Live requests") }
        if (liveRequestCount == 0) {
            item { QuietCard("No live requests", "If a caller needs you while the assistant is on the phone, the request appears here.") }
        } else {
            state.approvalRequests.forEach { request ->
                item { TransferRequestCard(request, actions) }
            }
            state.answerRequests.forEach { request ->
                item { AnswerRequestCard(request, actions) }
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
        item { SectionLabel("Assistant notes") }
        val activeNotes = state.agentNotes.filter { it.status == "active" }
        if (activeNotes.isEmpty()) {
            item { QuietCard("No active notes", "Add a note when the assistant should know something for an upcoming call.") }
        } else {
            activeNotes.take(6).forEach { note ->
                item { AgentNoteCard(note, actions) }
            }
        }
        item { SectionLabel("Channels") }
        item {
            WorkCard {
                SettingsRow("Phone", "Forwarding active", Icons.Filled.SettingsPhone, actions.openForwarding)
                SettingsRow("Phone contacts", state.contactSync.summary, Icons.Filled.Person, actions.openPhoneContacts)
                SettingsRow("Calendar", "User-scoped connection", Icons.Filled.CalendarMonth) { actions.selectTab(Tab.Assistant) }
                Text("Email and documents will connect here after they become productized channels.", color = Muted, fontSize = 13.sp, lineHeight = 18.sp)
            }
        }
    }
}

@Composable
private fun TransferRequestCard(request: ApprovalRequest, actions: AppActions) {
    WorkCard {
        Text("Transfer request", color = Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Text(request.displayCaller, color = Ink, fontSize = 18.sp, lineHeight = 22.sp, fontWeight = FontWeight.Bold)
        Text(request.reason, color = Muted, fontSize = 14.sp, lineHeight = 19.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
        DetailLine("Urgency", request.urgency)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            PrimaryButton("Accept", Icons.AutoMirrored.Filled.Send, Modifier.weight(1f)) { actions.acceptTransfer(request.id) }
            SecondaryButton("Decline", Modifier.weight(1f)) { actions.declineTransfer(request.id) }
        }
    }
}

@Composable
private fun AnswerRequestCard(request: AnswerRequest, actions: AppActions) {
    var answer by remember(request.id) { mutableStateOf("") }
    WorkCard {
        Text("Caller question", color = Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Text(request.displayCaller, color = Ink, fontSize = 18.sp, lineHeight = 22.sp, fontWeight = FontWeight.Bold)
        Text(request.question, color = Ink, fontSize = 15.sp, lineHeight = 20.sp)
        if (request.reason.isNotBlank()) {
            Text(request.reason, color = Muted, fontSize = 13.sp, lineHeight = 18.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = answer,
            onValueChange = { answer = it },
            label = { Text("Reply for assistant to say") },
            minLines = 2,
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
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            PrimaryButton("Send", Icons.AutoMirrored.Filled.Send, Modifier.weight(1f)) { actions.sendLiveAnswer(request.id, answer) }
            SecondaryButton("Decline", Modifier.weight(1f)) { actions.declineLiveAnswer(request.id) }
        }
    }
}

@Composable
private fun AgentNoteCard(note: AgentNote, actions: AppActions) {
    WorkCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(note.displayTitle, color = Ink, fontSize = 16.sp, lineHeight = 20.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(note.scopeLabel, color = Muted, fontSize = 12.sp, lineHeight = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            SecondaryButton("Archive", Modifier.width(104.dp)) { actions.archiveAgentNote(note.id) }
        }
        Spacer(Modifier.height(6.dp))
        Text(note.text, color = Muted, fontSize = 14.sp, lineHeight = 19.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun SearchScreen(state: PhoneAgentUiState, actions: AppActions) {
    var query by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("All") }
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
                    CalmFilterChip(label = it, selected = it == category, onClick = { category = it })
                }
            }
        }
        item { SectionLabel("Best matches") }
        if ((category == "All" || category == "Topics") && topics.isNotEmpty()) {
            topics.take(4).forEach { item { TopicSearchRow(it, actions) } }
        }
        if ((category == "All" || category == "Calls") && calls.isNotEmpty()) {
            calls.take(4).forEach { item { CallRow(it, actions) } }
        }
        if (category == "People") {
            item { QuietCard("People search is coming", "Synced contacts are used for caller recognition now. Full people search will use caller memory and contact records together.") }
        }
        if (
            (category == "All" && topics.isEmpty() && calls.isEmpty()) ||
            (category == "Topics" && topics.isEmpty()) ||
            (category == "Calls" && calls.isEmpty())
        ) {
            item { QuietCard("No results yet", "Search becomes more useful as your assistant builds topic memory.") }
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
    var topic by remember { mutableStateOf("") }
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
                if (state.topics.isNotEmpty()) {
                    Text("Topic scope, optional", color = Ink, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Spacer(Modifier.height(6.dp))
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        NoteScopeChip("General", selected = topic.isBlank()) { topic = "" }
                        state.topics.take(8).forEach { candidate ->
                            NoteScopeChip(candidate.title, selected = topic == candidate.title) { topic = candidate.title }
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                }
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
                    actions.saveAgentNote(note, phone, topic)
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
private fun NoteScopeChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .height(32.dp)
            .clip(CircleShape)
            .clickable(onClick = onClick),
        shape = CircleShape,
        color = if (selected) Brand else Soft,
        border = BorderStroke(1.dp, if (selected) Brand else Line)
    ) {
        Box(Modifier.padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
            Text(
                label,
                color = if (selected) Color.White else Ink,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun ProfileSettingsScreen(state: PhoneAgentUiState, actions: AppActions) {
    var confirmLogout by remember { mutableStateOf(false) }
    DetailFrame(title = "Profile", state = state, actions = actions) {
        item {
            WorkCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(Modifier.size(54.dp), shape = CircleShape, color = Soft, border = BorderStroke(1.dp, Line)) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(state.user.initials.ifBlank { "PA" }, color = Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(state.user.displayName.ifBlank { "Phone Agent user" }, color = Ink, fontSize = 19.sp, lineHeight = 23.sp, fontWeight = FontWeight.Bold)
                        Text(state.user.phoneNumber.ifBlank { "Verified phone" }, color = Muted, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(assistantStatusSentence(state), color = Muted, fontSize = 13.sp)
                    }
                }
            }
        }
        item { SectionLabel("Account") }
        item {
            WorkCard {
                SettingsRow("Assistant", state.user.assistantName.ifBlank { "Assistant" }, Icons.Filled.Person) { actions.selectTab(Tab.Assistant) }
                SettingsRow("Forward calls", state.user.assistantNumberDisplay, Icons.Filled.SettingsPhone, actions.openForwarding)
                SettingsRow("Billing", state.billing.display, Icons.Filled.CreditCard, actions.openBilling)
            }
        }
        item { SectionLabel("Channels and trust") }
        item {
            WorkCard {
                SettingsRow("Calendar", "User-scoped connection", Icons.Filled.CalendarMonth) { actions.selectTab(Tab.Assistant) }
                SettingsRow("Phone contacts", state.contactSync.summary, Icons.Filled.Person, actions.openPhoneContacts)
                SettingsRow("Notifications", "Private by default", Icons.Filled.Notifications) { actions.selectTab(Tab.Assistant) }
                SettingsRow("Privacy", "Memory, consent, and sharing", Icons.Filled.Security) { actions.selectTab(Tab.Assistant) }
            }
        }
        item { SectionLabel("Support") }
        item {
            WorkCard {
                SettingsRow("Diagnostics", "Version ${BuildConfig.VERSION_NAME}", Icons.Filled.Settings) { actions.refresh() }
                Spacer(Modifier.height(8.dp))
                SecondaryButton("Log out", Modifier.fillMaxWidth()) {
                    confirmLogout = true
                }
            }
        }
    }

    if (confirmLogout) {
        AlertDialog(
            onDismissRequest = { confirmLogout = false },
            title = { Text("Log out?") },
            text = { Text("This signs you out on this phone and clears local cached app data. Your Phone Agent account and history stay in the cloud.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmLogout = false
                    actions.signOut()
                }) {
                    Text("Log out", color = Critical, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmLogout = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun PhoneContactsScreen(state: PhoneAgentUiState, actions: AppActions) {
    DetailFrame(title = "Phone contacts", state = state, actions = actions) {
        item {
            WorkCard {
                Text("Recognize people already on your phone", color = Ink, fontSize = 19.sp, lineHeight = 23.sp, fontWeight = FontWeight.Bold)
                Text(
                    "Sync names and phone numbers so your assistant can greet first-time callers from your address book without pretending it remembers them.",
                    color = Muted,
                    fontSize = 14.sp,
                    lineHeight = 20.sp
                )
            }
        }
        item { SectionLabel("Status") }
        item {
            WorkCard {
                DetailLine("Synced contacts", state.contactSync.summary)
                DetailLine("Phone numbers", if (state.contactSync.phoneNumberCount > 0) state.contactSync.phoneNumberCount.toString() else "None yet")
                DetailLine("Last sync", state.contactSync.lastSyncDisplay)
            }
        }
        if (state.contactPermissionDenied) {
            item {
                WorkCard {
                    Text("Contacts permission is off", color = Ink, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                    Text("Turn on Contacts access in Android settings, then return here to sync.", color = Muted, fontSize = 14.sp, lineHeight = 19.sp)
                    Spacer(Modifier.height(8.dp))
                    SecondaryButton("Open Android settings", Modifier.fillMaxWidth(), actions.openSystemSettings)
                }
            }
        }
        item {
            WorkCard {
                PrimaryButton(
                    if (state.contactSyncing) "Syncing..." else if (state.contactSync.syncedCount > 0) "Resync contacts" else "Sync phone contacts",
                    Icons.Filled.Person,
                    enabled = !state.contactSyncing,
                    onClick = actions.syncPhoneContacts
                )
                Spacer(Modifier.height(8.dp))
                if (state.contactSync.syncedCount > 0) {
                    SecondaryButton("Disconnect synced contacts", Modifier.fillMaxWidth(), actions.disconnectPhoneContacts)
                    Spacer(Modifier.height(8.dp))
                }
                Text("Permission is requested only when you tap sync.", color = Muted, fontSize = 13.sp, lineHeight = 18.sp)
            }
        }
        item { SectionLabel("Privacy") }
        item {
            QuietCard(
                "What syncs",
                "Display name, phone numbers, phone labels, device contact ID, and sync time."
            )
        }
        item {
            QuietCard(
                "What does not sync",
                "No emails, addresses, notes, photos, birthdays, contact groups, organizations, or conversation history."
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
            AssistantPresence(state, actions.openProfileSettings)
        }
        LazyColumn(
            Modifier.weight(1f),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            content = content
        )
    }
}
