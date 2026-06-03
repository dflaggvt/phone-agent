import { Firestore } from "@google-cloud/firestore";
import Stripe from "stripe";

const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "phone-agent-43313";
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY must be set.");
}

const stripe = new Stripe(stripeSecretKey);
const firestore = new Firestore({ projectId });

const billingAccounts = await firestore.collection("billingAccounts").get();
const rows = [];

for (const doc of billingAccounts.docs) {
  const account = doc.data();
  const customerId = stringValue(account.providerCustomerId);
  const localSubscriptionId = stringValue(account.providerSubscriptionId);
  const localStatus = stringValue(account.status);
  const localSubscriptionStatus = stringValue(account.providerSubscriptionStatus);
  const issues = [];
  let activePersonalSubscriptions = [];
  let stripeCustomerFound = false;

  if (!customerId) {
    issues.push("missing_provider_customer");
  } else {
    try {
      await stripe.customers.retrieve(customerId);
      stripeCustomerFound = true;
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100
      });
      activePersonalSubscriptions = subscriptions.data
        .filter((subscription) =>
          subscription.metadata?.phone_agent_subscription_kind === "personal" &&
          subscription.status === "active"
        )
        .map((subscription) => subscription.id);

      if (activePersonalSubscriptions.length > 1) {
        issues.push("multiple_active_personal_subscriptions");
      }
      if (localStatus === "active" && activePersonalSubscriptions.length === 0) {
        issues.push("local_active_without_stripe_active_subscription");
      }
      if (activePersonalSubscriptions.length === 1 && localSubscriptionId !== activePersonalSubscriptions[0]) {
        issues.push("local_subscription_mismatch");
      }
      if (localSubscriptionStatus === "canceled" && activePersonalSubscriptions.length > 0) {
        issues.push("local_canceled_but_stripe_active");
      }
    } catch (error) {
      issues.push(`stripe_customer_lookup_failed:${safeErrorCode(error)}`);
    }
  }

  rows.push({
    userId: doc.id,
    localStatus,
    localSubscriptionId,
    localSubscriptionStatus,
    customerId,
    stripeCustomerFound,
    activePersonalSubscriptions,
    issues
  });
}

const unhealthy = rows.filter((row) => row.issues.length > 0);
console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  projectId,
  checkedAccounts: rows.length,
  unhealthyAccounts: unhealthy.length,
  accounts: rows
}, null, 2));

if (unhealthy.length > 0) {
  process.exitCode = 2;
}

function stringValue(value) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function safeErrorCode(error) {
  if (error && typeof error === "object") {
    if (typeof error.code === "string") {
      return error.code;
    }
    if (typeof error.type === "string") {
      return error.type;
    }
    if (typeof error.statusCode === "number") {
      return `status_${error.statusCode}`;
    }
  }
  return "unknown";
}

