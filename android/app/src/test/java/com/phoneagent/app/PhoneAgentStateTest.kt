package com.phoneagent.app

import com.phoneagent.app.data.DeviceContactInput
import com.phoneagent.app.data.DevicePhoneNumberInput
import com.phoneagent.app.data.ProductAnalyticsEventInput
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PhoneAgentStateTest {
    @Test
    fun callRecordPrefersStructuredSummaryAndFormatsCallerFields() {
        val call = CallRecord(
            JSONObject(
                """
                {
                  "providerCallId": "call_123",
                  "displayName": "Theresa",
                  "fromNumber": "+17032988965",
                  "startedAt": "2026-06-01T22:07:00Z",
                  "summary": {
                    "structuredData": {
                      "custom_analysis_data": {
                        "call_summary": "Theresa asked for your ETA.",
                        "caller_intent": "Coordinate dinner",
                        "urgency": "low",
                        "requested_follow_up": "Send ETA"
                      }
                    }
                  }
                }
                """.trimIndent()
            )
        )

        assertEquals("call_123", call.providerCallId)
        assertEquals("Theresa", call.displayCaller)
        assertEquals("+17032988965", call.callbackNumber)
        assertEquals("Theresa asked for your ETA.", call.displaySummary)
        assertEquals("Coordinate dinner", call.intent)
        assertEquals("low", call.urgencyLabel)
    }

    @Test
    fun topicThreadBuildsCountsAndTimelineFromJsonSnapshot() {
        val topic = TopicThread(
            JSONObject(
                """
                {
                  "id": "topic_home",
                  "title": "Basement Project",
                  "description": "Permit, contractor, and budget decisions.",
                  "communicationItemIds": ["a", "b"],
                  "decisions": [{"title": "Framing approved"}],
                  "openQuestions": [{"question": "Permit required?"}],
                  "tasks": [{"title": "Send estimate"}],
                  "timeline": [{"title": "Contractor call", "summary": "Estimate requested."}]
                }
                """.trimIndent()
            )
        )

        assertEquals("Basement Project", topic.title)
        assertEquals(2, topic.communicationCount)
        assertEquals(1, topic.decisionCount)
        assertEquals(1, topic.questionCount)
        assertEquals(1, topic.taskCount)
        assertEquals("Contractor call", topic.timeline.single().title)
    }

    @Test
    fun contactStatusAndForwardingDigitsRemainConsumerSafe() {
        val status = ContactSyncStatus(JSONObject("""{"syncedCount":128,"phoneNumberCount":184}"""))

        assertEquals("128 synced", status.summary)
        assertEquals("184 phone numbers", status.detail)
        assertEquals("7032988965", "+17032988965".toForwardingDigits())
        assertEquals("7032988965", "703-298-8965".toForwardingDigits())
    }

    @Test
    fun billingAccountDisplaysActiveBackendStateAsReady() {
        val billing = BillingAccount(
            JSONObject(
                """
                {
                  "status": "active",
                  "providerSubscriptionStatus": "active",
                  "monthlySpendingCapCents": 2500,
                  "paymentMethod": {
                    "provider": "stripe",
                    "brand": "visa",
                    "last4": "4242"
                  }
                }
                """.trimIndent()
            )
        )

        assertEquals("active", billing.status)
        assertEquals("Billing ready", billing.display)
        assertEquals("${'$'}25/mo", billing.capDisplay)
    }

    @Test
    fun onboardingStatusExposesPhoneAndAssistantCompletionForAuthRouting() {
        val status = OnboardingStatus(
            JSONObject(
                """
                {
                  "readyForBetaUse": false,
                  "activation": {
                    "phoneVerified": true,
                    "assistantProfileConfigured": false
                  }
                }
                """.trimIndent()
            )
        )

        assertTrue(status.phoneVerified)
        assertFalse(status.assistantProfileConfigured)
        assertFalse(status.ready)
    }

    @Test
    fun userSummaryExposesEmailAndPhoneVerificationStatus() {
        val user = UserSummary(
            JSONObject(
                """
                {
                  "userId": "firebase_maya",
                  "displayName": "Maya Chen",
                  "auth": {
                    "email": "maya@example.com",
                    "phoneNumber": "+15550001111",
                    "phoneVerificationStatus": "verified"
                  }
                }
                """.trimIndent()
            )
        )

        assertEquals("firebase_maya", user.id)
        assertEquals("maya@example.com", user.email)
        assertTrue(user.phoneVerified)
    }

    @Test
    fun phoneCredentialCollisionUsesProductOwnedRecoveryMessage() {
        val collision = IllegalStateException("This credential is already associated with a different user account.")

        assertEquals(
            "That mobile number is already connected to another account. Contact support to move it.",
            protectedNumberVerificationError(collision)
        )
        assertEquals("Network unavailable.", protectedNumberVerificationError(IllegalStateException("Network unavailable.")))
        assertEquals("Could not verify phone.", protectedNumberVerificationError(null))
    }

    @Test
    fun federatedAuthFlowRejectsUnexpectedAccountCreationOrReuse() {
        assertTrue(shouldRejectFederatedAuthResult(AuthFlow.Login, isNewUser = true))
        assertFalse(shouldRejectFederatedAuthResult(AuthFlow.Login, isNewUser = false))

        assertTrue(shouldRejectFederatedAuthResult(AuthFlow.CreateAccount, isNewUser = false))
        assertFalse(shouldRejectFederatedAuthResult(AuthFlow.CreateAccount, isNewUser = true))
    }

    @Test
    fun emailPasswordAuthValidationRequiresValidEmailAndStrongPassword() {
        assertEquals("Enter a valid email address.", authFormError("not-email", "password123"))
        assertEquals("Enter a valid email address.", authFormError("person@example", "password123"))
        assertEquals("Use a password with at least 8 characters.", authFormError("person@example.com", "short"))
        assertEquals(null, authFormError("person@example.com", "password123"))

        assertTrue(isValidAuthEmail("person@example.com"))
        assertFalse(isValidAuthEmail("person @example.com"))
    }

    @Test
    fun cachedJsonReturnsEmptyObjectForInvalidSnapshots() {
        val parsed = cachedJson("{not valid json")

        assertTrue(parsed.length() == 0)
    }

    @Test
    fun topicSuggestionCleansLegacyGeneratedTitlesFromCachedSnapshots() {
        val doctorSuggestion = TopicSuggestion(
            JSONObject(
                """
                {
                  "id": "suggestion_doctor",
                  "targetType": "new_topic",
                  "suggestedTitle": "Scheduling and Coordination for Daryl Flagg's Doctor Appointments"
                }
                """.trimIndent()
            )
        )
        val cleanerSuggestion = TopicSuggestion(
            JSONObject(
                """
                {
                  "id": "suggestion_cleaner",
                  "targetType": "new_topic",
                  "suggestedTitle": "Cleaner Visit Coordination for Daryl Flagg"
                }
                """.trimIndent()
            )
        )
        val medicalSuggestion = TopicSuggestion(
            JSONObject(
                """
                {
                  "id": "suggestion_summit",
                  "targetType": "new_topic",
                  "suggestedTitle": "Daryl's Summit Health Appointment on June 6, 2026"
                }
                """.trimIndent()
            )
        )

        assertEquals("Doctor Appointments", doctorSuggestion.title)
        assertEquals("Cleaner Visit", cleanerSuggestion.title)
        assertEquals("Summit Health Appointment", medicalSuggestion.title)
    }

    @Test
    fun contactSyncRequestSerializesOnlyAllowedContactFields() {
        val contact = DeviceContactInput(
            sourceContactId = "android-123",
            displayName = "Theresa",
            phoneNumbers = listOf(DevicePhoneNumberInput("+17032988965", "mobile"))
        ).toJson()

        assertEquals("android_contacts", contact.getString("source"))
        assertEquals("android-123", contact.getString("sourceContactId"))
        assertEquals("Theresa", contact.getString("displayName"))
        assertEquals("+17032988965", contact.getJSONArray("phoneNumbers").getJSONObject(0).getString("number"))
        assertFalse(contact.has("emails"))
        assertFalse(contact.has("notes"))
        assertFalse(contact.has("photo"))
    }

    @Test
    fun analyticsEventSerializationKeepsAttributesSafeAndBounded() {
        val event = ProductAnalyticsEventInput(
            sessionId = "session-12345678",
            eventName = "screen_viewed",
            sequence = 42,
            appVersion = "1.0",
            buildType = "debug",
            deviceClass = "Samsung ".repeat(40),
            osVersion = "16",
            occurredAt = "2026-06-03T12:00:00Z",
            screen = "home",
            action = "view",
            result = null,
            objectType = null,
            objectId = null,
            attributes = mapOf(
                "safe_text" to "x".repeat(300),
                "count" to 3,
                "enabled" to true,
                "ignored" to listOf("not", "serializable")
            )
        ).toJson()

        val attributes = event.getJSONObject("attributes")
        assertEquals(160, attributes.getString("safe_text").length)
        assertEquals(3, attributes.getInt("count"))
        assertTrue(attributes.getBoolean("enabled"))
        assertFalse(attributes.has("ignored"))
        assertEquals(80, event.getString("deviceClass").length)
    }
}
