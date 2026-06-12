package com.phoneagent.app

import androidx.activity.ComponentActivity
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.NoCredentialException
import com.google.firebase.FirebaseException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.FirebaseAuthWeakPasswordException
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import com.phoneagent.app.data.AssistantProfileUpdate
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

internal class PhoneOnboardingCoordinator(
    private val activity: ComponentActivity,
    private val scope: CoroutineScope,
    private val firebaseAuth: FirebaseAuth,
    private val onboardingViewModel: OnboardingViewModel,
    private val getState: () -> PhoneAgentUiState,
    private val setState: (PhoneAgentUiState) -> Unit,
    private val tokenProvider: suspend () -> String,
    private val clearLocalCache: suspend () -> Unit,
    private val registerPushToken: suspend () -> Unit,
    private val refreshData: suspend (forceStatus: Boolean, keepScreen: Boolean) -> Unit,
    private val readableError: (Throwable) -> String,
    private val toast: (String) -> Unit
) {
    private val credentialManager = CredentialManager.create(activity)

    fun startGoogleAuth(flow: AuthFlow) {
        scope.launch {
            try {
                setState(getState().copy(loading = true, status = authLoadingStatus(flow), error = null))
                val idToken = runCatching { googleIdToken(filterByAuthorizedAccounts = flow == AuthFlow.Login) }
                    .recoverCatching { error ->
                        if (flow == AuthFlow.Login && error is NoCredentialException) {
                            googleIdToken(filterByAuthorizedAccounts = false)
                        } else {
                            throw error
                        }
                    }
                    .getOrThrow()
                val credential = GoogleAuthProvider.getCredential(idToken, null)
                val result = firebaseAuth.signInWithCredential(credential).await()
                if (rejectUnexpectedAccountState(flow, result.additionalUserInfo?.isNewUser == true)) {
                    return@launch
                }
                completeAuthenticatedSession()
            } catch (error: GetCredentialCancellationException) {
                setState(getState().copy(loading = false, status = "Setup", error = null))
            } catch (error: Exception) {
                setState(getState().copy(loading = false, status = "Setup", error = readableError(error)))
                toast("Could not sign in with Google.")
            }
        }
    }

    fun startEmailPasswordAuth(flow: AuthFlow, email: String, password: String) {
        val normalizedEmail = email.trim()
        authFormError(normalizedEmail, password)?.let { message ->
            setState(getState().copy(loading = false, status = "Setup", error = message))
            toast(message)
            return
        }
        scope.launch {
            try {
                setState(getState().copy(loading = true, status = authLoadingStatus(flow), error = null))
                when (flow) {
                    AuthFlow.Login -> firebaseAuth.signInWithEmailAndPassword(normalizedEmail, password).await()
                    AuthFlow.CreateAccount -> firebaseAuth.createUserWithEmailAndPassword(normalizedEmail, password).await()
                }
                completeAuthenticatedSession()
            } catch (error: Exception) {
                val message = emailPasswordAuthError(flow, error)
                setState(getState().copy(loading = false, status = "Setup", error = message))
                toast(message)
            }
        }
    }

    fun sendPasswordReset(email: String) {
        val normalizedEmail = email.trim()
        if (!isValidAuthEmail(normalizedEmail)) {
            val message = "Enter the email address for your account."
            setState(getState().copy(loading = false, status = "Setup", error = message))
            toast(message)
            return
        }
        scope.launch {
            try {
                setState(getState().copy(loading = true, status = "Sending", error = null))
                firebaseAuth.sendPasswordResetEmail(normalizedEmail).await()
                setState(getState().copy(loading = false, status = "Setup", error = null))
                toast("If an account exists, a reset email has been sent.")
            } catch (error: Exception) {
                setState(getState().copy(loading = false, status = "Setup", error = null))
                toast("If an account exists, a reset email has been sent.")
            }
        }
    }

    fun startPhoneVerification(phoneNumber: String) {
        if (firebaseAuth.currentUser == null) {
            setState(
                PhoneAgentUiState(
                    screen = Screen.CreateAccount,
                    status = "Setup",
                    error = "Log in or create an account before verifying a protected number."
                )
            )
            return
        }
        val normalized = normalizePhone(phoneNumber)
        if (!isValidE164Phone(normalized)) {
            toast("Enter a valid mobile number.")
            return
        }
        setState(getState().copy(loading = true, status = "Sending", error = null))
        val options = PhoneAuthOptions.newBuilder(firebaseAuth)
            .setPhoneNumber(normalized)
            .setTimeout(60L, TimeUnit.SECONDS)
            .setActivity(activity)
            .setCallbacks(object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                    linkProtectedNumber(credential)
                }

                override fun onVerificationFailed(error: FirebaseException) {
                    setState(getState().copy(loading = false, status = "Setup", error = readableError(error)))
                    toast("Could not send code.")
                }

                override fun onCodeSent(verificationId: String, token: PhoneAuthProvider.ForceResendingToken) {
                    setState(
                        getState().copy(
                            loading = false,
                            status = "Verify",
                            screen = Screen.CodeEntry(verificationId),
                            error = null
                        )
                    )
                }
            })
            .build()
        runCatching { PhoneAuthProvider.verifyPhoneNumber(options) }
            .onFailure {
                setState(getState().copy(loading = false, status = "Setup", error = readableError(it)))
            }
    }

    fun verifyPhoneCode(verificationId: String, code: String) {
        if (code.trim().isEmpty()) {
            toast("Enter the verification code.")
            return
        }
        setState(getState().copy(loading = true, status = "Verifying"))
        linkProtectedNumber(PhoneAuthProvider.getCredential(verificationId, code.trim()))
    }

    fun saveAssistantName(name: String) {
        scope.launch {
            try {
                setState(getState().copy(loading = true, status = "Saving"))
                onboardingViewModel.updateAssistantProfile(
                    tokenProvider(),
                    AssistantProfileUpdate(
                        assistantName = name.trim().ifBlank { "Assistant" },
                        greetingStyle = "warm",
                        disclosureStyle = "standard",
                        warmth = 4,
                        brevity = 4,
                        proactivity = 3
                    )
                )
                setState(getState().copy(loading = false, screen = Screen.Main, selectedTab = Tab.Home))
                refreshData(true, false)
            } catch (error: Exception) {
                setState(getState().copy(loading = false, status = "Setup", error = readableError(error)))
            }
        }
    }

    private fun linkProtectedNumber(credential: PhoneAuthCredential) {
        val currentUser = firebaseAuth.currentUser
        if (currentUser == null) {
            setState(
                PhoneAgentUiState(
                    screen = Screen.CreateAccount,
                    status = "Setup",
                    error = "Log in or create an account before verifying a protected number."
                )
            )
            return
        }
        currentUser.linkWithCredential(credential).addOnCompleteListener { result ->
            if (!result.isSuccessful) {
                setState(
                    getState().copy(
                        loading = false,
                        status = "Setup",
                        error = protectedNumberVerificationError(result.exception)
                    )
                )
                return@addOnCompleteListener
            }
            scope.launch {
                try {
                    currentUser.idToken(forceRefresh = true)
                    completeAuthenticatedSession()
                } catch (error: Exception) {
                    setState(getState().copy(loading = false, status = "Setup", error = readableError(error)))
                }
            }
        }
    }

    fun clearCredentialState() {
        scope.launch {
            runCatching {
                credentialManager.clearCredentialState(ClearCredentialStateRequest())
            }
        }
    }

    private suspend fun googleIdToken(filterByAuthorizedAccounts: Boolean): String {
        val googleIdOption = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(filterByAuthorizedAccounts)
            .setServerClientId(activity.getString(R.string.default_web_client_id))
            .setAutoSelectEnabled(filterByAuthorizedAccounts)
            .build()
        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()
        val credential = credentialManager.getCredential(activity, request).credential
        if (credential !is CustomCredential || credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            error("Google did not return an ID token credential.")
        }
        return try {
            GoogleIdTokenCredential.createFrom(credential.data).idToken
        } catch (error: GoogleIdTokenParsingException) {
            throw IllegalStateException("Google sign-in returned an invalid token.", error)
        }
    }

    private suspend fun completeAuthenticatedSession() {
        clearLocalCache()
        registerPushToken()
        setState(getState().copy(loading = true, status = "Syncing", error = null))
        refreshData(true, false)
        val refreshed = getState()
        when {
            !refreshed.onboarding.phoneVerified -> setState(refreshed.copy(loading = false, status = "Setup", screen = Screen.VerifyPhone, error = null))
            !refreshed.onboarding.assistantProfileConfigured -> setState(refreshed.copy(loading = false, status = "Setup", screen = Screen.AssistantName, error = null))
        }
    }

    private suspend fun rejectUnexpectedAccountState(flow: AuthFlow, isNewUser: Boolean): Boolean {
        if (!shouldRejectFederatedAuthResult(flow, isNewUser)) return false
        when (flow) {
            AuthFlow.Login -> {
                runCatching { firebaseAuth.currentUser?.delete()?.await() }
                firebaseAuth.signOut()
                setState(
                    PhoneAgentUiState(
                        screen = Screen.Login,
                        status = "Setup",
                        error = "No account exists for that sign-in yet. Create an account to get started."
                    )
                )
            }
            AuthFlow.CreateAccount -> {
                firebaseAuth.signOut()
                setState(
                    PhoneAgentUiState(
                        screen = Screen.Login,
                        status = "Setup",
                        error = "That account already exists. Log in to continue."
                    )
                )
            }
        }
        return true
    }

}

