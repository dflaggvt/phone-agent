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
    fun cachedJsonReturnsEmptyObjectForInvalidSnapshots() {
        val parsed = cachedJson("{not valid json")

        assertTrue(parsed.length() == 0)
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
