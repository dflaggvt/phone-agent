package com.phoneagent.app

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

internal class ContactSyncCoordinator(
    private val scope: CoroutineScope,
    private val contactReader: AndroidContactReader,
    private val contactsViewModel: ContactsViewModel,
    private val hasContactsPermission: () -> Boolean,
    private val requestContactsPermission: () -> Unit,
    private val getState: () -> PhoneAgentUiState,
    private val setState: (PhoneAgentUiState) -> Unit,
    private val tokenProvider: suspend () -> String,
    private val refreshData: suspend (forceStatus: Boolean, keepScreen: Boolean) -> Unit,
    private val readableError: (Throwable) -> String,
    private val toast: (String) -> Unit,
    private val track: (
        eventName: String,
        screen: String?,
        action: String?,
        result: String?,
        attributes: Map<String, Any>
    ) -> Unit
) {
    fun requestSync() {
        if (!hasContactsPermission()) {
            setState(getState().copy(contactSyncing = true, status = "Syncing", contactPermissionDenied = false))
            track("contacts_permission_requested", "phone_contacts", "permission", null, emptyMap())
            requestContactsPermission()
            return
        }
        syncPhoneContacts()
    }

    fun onPermissionResult(granted: Boolean) {
        if (granted) {
            setState(getState().copy(contactPermissionDenied = false))
            track("contacts_permission_result", "phone_contacts", "permission", "granted", emptyMap())
            syncPhoneContacts()
        } else {
            val ready = getState().onboarding.ready
            setState(getState().copy(contactSyncing = false, contactPermissionDenied = true, status = if (ready) "Active" else "Setup"))
            toast("Contacts permission was not granted.")
            track("contacts_permission_result", "phone_contacts", "permission", "denied", emptyMap())
        }
    }

    fun disconnectContacts() {
        scope.launch {
            try {
                setState(getState().copy(contactSyncing = true, loading = true, status = "Syncing", error = null))
                val status = contactsViewModel.disconnectContacts(tokenProvider())
                setState(
                    getState().copy(
                        contactSyncing = false,
                        loading = false,
                        contactSync = status,
                        status = if (getState().onboarding.ready) "Active" else "Setup"
                    )
                )
                toast("Phone contacts disconnected")
                track("contacts_disconnected", "phone_contacts", "disconnect", "success", emptyMap())
                refreshData(true, true)
            } catch (error: Exception) {
                setState(getState().copy(contactSyncing = false, loading = false, error = readableError(error)))
                toast("Could not disconnect contacts.")
                track("contacts_disconnect_failed", "phone_contacts", "disconnect", "failed", emptyMap())
            }
        }
    }

    private fun syncPhoneContacts() {
        scope.launch {
            try {
                setState(getState().copy(contactSyncing = true, loading = true, status = "Syncing", error = null, contactPermissionDenied = false))
                val contacts = withContext(Dispatchers.IO) { contactReader.readPhoneContacts() }
                val status = contactsViewModel.syncContacts(tokenProvider(), contacts)
                setState(
                    getState().copy(
                        contactSyncing = false,
                        loading = false,
                        contactSync = status,
                        status = if (getState().onboarding.ready) "Active" else "Setup"
                    )
                )
                toast("${status.syncedCount} contacts synced")
                track(
                    "contacts_sync_succeeded",
                    "phone_contacts",
                    "sync",
                    "success",
                    mapOf(
                        "synced_count" to status.syncedCount,
                        "phone_number_count" to status.phoneNumberCount
                    )
                )
                refreshData(true, true)
            } catch (error: Exception) {
                setState(
                    getState().copy(
                        contactSyncing = false,
                        loading = false,
                        status = if (getState().onboarding.ready) "Active" else "Setup",
                        error = readableError(error)
                    )
                )
                toast("Could not sync contacts.")
                track("contacts_sync_failed", "phone_contacts", "sync", "failed", emptyMap())
            }
        }
    }
}