internal fun shouldRejectFederatedAuthResult(flow: AuthFlow, isNewUser: Boolean): Boolean =
    when (flow) {
        AuthFlow.Login -> isNewUser
        AuthFlow.CreateAccount -> !isNewUser
    }

internal fun authFormError(email: String, password: String): String? =
    when {
        !isValidAuthEmail(email) -> "Enter a valid email address."
        password.length < 8 -> "Use a password with at least 8 characters."
        else -> null
    }

internal fun isValidAuthEmail(email: String): Boolean =
    email.length in 5..254 &&
        email.count { it == '@' } == 1 &&
        email.substringBefore('@').isNotBlank() &&
        email.substringAfter('@').contains('.') &&
        !email.any(Char::isWhitespace)

private fun authLoadingStatus(flow: AuthFlow): String =
    when (flow) {
        AuthFlow.Login -> "Signing in"
        AuthFlow.CreateAccount -> "Creating"
    }

private fun emailPasswordAuthError(flow: AuthFlow, error: Throwable): String =
    when (error) {
        is FirebaseAuthUserCollisionException -> "That account already exists. Log in to continue."
        is FirebaseAuthWeakPasswordException -> "Use a password with at least 8 characters."
        is FirebaseAuthInvalidUserException -> "Email or password is incorrect."
        is FirebaseAuthInvalidCredentialsException -> when (flow) {
            AuthFlow.CreateAccount -> "Enter a valid email address."
            AuthFlow.Login -> "Email or password is incorrect."
        }
        else -> {
            val message = error.message.orEmpty()
            when {
                message.contains("network", ignoreCase = true) -> "Check your connection and try again."
                message.contains("password", ignoreCase = true) && flow == AuthFlow.CreateAccount -> "Use a password with at least 8 characters."
                message.contains("email", ignoreCase = true) && flow == AuthFlow.CreateAccount -> "Enter a valid email address."
                else -> "Could not finish authentication. Please try again."
            }
        }
    }

internal fun protectedNumberVerificationError(error: Throwable?): String {
    val message = error?.message.orEmpty()
    return if (message.contains("already associated with a different user account", ignoreCase = true)) {
        "That mobile number is already connected to another account. Contact support to move it."
    } else {
        message.ifBlank { "Could not verify phone." }
    }
}
