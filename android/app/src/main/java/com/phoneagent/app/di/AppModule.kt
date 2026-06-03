package com.phoneagent.app.di

import android.content.Context
import com.google.firebase.auth.FirebaseAuth
import com.phoneagent.app.BuildConfig
import com.phoneagent.app.data.local.PhoneAgentDatabase
import com.phoneagent.app.data.remote.PhoneAgentApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import java.util.concurrent.TimeUnit
import javax.inject.Singleton
import okhttp3.OkHttpClient
import retrofit2.Retrofit

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides
    @Singleton
    fun provideFirebaseAuth(): FirebaseAuth = FirebaseAuth.getInstance()

    @Provides
    @Singleton
    fun providePhoneAgentDatabase(@ApplicationContext context: Context): PhoneAgentDatabase =
        PhoneAgentDatabase.get(context)

    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient =
        OkHttpClient.Builder()
            .connectTimeout(8, TimeUnit.SECONDS)
            .readTimeout(8, TimeUnit.SECONDS)
            .writeTimeout(8, TimeUnit.SECONDS)
            .build()

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit =
        Retrofit.Builder()
            .baseUrl(BuildConfig.BACKEND_BASE_URL.ensureTrailingSlash())
            .client(okHttpClient)
            .build()

    @Provides
    @Singleton
    fun providePhoneAgentApi(retrofit: Retrofit): PhoneAgentApi =
        retrofit.create(PhoneAgentApi::class.java)
}

private fun String.ensureTrailingSlash(): String = if (endsWith("/")) this else "$this/"
