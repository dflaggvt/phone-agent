package com.phoneagent.app.data.remote

import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Call
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Url

interface PhoneAgentApi {
    @GET
    suspend fun getJson(
        @Url path: String,
        @Header("authorization") authorization: String,
        @Header("x-phone-agent-action-surface") actionSurface: String = ACTION_SURFACE
    ): Response<ResponseBody>

    @POST
    suspend fun postJson(
        @Url path: String,
        @Header("authorization") authorization: String,
        @Body body: RequestBody?,
        @Header("x-phone-agent-action-surface") actionSurface: String = ACTION_SURFACE
    ): Response<ResponseBody>

    @PATCH
    suspend fun patchJson(
        @Url path: String,
        @Header("authorization") authorization: String,
        @Body body: RequestBody,
        @Header("x-phone-agent-action-surface") actionSurface: String = ACTION_SURFACE
    ): Response<ResponseBody>

    @DELETE
    suspend fun deleteJson(
        @Url path: String,
        @Header("authorization") authorization: String,
        @Header("x-phone-agent-action-surface") actionSurface: String = ACTION_SURFACE
    ): Response<ResponseBody>

    @POST
    fun postJsonCall(
        @Url path: String,
        @Header("authorization") authorization: String,
        @Body body: RequestBody?,
        @Header("x-phone-agent-action-surface") actionSurface: String
    ): Call<ResponseBody>

    companion object {
        const val ACTION_SURFACE = "compose_app"
    }
}
