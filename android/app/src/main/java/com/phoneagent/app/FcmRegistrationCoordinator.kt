package com.phoneagent.app

import android.content.Context
import android.provider.Settings
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.messaging.FirebaseMessaging
import com.phoneagent.app.data.PushTokenRegistrationRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

internal class FcmRegistrationCoordinator(
    private val context: Context,
    private val scope: CoroutineScope,
    private val firebaseAuth: FirebaseAuth,
    private val viewModel: PhoneAgentViewModel
) {
    fun register() {
        scope.launch { registerCurrentToken() }
    }

    suspend fun registerCurrentToken() {
        val user = firebaseAuth.currentUser ?: return
        runCatching {
            val token = withTimeoutOrNull(5000) { FirebaseMessaging.getInstance().token.await() } ?: return@runCatching
            viewModel.registerPushToken(
                user.idToken(),
                PushTokenRegistrationRequest(
                    token = token,
                    deviceId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID),
                    appVersion = BuildConfig.VERSION_NAME
                )
            )
        }
    }
}
