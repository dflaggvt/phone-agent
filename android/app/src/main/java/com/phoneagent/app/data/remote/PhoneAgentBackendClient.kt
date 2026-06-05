package com.phoneagent.app.data.remote

import javax.inject.Inject
import javax.inject.Singleton
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class PhoneAgentApiException(
    val statusCode: Int,
    val apiCode: String?,
    message: String
) : RuntimeException(message)

@Singleton
class PhoneAgentBackendClient @Inject constructor(
    private val api: PhoneAgentApi
) {
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun getJson(token: String, path: String): JSONObject {
        val response = api.getJson(relativePath(path), bearer(token))
        return response.toJson()
    }

    suspend fun postJson(token: String, path: String, payload: JSONObject?): JSONObject {
        val body = payload?.toString()?.toRequestBody(jsonMediaType)
        val response = api.postJson(relativePath(path), bearer(token), body)
        return response.toJson()
    }

    suspend fun patchJson(token: String, path: String, payload: JSONObject): JSONObject {
        val body = payload.toString().toRequestBody(jsonMediaType)
        val response = api.patchJson(relativePath(path), bearer(token), body)
        return response.toJson()
    }

    suspend fun deleteJson(token: String, path: String): JSONObject {
        val response = api.deleteJson(relativePath(path), bearer(token))
        return response.toJson()
    }

    private fun bearer(token: String): String = "Bearer $token"

    private fun relativePath(path: String): String = path.trimStart('/')
}

private fun retrofit2.Response<okhttp3.ResponseBody>.toJson(): JSONObject {
    val text = if (isSuccessful) {
        body()?.string().orEmpty()
    } else {
        errorBody()?.string().orEmpty()
    }
    if (!isSuccessful) {
        throw apiException(code(), text)
    }
    return if (text.isBlank()) JSONObject() else JSONObject(text)
}

private fun apiException(statusCode: Int, text: String): PhoneAgentApiException {
    val parsed = runCatching {
        if (text.isBlank()) null else JSONObject(text)
    }.getOrNull()
    val error = parsed?.optJSONObject("error")
    val apiCode = error?.optString("code").nonBlank()
        ?: parsed?.optString("code").nonBlank()
    val apiMessage = error?.optString("message").nonBlank()
        ?: parsed?.optString("message").nonBlank()
        ?: "HTTP $statusCode"
    return PhoneAgentApiException(statusCode, apiCode, apiMessage)
}

private fun String?.nonBlank(): String? = this?.takeIf { it.isNotBlank() }
