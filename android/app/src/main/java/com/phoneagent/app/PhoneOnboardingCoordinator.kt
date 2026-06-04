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
import com.google.firebase.auth.FirebaseAuthUserCollisionException
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
    private val registerPushToken: suspend () -> Unit,
    private val refreshData: suspend (forceStatus: Boolean, keepScreen: Boolean) -> Unit,
    private val readableError: (Throwable) -> String,
    private val toast: (String) -> Unit
) {
    private val credentialManager = CredentialManager.create(activity)

    fun startGoogleAuth() {
        scope.launch {
            try {
                setState(getState().copy(loading = true, status = "Signing in", error = null))
                val idToken = runCatching { googleIdToken(filterByAuthorizedAccounts = true) }
                    .recoverCatching { error ->
                        if (error is NoCredentialException) {
                            googleIdToken(filterByAuthorizedAccounts = false)
                        } else {
                            throw error
                        }
                    }
                    .getOrThrow()
                val credential = GoogleAuthProvider.getCredential(idToken, null)
                firebaseAuth.signInWithCredential(credential).await()
                completeAuthenticatedSession()
            } catch (error: GetCredentialCancellationException) {
                setState(getState().copy(loading = false, status = "Setup", error = null))
            } catch (error: Exception) {
                setState(getState().copy(loading = false, status = "Setup", error = readableError(error)))
                toast("Could not sign in with Google.")
            }
        }
    }

    fun startPhoneAuth(phoneNumber: String) {
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
                    signInWithCredential(credential)
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
        signInWithCredential(PhoneAuthProvider.getCredential(verificationId, code.trim()))
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

    private fun signInWithCredential(credential: PhoneAuthCredential) {
        val currentUser = firebaseAuth.currentUser
        val currentUserNeedsPhone = currentUser != null && currentUser.phoneNumber.isNullOrBlank()
        val task = if (currentUserNeedsPhone) {
            currentUser.linkWithCredential(credential)
        } else {
            firebaseAuth.signInWithCredential(credential)
        }
        task.addOnCompleteListener { result ->
            if (!result.isSuccessful) {
                if (shouldRecoverExistingPhoneAccount(currentUserNeedsPhone, result.exception)) {
                    recoverExistingPhoneAccount(credential)
                    return@addOnCompleteListener
                }
                setState(
                    getState().copy(
                        loading = false,
                        status = "Setup",
                        error = result.exception?.message ?: "Could not verify phone."
                    )
                )
                return@addOnCompleteListener
            }
            scope.launch {
                try {
                    completeAuthenticatedSession()
                } catch (error: Exception) {
                    setState(getState().copy(loading = false, status = "Setup", error = readableError(error)))
                }
            }
        }
    }

    private fun recoverExistingPhoneAccount(credential: PhoneAuthCredential) {
        scope.launch {
            try {
                setState(getState().copy(loading = true, status = "Recovering", error = null))
                firebaseAuth.signOut()
                firebaseAuth.signInWithCredential(credential).await()
                toast("We found your existing account for this mobile number.")
                completeAuthenticatedSession()
            } catch (error: Exception) {
                setState(
                    getState().copy(
                        loading = false,
                        status = "Setup",
                        screen = Screen.Auth,
                        error = readableError(error)
                    )
                )
                toast("Could not recover that mobile account.")
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
        registerPushToken()
        setState(getState().copy(loading = true, status = "Syncing", error = null))
        refreshData(true, false)
        val refreshed = getState()
        when {
            !refreshed.onboarding.phoneVerified -> setState(refreshed.copy(loading = false, status = "Setup", screen = Screen.Auth, error = null))
            !refreshed.onboarding.assistantProfileConfigured -> setState(refreshed.copy(loading = false, status = "Setup", screen = Screen.AssistantName, error = null))
        }
    }
}

internal fun shouldRecoverExistingPhoneAccount(currentUserNeedsPhone: Boolean, error: Throwable?): Boolean {
    if (!currentUserNeedsPhone) return false
    val message = error?.message.orEmpty()
    return error is FirebaseAuthUserCollisionException ||
        message.contains("already associated with a different user account", ignoreCase = true)
}
