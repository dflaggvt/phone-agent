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
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.NoteAdd
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
@Composable
internal fun PhoneAgentApp(state: PhoneAgentUiState, actions: AppActions) {
    BackHandler(
        enabled = when (state.screen) {
            Screen.Topics, Screen.Review, Screen.Search, Screen.Forwarding, Screen.Billing, Screen.ProfileSettings, Screen.PhoneContacts -> true
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
            Screen.Login -> LoginScreen(state, actions)
            Screen.CreateAccount -> CreateAccountScreen(state, actions)
            Screen.VerifyPhone -> VerifyPhoneScreen(state, actions)
            is Screen.CodeEntry -> CodeScreen(state, screen.verificationId, actions)
            Screen.AssistantName -> AssistantNameScreen(state, actions)
            Screen.Main -> MainShell(state, actions)
            Screen.Topics -> TopicsDetailScreen(state, actions)
            Screen.Review -> ReviewDetailScreen(state, actions)
            Screen.Search -> SearchDetailScreen(state, actions)
            Screen.Forwarding -> ForwardingScreen(state, actions)
            Screen.Billing -> BillingScreen(state, actions)
            Screen.ProfileSettings -> ProfileSettingsScreen(state, actions)
            Screen.PhoneContacts -> PhoneContactsScreen(state, actions)
            is Screen.TopicDetail -> TopicDetailScreen(state, screen.topicId, actions)
            is Screen.CallDetail -> CallDetailScreen(state, screen.providerCallId, actions)
            is Screen.AddNote -> AddNoteScreen(state, screen.targetPhoneNumber, actions)
        }
        if (
            state.loading &&
            state.screen !is Screen.Startup &&
            state.screen !is Screen.Login &&
            state.screen !is Screen.CreateAccount &&
            state.screen !is Screen.VerifyPhone &&
            state.screen !is Screen.CodeEntry &&
            state.screen !is Screen.AssistantName
        ) {
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
    Column(Modifier.fillMaxSize()) {
        TopAppChrome(state, actions)
        AnimatedContent(state.selectedTab, modifier = Modifier.weight(1f), label = "tab") { tab ->
            Box(Modifier.fillMaxSize()) {
                when (tab) {
                    Tab.Home -> HomeScreen(state, actions)
                    Tab.Assistant -> AssistantScreen(state, actions)
                    Tab.Profile -> ProfileTabScreen(state, actions)
                }
            }
        }
        BottomNav(state.selectedTab, actions.selectTab)
    }
}

@Composable
private fun TopAppChrome(state: PhoneAgentUiState, actions: AppActions) {
    Box(
        Modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .height(64.dp)
            .padding(horizontal = 20.dp)
    ) {
        Row(
            modifier = Modifier.align(Alignment.CenterStart),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            ChromeAvatar(state, actions.openProfileSettings)
            ChromeIconButton(
                icon = Icons.Filled.Notifications,
                contentDescription = "Open review",
                showDot = state.notifications.isNotEmpty() || state.actionReviewCount() > 0,
                onClick = actions.openReview
            )
        }
        Text(
            "Call Held",
            color = Color.White,
            fontSize = 25.sp,
            lineHeight = 30.sp,
            fontWeight = FontWeight.ExtraBold,
            maxLines = 1,
            modifier = Modifier.align(Alignment.Center)
        )
        ChromeIconButton(
            icon = Icons.Filled.Search,
            contentDescription = "Search",
            onClick = actions.openSearch,
            modifier = Modifier.align(Alignment.CenterEnd)
        )
    }
}

@Composable
private fun ChromeAvatar(state: PhoneAgentUiState, onClick: () -> Unit) {
    val presence = presenceState(state)
    Surface(
        modifier = Modifier
            .size(42.dp)
            .clip(CircleShape)
            .clickable(onClick = onClick),
        shape = CircleShape,
        color = Color(0xFF8FA2B8),
        border = BorderStroke(2.dp, presence.color.copy(alpha = 0.82f))
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                state.user.initials.ifBlank { "PA" },
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun ChromeIconButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    modifier: Modifier = Modifier,
    showDot: Boolean = false,
    onClick: () -> Unit
) {
    Box(modifier.size(42.dp), contentAlignment = Alignment.Center) {
        IconButton(onClick = onClick, modifier = Modifier.fillMaxSize()) {
            Icon(icon, contentDescription = contentDescription, tint = Color.White.copy(alpha = 0.86f), modifier = Modifier.size(24.dp))
        }
        if (showDot) {
            Surface(
                modifier = Modifier
                    .size(8.dp)
                    .align(Alignment.TopEnd),
                shape = CircleShape,
                color = Critical
            ) {}
        }
    }
}

@Composable
private fun Header(
    title: String,
    state: PhoneAgentUiState,
    onRefresh: () -> Unit,
    onPresenceClick: () -> Unit = {},
    showRefresh: Boolean = true,
    showPresence: Boolean = true,
    onSearchClick: (() -> Unit)? = null
) {
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
        if (onSearchClick != null) {
            IconButton(onClick = onSearchClick) {
                Icon(Icons.Filled.Search, contentDescription = "Search", tint = Color.White.copy(alpha = 0.86f))
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
        state.actionReviewCount() > 0 -> PresenceState("Needs you", Critical)
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
            .navigationBarsPadding(),
        color = TwilightBottom.copy(alpha = 0.98f),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.10f)),
        shadowElevation = 10.dp
    ) {
        Row(
            Modifier
                .height(68.dp)
                .padding(horizontal = 16.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Tab.entries.forEach { tab ->
                val active = tab == selected
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(12.dp))
                        .clickable { onSelect(tab) },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Surface(
                        modifier = Modifier.size(width = 24.dp, height = 2.dp),
                        shape = CircleShape,
                        color = if (active) Color.White else Color.Transparent
                    ) {}
                    Spacer(Modifier.height(6.dp))
                    Icon(tab.icon, contentDescription = tab.label, tint = if (active) Color.White else Color.White.copy(alpha = 0.58f), modifier = Modifier.size(22.dp))
                    Spacer(Modifier.height(2.dp))
                    Text(tab.label, color = if (active) Color.White else Color.White.copy(alpha = 0.58f), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun LoginScreen(state: PhoneAgentUiState, actions: AppActions) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showEmailForm by remember { mutableStateOf(false) }
    AuthProviderScreen(
        state = state,
        headline = "Log in to your account",
        googleLabel = if (state.loading) "Opening Google" else "Sign in with Google",
        emailLabel = "Sign in with Email",
        switchLead = "Need an account?",
        switchAction = "Sign up",
        onClose = actions.openCreateAccount,
        onGoogle = { actions.startGoogleAuth(AuthFlow.Login) },
        onEmail = { showEmailForm = true },
        onSwitch = actions.openCreateAccount,
        emailForm = if (showEmailForm) {
            {
                AuthEmailPasswordFields(
                    email = email,
                    password = password,
                    onEmailChange = { email = it },
                    onPasswordChange = { password = it }
                )
                Spacer(Modifier.height(10.dp))
                PrimaryButton(
                    if (state.loading) "Signing in" else "Sign in with Email",
                    Icons.Filled.Email,
                    enabled = !state.loading,
                    onClick = { actions.startEmailPasswordAuth(AuthFlow.Login, email, password) }
                )
                Spacer(Modifier.height(6.dp))
                SecondaryButton("Send password reset", onClick = { actions.sendPasswordReset(email) })
            }
        } else {
            null
        }
    )
}

@Composable
private fun CreateAccountScreen(state: PhoneAgentUiState, actions: AppActions) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showEmailForm by remember { mutableStateOf(false) }
    AuthProviderScreen(
        state = state,
        headline = "Create an account",
        googleLabel = if (state.loading) "Opening Google" else "Continue with Google",
        emailLabel = "Continue with Email",
        switchLead = "Have an account?",
        switchAction = "Log in",
        onClose = null,
        onGoogle = { actions.startGoogleAuth(AuthFlow.CreateAccount) },
        onEmail = { showEmailForm = true },
        onSwitch = actions.openLogin,
        emailForm = if (showEmailForm) {
            {
                AuthEmailPasswordFields(
                    email = email,
                    password = password,
                    onEmailChange = { email = it },
                    onPasswordChange = { password = it }
                )
                Text(
                    "Use at least 8 characters.",
                    color = Muted,
                    fontSize = 12.sp,
                    lineHeight = 16.sp,
                    modifier = Modifier.padding(top = 4.dp)
                )
                Spacer(Modifier.height(10.dp))
                PrimaryButton(
                    if (state.loading) "Creating" else "Create account",
                    Icons.Filled.Email,
                    enabled = !state.loading,
                    onClick = { actions.startEmailPasswordAuth(AuthFlow.CreateAccount, email, password) }
                )
            }
        } else {
            null
        }
    )
}

@Composable
private fun AuthEmailPasswordFields(
    email: String,
    password: String,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit
) {
    OutlinedTextField(
        value = email,
        onValueChange = onEmailChange,
        label = { Text("Email address") },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = Ink,
            unfocusedTextColor = Ink,
            focusedContainerColor = Card,
            unfocusedContainerColor = Card,
            focusedBorderColor = Brand,
            unfocusedBorderColor = Line,
            focusedLabelColor = Muted,
            unfocusedLabelColor = Muted,
            cursorColor = Brand
        )
    )
    Spacer(Modifier.height(8.dp))
    OutlinedTextField(
        value = password,
        onValueChange = onPasswordChange,
        label = { Text("Password") },
        singleLine = true,
        visualTransformation = PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = Ink,
            unfocusedTextColor = Ink,
            focusedContainerColor = Card,
            unfocusedContainerColor = Card,
            focusedBorderColor = Brand,
            unfocusedBorderColor = Line,
            focusedLabelColor = Muted,
            unfocusedLabelColor = Muted,
            cursorColor = Brand
        )
    )
}

@Composable
private fun AuthProviderScreen(
    state: PhoneAgentUiState,
    headline: String,
    googleLabel: String,
    emailLabel: String,
    switchLead: String,
    switchAction: String,
    onClose: (() -> Unit)?,
    onGoogle: () -> Unit,
    onEmail: () -> Unit,
    onSwitch: () -> Unit,
    emailForm: (@Composable ColumnScope.() -> Unit)? = null
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding(),
        contentPadding = PaddingValues(start = 24.dp, end = 24.dp, top = 18.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(0.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            Box(Modifier.fillMaxWidth().height(52.dp)) {
                if (onClose != null) {
                    AuthCloseButton(onClose)
                }
            }
        }
        item { Spacer(Modifier.height(if (emailForm == null) 72.dp else 30.dp)) }
        item { CallHeldAuthWordmark() }
        item { Spacer(Modifier.height(if (emailForm == null) 48.dp else 32.dp)) }
        item {
            Text(
                headline,
                color = Color.White.copy(alpha = 0.92f),
                fontSize = 26.sp,
                lineHeight = 32.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                maxLines = 2,
                modifier = Modifier.fillMaxWidth()
            )
        }
        state.error?.let {
            item {
                Spacer(Modifier.height(16.dp))
                AuthErrorBanner(it)
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
        item {
            AuthProviderRow(
                label = emailLabel,
                enabled = !state.loading,
                onClick = onEmail
            ) {
                Icon(Icons.Filled.Email, contentDescription = null, tint = Ink, modifier = Modifier.size(26.dp))
            }
        }
        item { Spacer(Modifier.height(10.dp)) }
        item {
            AuthProviderRow(
                label = googleLabel,
                enabled = !state.loading,
                onClick = onGoogle
            ) {
                Text("G", color = Color.Black, fontSize = 30.sp, lineHeight = 30.sp, fontWeight = FontWeight.ExtraBold)
            }
        }
        if (emailForm != null) {
            item {
                Spacer(Modifier.height(14.dp))
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = Color.White.copy(alpha = 0.94f),
                    shape = RoundedCornerShape(26.dp),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.32f)),
                    shadowElevation = 8.dp
                ) {
                    Column(Modifier.padding(16.dp), content = emailForm)
                }
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
        item { AuthLegalCopy() }
        item { Spacer(Modifier.height(if (emailForm == null) 52.dp else 34.dp)) }
        item { AuthSwitchRow(switchLead, switchAction, onSwitch) }
    }
}

@Composable
private fun AuthCloseButton(onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .size(52.dp)
            .clip(CircleShape)
            .clickable(onClick = onClick),
        shape = CircleShape,
        color = TwilightBottom.copy(alpha = 0.42f),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Close, contentDescription = "Close", tint = Color.White, modifier = Modifier.size(30.dp))
        }
    }
}

@Composable
private fun CallHeldAuthWordmark() {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "Call",
                color = Color.White,
                fontSize = 43.sp,
                lineHeight = 48.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1
            )
            Text(
                " Held",
                color = SuccessLight,
                fontSize = 43.sp,
                lineHeight = 48.sp,
                fontWeight = FontWeight.ExtraBold,
                maxLines = 1
            )
        }
        Spacer(Modifier.height(4.dp))
        Text(
            "ANSWERS WHEN YOU CAN'T",
            color = Color.White.copy(alpha = 0.62f),
            fontSize = 10.sp,
            lineHeight = 13.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.4.sp,
            maxLines = 1
        )
    }
}

