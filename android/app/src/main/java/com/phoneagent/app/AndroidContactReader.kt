package com.phoneagent.app

import android.content.Context
import android.database.Cursor
import android.provider.ContactsContract
import com.phoneagent.app.data.DeviceContactInput
import com.phoneagent.app.data.DevicePhoneNumberInput
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.LinkedHashMap
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
internal class AndroidContactReader @Inject constructor(
    @ApplicationContext private val context: Context
) {
    fun readPhoneContacts(): List<DeviceContactInput> {
        val contacts = LinkedHashMap<String, DeviceContactBuilder>()
        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.TYPE,
            ContactsContract.CommonDataKinds.Phone.LABEL
        )
        val cursor = context.contentResolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            projection,
            null,
            null,
            "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC"
        ) ?: error("Android contacts provider is unavailable.")

        cursor.use { rows ->
            val idColumn = rows.safeColumn(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)
            val nameColumn = rows.safeColumn(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
            val numberColumn = rows.safeColumn(ContactsContract.CommonDataKinds.Phone.NUMBER)
            val typeColumn = rows.safeColumn(ContactsContract.CommonDataKinds.Phone.TYPE)
            val labelColumn = rows.safeColumn(ContactsContract.CommonDataKinds.Phone.LABEL)
            if (idColumn < 0 || nameColumn < 0 || numberColumn < 0) {
                error("Android contacts provider returned an unsupported schema.")
            }
            while (rows.moveToNext()) {
                val sourceContactId = rows.getString(idColumn)?.trim().orEmpty()
                val displayName = rows.getString(nameColumn)?.trim().orEmpty()
                val phoneNumber = rows.getString(numberColumn)?.trim().orEmpty()
                if (sourceContactId.isBlank() || displayName.isBlank() || phoneNumber.isBlank()) {
                    continue
                }
                val type = if (typeColumn >= 0) rows.getInt(typeColumn) else ContactsContract.CommonDataKinds.Phone.TYPE_OTHER
                val customLabel = if (labelColumn >= 0) rows.getString(labelColumn) else null
                val label = ContactsContract.CommonDataKinds.Phone.getTypeLabel(context.resources, type, customLabel).toString().take(80)
                val contact = contacts.getOrPut(sourceContactId) { DeviceContactBuilder(sourceContactId, displayName) }
                contact.phoneNumbers.add(DevicePhoneNumberInput(phoneNumber, label))
            }
        }

        return contacts.values
            .mapNotNull { contact ->
                val uniqueNumbers = contact.phoneNumbers
                    .distinctBy { normalizePhone(it.number) }
                    .filter { normalizePhone(it.number).isNotBlank() }
                    .take(20)
                if (uniqueNumbers.isEmpty()) {
                    null
                } else {
                    DeviceContactInput(
                        sourceContactId = contact.sourceContactId,
                        displayName = contact.displayName,
                        phoneNumbers = uniqueNumbers
                    )
                }
            }
            .take(10_000)
    }
}

private fun Cursor.safeColumn(name: String): Int =
    runCatching { getColumnIndex(name) }.getOrDefault(-1)

private data class DeviceContactBuilder(
    val sourceContactId: String,
    val displayName: String,
    val phoneNumbers: MutableList<DevicePhoneNumberInput> = mutableListOf()
)
