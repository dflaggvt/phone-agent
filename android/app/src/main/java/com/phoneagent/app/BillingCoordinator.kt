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
    private var checkoutFlowStarted = false
    private var checkoutLeftApp = false

    fun openBillingManagement() {
        if (getState().billing.status == "active") {
            openCustomerPortal()
        } else {
            openCheckout()
        }
    }

    private fun openCheckout() {
        scope.launch {
            try {
                setState(getState().copy(loading = true, status = "Opening"))
                val url = billingViewModel.createCheckoutSession(tokenProvider())
                if (url.isEmpty()) error("Payment setup did not return a secure URL.")
                checkoutFlowStarted = true
                checkoutLeftApp = false
                setState(getState().copy(loading = false, status = "Billing", error = null))
                activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            } catch (error: Exception) {
                setState(getState().copy(loading = false, error = "Could not open payment setup."))
            }
        }
    }

    private fun openCustomerPortal() {
        scope.launch {
            try {
                setState(getState().copy(loading = true, status = "Opening"))
                val url = billingViewModel.createCustomerPortalSession(tokenProvider())
                if (url.isEmpty()) error("Billing portal did not return a secure URL.")
                checkoutFlowStarted = true
                checkoutLeftApp = false
                setState(getState().copy(loading = false, status = "Billing", error = null))
                activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            } catch (error: Exception) {
                setState(getState().copy(loading = false, error = "Could not open billing management."))
            }
        }
    }

    fun onHostPause() {
        if (checkoutFlowStarted) {
            checkoutLeftApp = true
        }
    }

    fun onHostResume() {
        if (!checkoutFlowStarted || !checkoutLeftApp) {
            return
        }
        checkoutFlowStarted = false
        checkoutLeftApp = false
        activateBilling()
    }

    fun activateBilling() {
        scope.launch {
            try {
                setState(getState().copy(loading = true, status = "Checking"))
                val account = billingViewModel.activateBilling(tokenProvider())
                val nextStatus = if (account.status == "active") "Active" else "Billing"
                setState(getState().copy(loading = false, status = nextStatus, billing = account, error = null))
                refreshData(true, true)
            } catch (error: Exception) {
                setState(getState().copy(loading = false, error = "Could not check billing yet."))
            }
        }
    }

    fun cancelSubscription() {
        scope.launch {
            try {
                setState(getState().copy(loading = true, status = "Canceling", error = null))
                val account = billingViewModel.cancelSubscription(tokenProvider())
                setState(getState().copy(loading = false, status = "Billing", billing = account, error = null))
                refreshData(true, true)
            } catch (error: Exception) {
                setState(getState().copy(loading = false, error = "Could not cancel subscription."))
            }
        }
    }
}