@Composable
private fun AuthProviderRow(
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
    leading: @Composable () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .height(48.dp)
            .clip(CircleShape)
            .clickable(enabled = enabled, onClick = onClick),
        shape = CircleShape,
        color = Color.White.copy(alpha = if (enabled) 0.98f else 0.62f),
        shadowElevation = 2.dp
    ) {
        Row(
            Modifier.padding(horizontal = 22.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(Modifier.size(32.dp), contentAlignment = Alignment.Center) { leading() }
            Spacer(Modifier.width(16.dp))
            Text(
                label,
                color = Ink,
                fontSize = 20.sp,
                lineHeight = 23.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun AuthLegalCopy() {
    val uriHandler = LocalUriHandler.current
    val baseStyle = TextStyle(
        color = Color.White.copy(alpha = 0.92f),
        fontSize = 15.sp,
        lineHeight = 21.sp,
        textAlign = TextAlign.Start
    )
    val linkStyle = baseStyle.copy(
        color = Color.White,
        fontWeight = FontWeight.Medium,
        textDecoration = TextDecoration.Underline
    )
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("By continuing, you agree to Call Held's ", style = baseStyle)
            Text(
                "Terms",
                style = linkStyle,
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .clickable { uriHandler.openUri("https://callheld.com/terms") }
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("and ", style = baseStyle)
            Text(
                "Privacy Policy",
                style = linkStyle,
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .clickable { uriHandler.openUri("https://callheld.com/privacy") }
            )
            Text(".", style = baseStyle)
        }
    }
}

@Composable
private fun AuthSwitchRow(lead: String, action: String, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(48.dp)
            .clip(CircleShape)
            .clickable(onClick = onClick),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(lead, color = Color.White, fontSize = 21.sp, lineHeight = 26.sp, fontWeight = FontWeight.ExtraBold)
        Spacer(Modifier.width(6.dp))
        Text(
            action,
            color = Color.White,
            fontSize = 21.sp,
            lineHeight = 26.sp,
            fontWeight = FontWeight.ExtraBold,
            textDecoration = TextDecoration.Underline
        )
    }
}

@Composable
private fun AuthErrorBanner(message: String) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color.White.copy(alpha = 0.94f),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.28f))
    ) {
        Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
            Text("Account issue", color = Ink, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            Text(message, color = Critical, fontSize = 14.sp, lineHeight = 19.sp)
        }
    }
}

