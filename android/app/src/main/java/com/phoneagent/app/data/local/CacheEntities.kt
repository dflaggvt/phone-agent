package com.phoneagent.app.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_singletons")
data class CachedSingletonEntity(
    @PrimaryKey val cacheKey: String,
    val json: String,
    val cachedAtEpochMs: Long
)

@Entity(tableName = "cached_topics")
data class CachedTopicEntity(
    @PrimaryKey val id: String,
    val title: String,
    val description: String,
    val communicationCount: Int,
    val cachedAtEpochMs: Long,
    val json: String
)

@Entity(tableName = "cached_calls")
data class CachedCallEntity(
    @PrimaryKey val id: String,
    val displayCaller: String,
    val phoneNumber: String,
    val occurredAt: String,
    val cachedAtEpochMs: Long,
    val json: String
)

@Entity(tableName = "cached_topic_suggestions")
data class CachedTopicSuggestionEntity(
    @PrimaryKey val id: String,
    val title: String,
    val confidence: Double,
    val cachedAtEpochMs: Long,
    val json: String
)

@Entity(tableName = "cached_notifications")
data class CachedNotificationEntity(
    @PrimaryKey val id: String,
    val title: String,
    val cachedAtEpochMs: Long,
    val json: String
)
