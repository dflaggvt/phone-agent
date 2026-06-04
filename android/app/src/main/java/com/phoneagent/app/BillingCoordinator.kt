package com.phoneagent.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

internal class BillingCoordinator(
    private val activity: Activity,
    private val scope: CoroutineScope,
    private val billingViewModel: BillingViewModel,
    private val getState: () -> PhoneAgentUiState,
    private val setState: (PhoneAgentUiState) -> Unit,
    private val tokenProvider: suspend () -> String,
    private val refreshData: suspend (forceStatus: Boolean, keepScreen: Boolean) -> Unit
) {
    fun openCheckout() {
        scope.launch {
            try {
                setState(getState().copy(loading = true, status = "Opening"))
                val url = billingViewModel.createCheckoutSession(tokenProvider())
                if (url.isEmpty()) error("Payment setup did not return a secure URL.")
                setState(getState().copy(loading = false, status = "Billing"))
                activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            } catch (error: Exception) {
                setState(getState().copy(loading = false, error = "Could not open payment setup."))
            }
        }
    }

    fun activateBilling() {
        scope.launch {
            try {
                setState(getState().copy(loading = true, status = "Checking"))
                billingViewModel.activateBilling(tokenProvider())
                refreshData(true, false)
            } catch (error: Exception) {
                setState(getState().copy(loading = false, error = "Could not check billing yet."))
            }
        }
    }
}
