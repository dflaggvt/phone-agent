package com.phoneagent.app

import androidx.activity.ComponentActivity
import com.google.firebase.FirebaseException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
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
    private var pendingDisplayName = ""

    fun startPhoneAuth(displayName: String, phoneNumber: String) {
        val normalized = normalizePhone(phoneNumber)
        if (displayName.trim().isEmpty() || !isValidE164Phone(normalized)) {
            toast("Enter your name and a valid mobile number.")
            return
        }
        pendingDisplayName = displayName.trim()
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
        firebaseAuth.signInWithCredential(credential).addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                setState(
                    getState().copy(
                        loading = false,
                        status = "Setup",
                        error = task.exception?.message ?: "Could not verify phone."
                    )
                )
                return@addOnCompleteListener
            }
            scope.launch {
                try {
                    onboardingViewModel.updateDisplayName(tokenProvider(), pendingDisplayName.ifBlank { "Phone Agent User" })
                    registerPushToken()
                    setState(getState().copy(loading = false, status = "Setup", screen = Screen.AssistantName, error = null))
                    refreshData(true, true)
                } catch (error: Exception) {
                    setState(getState().copy(loading = false, status = "Setup", error = readableError(error)))
                }
            }
        }
    }
}
