package com.phoneagent.app.data

import org.json.JSONArray
import org.json.JSONObject

internal data class DevicePhoneNumberInput(
    val number: String,
    val label: String?
) {
    fun toJson(): JSONObject = JSONObject()
        .put("number", number)
        .putOptionalString("label", label, maxLength = 80)
}

internal data class DeviceContactInput(
    val sourceContactId: String,
    val displayName: String,
    val phoneNumbers: List<DevicePhoneNumberInput>
) {
    fun toJson(): JSONObject = JSONObject()
        .put("source", "android_contacts")
        .put("sourceContactId", sourceContactId)
        .put("displayName", displayName)
        .put(
            "phoneNumbers",
            JSONArray().apply { phoneNumbers.forEach { put(it.toJson()) } }
        )
}

internal data class AssistantProfileUpdate(
    val assistantName: String,
    val greetingStyle: String,
    val disclosureStyle: String,
    val warmth: Int,
    val brevity: Int,
    val proactivity: Int
) {
    fun toJson(): JSONObject = JSONObject()
        .put("assistantName", assistantName)
        .put("greetingStyle", greetingStyle)
        .put("disclosureStyle", disclosureStyle)
        .put("warmth", warmth)
        .put("brevity", brevity)
        .put("proactivity", proactivity)
}

internal data class TopicCreateRequest(
    val title: String,
    val description: String?
) {
    fun toJson(): JSONObject = JSONObject()
        .put("title", title)
        .putOptionalString("description", description, maxLength = 2000)
}

internal data class AgentNoteCreateRequest(
    val text: String,
    val targetPhoneNumber: String?,
    val topic: String?
) {
    fun toJson(): JSONObject = JSONObject()
        .put("text", text)
        .putOptionalString("targetPhoneNumber", targetPhoneNumber, maxLength = 40)
        .putOptionalString("topic", topic, maxLength = 200)
}

internal data class PushTokenRegistrationRequest(
    val token: String,
    val deviceId: String?,
    val appVersion: String?
) {
    fun toJson(): JSONObject = JSONObject()
        .put("token", token)
        .put("platform", "android")
        .putOptionalString("deviceId", deviceId, maxLength = 200)
        .putOptionalString("appVersion", appVersion, maxLength = 80)
}

internal data class ProductAnalyticsEventInput(
    val sessionId: String,
    val eventName: String,
    val sequence: Int,
    val appVersion: String,
    val buildType: String,
    val deviceClass: String,
    val osVersion: String,
    val occurredAt: String,
    val screen: String?,
    val action: String?,
    val result: String?,
    val objectType: String?,
    val objectId: String?,
    val attributes: Map<String, Any>
) {
    fun toJson(): JSONObject {
        val event = JSONObject()
            .put("sessionId", sessionId)
            .put("eventName", eventName)
            .put("sequence", sequence)
            .put("appVersion", appVersion)
            .put("buildType", buildType)
            .put("deviceClass", deviceClass.take(80))
            .put("osVersion", osVersion.take(40))
            .put("occurredAt", occurredAt)
            .putOptionalString("screen", screen, maxLength = 120)
            .putOptionalString("action", action, maxLength = 120)
            .putOptionalString("result", result, maxLength = 120)
            .putOptionalString("objectType", objectType, maxLength = 80)
            .putOptionalString("objectId", objectId, maxLength = 200)

        if (attributes.isNotEmpty()) {
            val safeAttributes = JSONObject()
            attributes.forEach { (key, value) ->
                when (value) {
                    is String -> safeAttributes.put(key, value.take(160))
                    is Number -> safeAttributes.put(key, value)
                    is Boolean -> safeAttributes.put(key, value)
                }
            }
            event.put("attributes", safeAttributes)
        }
        return event
    }
}

private fun JSONObject.putOptionalString(key: String, value: String?, maxLength: Int): JSONObject {
    val trimmed = value?.trim().orEmpty()
    if (trimmed.isNotEmpty()) put(key, trimmed.take(maxLength))
    return this
}