@Composable
private fun VerifyPhoneScreen(state: PhoneAgentUiState, actions: AppActions) {
    var phone by remember { mutableStateOf("") }
    OnboardingFrame(
        headerTitle = "Setup",
        title = "Verify protected number.",
        subtitle = "Finish the phone setup for this account.",
        state = state
    ) {
        Text(
            "This is the mobile number your assistant protects. We use it to route calls and recover your account.",
            color = Muted,
            fontSize = 15.sp,
            lineHeight = 20.sp
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(phone, { phone = it }, label = { Text("Mobile number") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(12.dp))
        PrimaryButton(if (state.loading) "Sending code" else "Send code", Icons.AutoMirrored.Filled.Send, enabled = !state.loading) { actions.startPhoneVerification(phone) }
        Spacer(Modifier.height(8.dp))
        SecondaryButton("Use another account", onClick = actions.signOut)
    }
}

@Composable
private fun CodeScreen(state: PhoneAgentUiState, verificationId: String, actions: AppActions) {
    var code by remember { mutableStateOf("") }
    OnboardingFrame(
        headerTitle = "Setup",
        title = "Enter your verification code.",
        subtitle = "Use the code sent to your phone to confirm the number your assistant protects.",
        state = state
    ) {
        OutlinedTextField(code, { code = it }, label = { Text("Verification code") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(12.dp))
        PrimaryButton(if (state.loading) "Verifying" else "Verify", Icons.AutoMirrored.Filled.Send, enabled = !state.loading) { actions.verifyPhoneCode(verificationId, code) }
        Spacer(Modifier.height(8.dp))
        SecondaryButton("Use another account", onClick = actions.signOut)
    }
}

@Composable
private fun AssistantNameScreen(state: PhoneAgentUiState, actions: AppActions) {
    var name by remember { mutableStateOf(state.user.assistantName.ifBlank { "Assistant" }) }
    OnboardingFrame(
        headerTitle = "Setup",
        title = "Name your assistant.",
        subtitle = "Choose the name callers will hear.",
        state = state
    ) {
        Text("Callers will hear this name. You can change it later.", color = Muted, fontSize = 15.sp, lineHeight = 20.sp)
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(name, { name = it }, label = { Text("Assistant name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(12.dp))
        PrimaryButton(if (state.loading) "Saving" else "Continue", Icons.AutoMirrored.Filled.Send, enabled = !state.loading) { actions.saveAssistantName(name) }
        Spacer(Modifier.height(8.dp))
        SecondaryButton("Use another account", onClick = actions.signOut)
    }
}

@Composable
private fun OnboardingFrame(
    headerTitle: String,
    title: String,
    subtitle: String,
    state: PhoneAgentUiState,
    content: @Composable ColumnScope.() -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().statusBarsPadding(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item { Header(headerTitle, state, {}, showRefresh = false, showPresence = false) }
        item {
            Text(title, color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold, lineHeight = 29.sp)
            Text(subtitle, color = Color.White.copy(alpha = 0.84f), fontSize = 15.sp, lineHeight = 21.sp)
        }
        state.error?.let { item { ErrorCard(it) } }
        item { WorkCard { content() } }
    }
}

@Composable
private fun HomeScreen(state: PhoneAgentUiState, actions: AppActions) {
    val reviewCount = state.actionReviewCount()
    ScreenList {
        item {
            SectionHeader("Tracked topics", "See all", actions.openTopics)
        }
        item {
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (state.topics.isEmpty()) {
                    HomeTopicCard(null, actions)
                } else {
                    state.topics.take(8).forEach { HomeTopicCard(it, actions) }
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
        if (reviewCount > 0) {
            item { AssistantNeedsReviewSignal(reviewCount, actions) }
        }
    }
}

@Composable
private fun AssistantNeedsReviewSignal(count: Int, actions: AppActions) {
    WorkCard {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(Modifier.weight(1f)) {
                Text("Assistant needs review", color = Ink, fontSize = 16.sp, lineHeight = 20.sp, fontWeight = FontWeight.Bold)
                Text("$count ${if (count == 1) "item" else "items"} waiting", color = Muted, fontSize = 13.sp, lineHeight = 17.sp)
            }
            SecondaryButton("Open", Modifier.width(96.dp)) { actions.selectTab(Tab.Assistant) }
        }
    }
}

@Composable
private fun SectionHeader(value: String, actionLabel: String? = null, onAction: () -> Unit = {}) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.weight(1f)) {
            SectionLabel(value)
        }
        if (actionLabel != null) {
            TextButton(onClick = onAction, modifier = Modifier.height(34.dp)) {
                Text(actionLabel, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun TopicsDetailScreen(state: PhoneAgentUiState, actions: AppActions) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var showCreateForm by remember { mutableStateOf(false) }
    DetailFrame(title = "Topics", state = state, actions = actions) {
        topicListItems(
            state = state,
            actions = actions,
            title = title,
            onTitleChange = { title = it },
            description = description,
            onDescriptionChange = { description = it },
            showCreateForm = showCreateForm,
            onShowCreateForm = { showCreateForm = true }
        )
    }
}

@Composable
private fun ReviewDetailScreen(state: PhoneAgentUiState, actions: AppActions) {
    var filter by remember { mutableStateOf("All") }
    DetailFrame(title = "Needs review", state = state, actions = actions) {
        reviewItems(state, actions, filter, { filter = it })
    }
}

private fun LazyListScope.topicListItems(
    state: PhoneAgentUiState,
    actions: AppActions,
    title: String,
    onTitleChange: (String) -> Unit,
    description: String,
    onDescriptionChange: (String) -> Unit,
    showCreateForm: Boolean,
    onShowCreateForm: () -> Unit
) {
    item {
        Text("Topics your assistant is tracking.", color = Color.White.copy(alpha = 0.86f), fontSize = 15.sp, lineHeight = 20.sp)
    }
    item { SectionLabel("Active topics") }
    if (state.topics.isEmpty()) {
        item { EmptyTopicListCard() }
    } else {
        state.topics.forEach { item { TopicListCard(it, actions) } }
    }
    if (state.topics.isEmpty() || showCreateForm) {
        item { SectionLabel("Create") }
        item {
            WorkCard {
                Text("Create topic", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Ink)
                Text("Start a topic for a project, family situation, appointment, trip, vendor, or decision.", color = Muted, fontSize = 14.sp, lineHeight = 19.sp)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(title, onTitleChange, label = { Text("Topic title") }, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(description, onDescriptionChange, label = { Text("Description, optional") }, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(10.dp))
                PrimaryButton("Create topic", Icons.Filled.Add) { actions.createTopic(title, description) }
            }
        }
    } else {
        item {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .clickable(onClick = onShowCreateForm),
                shape = RoundedCornerShape(16.dp),
                color = Color.White.copy(alpha = 0.08f),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.58f))
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text("Create topic", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

private fun LazyListScope.reviewItems(
    state: PhoneAgentUiState,
    actions: AppActions,
    filter: String,
    onFilterChange: (String) -> Unit
) {
    val liveRequestCount = state.approvalRequests.size + state.answerRequests.size
    item {
        Text("Review is where calls, topic suggestions, and live requests get cleaned up before they become memory.", color = Color.White.copy(alpha = 0.86f), fontSize = 15.sp, lineHeight = 20.sp)
    }
    state.error?.let { item { ErrorCard(it) } }
    item {
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("All", "Topics", "Calls", "Live", "Updates").forEach { label ->
                CalmFilterChip(label = label, selected = filter == label, onClick = { onFilterChange(label) })
            }
        }
    }
    if ((filter == "All" || filter == "Topics") && state.suggestions.isNotEmpty()) {
        item { SectionLabel("Topic suggestions") }
        state.suggestions.forEach { item { SuggestionCard(it, actions, enabled = !state.loading) } }
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

@Composable
private fun AssistantScreen(state: PhoneAgentUiState, actions: AppActions) {
    val assistantNumber = state.user.assistantNumber.ifBlank { BuildConfig.PHONE_AGENT_NUMBER }
    val reviewCount = state.actionReviewCount()
    val visibleSuggestions = state.suggestions.take(6)
    val hiddenSuggestionCount = state.suggestions.size - visibleSuggestions.size
    val activeNotes = state.agentNotes.filter { it.status == "active" }
    ScreenList {
        item {
            WorkCard {
                Text(
                    if (state.activeCall == null) "${state.user.assistantName.ifBlank { "Assistant" }} is standing by" else "On a call now",
                    fontSize = 19.sp,
                    lineHeight = 23.sp,
                    fontWeight = FontWeight.Bold,
                    color = Ink
                )
                Text(
                    state.activeCall?.displayCaller ?: "Monitoring calls, holding context, and bringing you in only when needed.",
                    color = Muted,
                    fontSize = 14.sp,
                    lineHeight = 19.sp
                )
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    MetricTile("Review", reviewCount.toString(), Modifier.weight(1f))
                    MetricTile("Notes", activeNotes.size.toString(), Modifier.weight(1f))
                    MetricTile("Activity", state.notifications.size.toString(), Modifier.weight(1f))
                }
            }
        }
        state.error?.let { item { ErrorCard(it) } }
        item { SectionHeader("Needs review", if (reviewCount > 0) "All" else null, actions.openReview) }
        if (reviewCount == 0) {
            item { QuietCard("Nothing waiting", "If a caller needs an answer, a transfer needs approval, or a topic needs cleanup, it appears here.") }
        } else {
            state.approvalRequests.forEach { request ->
                item { TransferRequestCard(request, actions) }
            }
            state.answerRequests.forEach { request ->
                item { AnswerRequestCard(request, actions) }
            }
            visibleSuggestions.forEach { suggestion ->
                item { SuggestionCard(suggestion, actions, enabled = !state.loading) }
            }
            if (hiddenSuggestionCount > 0) {
                item { MoreReviewItemsRow(hiddenSuggestionCount, actions) }
            }
        }
        item { SectionLabel("Prepared notes") }
        if (activeNotes.isEmpty()) {
            item { QuietCard("No active notes", "Add a note when the assistant should know something for an upcoming call.") }
        } else {
            activeNotes.take(3).forEach { note ->
                item { AgentNoteCard(note, actions) }
            }
        }
        item { SectionLabel("Recent activity") }
        if (state.notifications.isEmpty()) {
            item { QuietCard("No recent assistant activity", "Call summaries, live requests, and completed assistant actions will appear here.") }
        } else {
            state.notifications.take(4).forEach { notification ->
                item { AssistantActivityRow(notification) }
            }
        }
        item { SectionLabel("Actions") }
        item {
            WorkCard {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ActionTile("Add note", "For an upcoming call", Icons.AutoMirrored.Filled.NoteAdd, Modifier.weight(1f)) { actions.openAddNote("") }
                    ActionTile("Test call", state.user.assistantNumberDisplay, Icons.Filled.Call, Modifier.weight(1f)) { actions.callNumber(assistantNumber) }
                }
            }
        }
    }
}

@Composable
private fun MoreReviewItemsRow(count: Int, actions: AppActions) {
    WorkCard {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(Modifier.weight(1f)) {
                Text("$count more ${if (count == 1) "item" else "items"}", color = Ink, fontSize = 15.sp, lineHeight = 19.sp, fontWeight = FontWeight.Bold)
                Text("Open the full review queue to finish the rest.", color = Muted, fontSize = 13.sp, lineHeight = 17.sp)
            }
            SecondaryButton("Review", Modifier.width(104.dp), actions.openReview)
        }
    }
}

private fun PhoneAgentUiState.actionReviewCount(): Int =
    approvalRequests.size + answerRequests.size + suggestions.size

@Composable
private fun AssistantActivityRow(notification: AppNotification) {
    WorkCard {
        Text(notification.title, color = Ink, fontSize = 15.sp, lineHeight = 19.sp, fontWeight = FontWeight.Bold)
        Text(notification.body, color = Muted, fontSize = 13.sp, lineHeight = 18.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
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
        Text(
            "Reply while the caller is waiting. Live answers expire after about 90 seconds.",
            color = Muted,
            fontSize = 12.sp,
            lineHeight = 17.sp
        )
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
private fun SearchDetailScreen(state: PhoneAgentUiState, actions: AppActions) {
    var query by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("All") }
    DetailFrame(title = "Search", state = state, actions = actions) {
        searchItems(state, actions, query, { query = it }, category, { category = it })
    }
}

private fun LazyListScope.searchItems(
    state: PhoneAgentUiState,
    actions: AppActions,
    query: String,
    onQueryChange: (String) -> Unit,
    category: String,
    onCategoryChange: (String) -> Unit
) {
    val topics = state.topics.filter { query.isBlank() || it.title.contains(query, true) || it.description.contains(query, true) }
    val calls = state.calls.filter { query.isBlank() || it.displayCaller.contains(query, true) || it.phone.contains(query, true) }
    item {
        CalmTextField(
            value = query,
            onValueChange = onQueryChange,
            label = "Search people, topics, decisions...",
            modifier = Modifier.fillMaxWidth()
        )
    }
    item {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("All", "Topics", "People", "Calls").forEach {
                CalmFilterChip(label = it, selected = it == category, onClick = { onCategoryChange(it) })
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
    var confirmCancel by remember { mutableStateOf(false) }
    DetailFrame(title = "Billing", state = state, actions = actions) {
        item {
            WorkCard {
                Text("Choose your spending limit", color = Ink, fontSize = 19.sp, lineHeight = 23.sp, fontWeight = FontWeight.Bold)
                Text("Call Held Personal is $19/month and includes your assistant number and 50 assistant minutes. You can change or pause this anytime.", color = Muted, fontSize = 14.sp, lineHeight = 19.sp)
                Spacer(Modifier.height(8.dp))
                Text("Current status: ${state.billing.display}", color = Ink, fontWeight = FontWeight.Bold)
                Text("Monthly cap: ${state.billing.capDisplay}", color = Muted, fontSize = 14.sp)
            }
        }
        item {
            WorkCard {
                val primaryLabel = if (state.billing.status == "active") "Manage billing" else "Add card"
                PrimaryButton(primaryLabel, Icons.Filled.CreditCard, onClick = actions.openCheckout)
                Spacer(Modifier.height(6.dp))
                SecondaryButton("Check billing status", Modifier.fillMaxWidth(), actions.activateBilling)
            }
        }
        if (state.billing.status == "active" || state.billing.status == "past_due" || state.billing.status == "cap_reached") {
            item {
                WorkCard {
                    Text("Subscription", color = Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Text("Canceling stops new paid assistant work and keeps your account history available.", color = Muted, fontSize = 14.sp, lineHeight = 19.sp)
                    Spacer(Modifier.height(8.dp))
                    SecondaryButton("Cancel subscription", Modifier.fillMaxWidth()) { confirmCancel = true }
                }
            }
        }
    }
    CancelSubscriptionDialog(confirmCancel, { confirmCancel = false }, actions.cancelSubscription)
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
                if (topic.isTimelineHydrating) {
                    item { QuietCard("Timeline syncing", "Attached communications will appear here after the latest sync.") }
                } else {
                    item { QuietCard("No communications yet", "Calls, notes, calendar events, and documents will appear here when attached.") }
                }
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
    var confirmRemove by remember { mutableStateOf(false) }
    DetailFrame(title = "Profile", state = state, actions = actions) {
        profileItems(state, actions, { confirmLogout = true }, { confirmRemove = true })
    }
    LogoutDialog(confirmLogout, { confirmLogout = false }, actions.signOut)
    RemoveAccountDialog(confirmRemove, { confirmRemove = false }, actions.removeAccount)
}

@Composable
private fun ProfileTabScreen(state: PhoneAgentUiState, actions: AppActions) {
    var confirmLogout by remember { mutableStateOf(false) }
    var confirmRemove by remember { mutableStateOf(false) }
    ScreenList {
        profileItems(state, actions, { confirmLogout = true }, { confirmRemove = true })
    }
    LogoutDialog(confirmLogout, { confirmLogout = false }, actions.signOut)
    RemoveAccountDialog(confirmRemove, { confirmRemove = false }, actions.removeAccount)
}

private fun LazyListScope.profileItems(
    state: PhoneAgentUiState,
    actions: AppActions,
    onLogoutClick: () -> Unit,
    onRemoveAccountClick: () -> Unit
) {
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
                    Text(state.user.displayName.ifBlank { "Call Held user" }, color = Ink, fontSize = 19.sp, lineHeight = 23.sp, fontWeight = FontWeight.Bold)
                    Text(state.user.phoneNumber.ifBlank { "Verified phone" }, color = Muted, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(assistantStatusSentence(state), color = Muted, fontSize = 13.sp)
                }
            }
        }
    }
    item { SectionLabel("Account") }
    item {
        WorkCard {
            SettingsRow("Assistant activity", state.user.assistantName.ifBlank { "Assistant" }, Icons.Filled.Person) { actions.selectTab(Tab.Assistant) }
            SettingsRow("Forward calls", state.user.assistantNumberDisplay, Icons.Filled.SettingsPhone, actions.openForwarding)
            SettingsRow("Billing", state.billing.display, Icons.Filled.CreditCard, actions.openBilling)
        }
    }
    item { SectionLabel("Contacts") }
    item {
        WorkCard {
            SettingsRow("Phone contacts", state.contactSync.summary, Icons.Filled.Person, actions.openPhoneContacts)
        }
    }
    item { SectionLabel("Support") }
    item {
        WorkCard {
            SecondaryButton("Log out", Modifier.fillMaxWidth(), onLogoutClick)
            Spacer(Modifier.height(8.dp))
            SecondaryButton("Remove account", Modifier.fillMaxWidth(), onRemoveAccountClick)
        }
    }
}

@Composable
private fun CancelSubscriptionDialog(show: Boolean, onDismiss: () -> Unit, onConfirm: () -> Unit) {
    if (show) {
        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text("Cancel subscription?") },
            text = { Text("This stops new paid assistant work immediately. Your account, history, and settings remain available.") },
            confirmButton = {
                TextButton(onClick = {
                    onDismiss()
                    onConfirm()
                }) {
                    Text("Cancel subscription", color = Critical, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = onDismiss) {
                    Text("Keep subscription")
                }
            }
        )
    }
}

@Composable
private fun LogoutDialog(show: Boolean, onDismiss: () -> Unit, onConfirm: () -> Unit) {
    if (show) {
        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text("Log out?") },
            text = { Text("This signs you out on this phone and clears local cached app data. Your Call Held account and history stay in the cloud.") },
            confirmButton = {
                TextButton(onClick = {
                    onDismiss()
                    onConfirm()
                }) {
                    Text("Log out", color = Critical, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = onDismiss) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun RemoveAccountDialog(show: Boolean, onDismiss: () -> Unit, onConfirm: () -> Unit) {
    if (show) {
        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text("Remove account?") },
            text = { Text("This cancels paid access, disables this phone's notifications, removes your sign-in, and clears local app data. This cannot be undone in the app.") },
            confirmButton = {
                TextButton(onClick = {
                    onDismiss()
                    onConfirm()
                }) {
                    Text("Remove account", color = Critical, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = onDismiss) {
                    Text("Keep account")
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
