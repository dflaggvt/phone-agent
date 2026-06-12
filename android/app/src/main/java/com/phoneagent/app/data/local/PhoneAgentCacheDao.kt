package com.phoneagent.app.data.local

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert

@Dao
interface PhoneAgentCacheDao {
    @Query("SELECT * FROM cached_singletons WHERE cacheKey = :key LIMIT 1")
    suspend fun singleton(key: String): CachedSingletonEntity?

    @Query("SELECT * FROM cached_topics ORDER BY cachedAtEpochMs DESC, title COLLATE NOCASE ASC")
    suspend fun topics(): List<CachedTopicEntity>

    @Query("SELECT * FROM cached_calls ORDER BY occurredAt DESC, cachedAtEpochMs DESC")
    suspend fun calls(): List<CachedCallEntity>

    @Query("SELECT * FROM cached_topic_suggestions ORDER BY confidence DESC, cachedAtEpochMs DESC")
    suspend fun topicSuggestions(): List<CachedTopicSuggestionEntity>

    @Query("SELECT * FROM cached_notifications ORDER BY cachedAtEpochMs DESC")
    suspend fun notifications(): List<CachedNotificationEntity>

    @Upsert
    suspend fun upsertSingleton(entity: CachedSingletonEntity)

    @Upsert
    suspend fun upsertTopics(entities: List<CachedTopicEntity>)

    @Upsert
    suspend fun upsertCalls(entities: List<CachedCallEntity>)

    @Upsert
    suspend fun upsertTopicSuggestions(entities: List<CachedTopicSuggestionEntity>)

    @Upsert
    suspend fun upsertNotifications(entities: List<CachedNotificationEntity>)

    @Query("DELETE FROM cached_singletons WHERE cacheKey = :key")
    suspend fun deleteSingleton(key: String)

    @Query("DELETE FROM cached_singletons")
    suspend fun clearSingletons()

    @Query("DELETE FROM cached_topics")
    suspend fun clearTopics()

    @Query("DELETE FROM cached_calls")
    suspend fun clearCalls()

    @Query("DELETE FROM cached_topic_suggestions")
    suspend fun clearTopicSuggestions()

    @Query("DELETE FROM cached_topic_suggestions WHERE id = :id")
    suspend fun deleteTopicSuggestion(id: String)

    @Query("DELETE FROM cached_notifications")
    suspend fun clearNotifications()
}
