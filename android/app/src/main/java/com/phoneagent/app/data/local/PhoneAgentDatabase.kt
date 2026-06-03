package com.phoneagent.app.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        CachedSingletonEntity::class,
        CachedTopicEntity::class,
        CachedCallEntity::class,
        CachedTopicSuggestionEntity::class,
        CachedNotificationEntity::class
    ],
    version = 1,
    exportSchema = true
)
abstract class PhoneAgentDatabase : RoomDatabase() {
    abstract fun cacheDao(): PhoneAgentCacheDao

    companion object {
        @Volatile private var instance: PhoneAgentDatabase? = null

        fun get(context: Context): PhoneAgentDatabase {
            return instance ?: synchronized(this) {
                instance ?: buildDatabase(context.applicationContext).also { instance = it }
            }
        }

        private fun buildDatabase(context: Context): PhoneAgentDatabase {
            return Room.databaseBuilder(
                context,
                PhoneAgentDatabase::class.java,
                "phone_agent_cache.db"
            ).build()
        }
    }
}
