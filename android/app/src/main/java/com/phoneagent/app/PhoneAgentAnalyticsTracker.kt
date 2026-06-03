package com.phoneagent.app

import android.os.Build
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.phoneagent.app.data.PhoneAgentRepository
import com.phoneagent.app.data.ProductAnalyticsEventInput
import java.time.Instant
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

@Singleton
internal class PhoneAgentAnalyticsTracker @Inject constructor(
    private val firebaseAuth: FirebaseAuth,
    private val repository: PhoneAgentRepository
) {
    private val sessionId = UUID.randomUUID().toString()
    private var sequence = 0

    fun track(
        scope: CoroutineScope,
        eventName: String,
        screen: String? = null,
        action: String? = null,
        result: String? = null,
        objectType: String? = null,
        objectId: String? = null,
        attributes: Map<String, Any> = emptyMap()
    ) {
        val user = firebaseAuth.currentUser ?: return
        val event = ProductAnalyticsEventInput(
            sessionId = sessionId,
            eventName = eventName,
            sequence = sequence++,
            appVersion = BuildConfig.VERSION_NAME,
            buildType = BuildConfig.BUILD_TYPE,
            deviceClass = Build.MODEL.orEmpty(),
            osVersion = Build.VERSION.RELEASE.orEmpty(),
            occurredAt = Instant.now().toString(),
            screen = screen,
            action = action,
            result = result,
            objectType = objectType,
            objectId = objectId,
            attributes = attributes
        )
        scope.launch {
            runCatching {
                repository.submitAnalyticsEvent(user.idToken(), event)
            }.onFailure {
                FirebaseCrashlytics.getInstance().recordException(it)
            }
        }
    }
}
