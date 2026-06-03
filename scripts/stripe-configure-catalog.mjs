import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY must be set.");
}

const stripe = new Stripe(secretKey);

const catalog = {
  products: [
    {
      key: "personal",
      name: "Phone Agent Personal",
      description: "Personal plan with assistant number, included minutes, and capped overage."
    }
  ],
  meters: [
    {
      key: "callMinute",
      eventName: "phone_agent_call_minutes",
      displayName: "Phone Agent assistant call minutes"
    }
  ],
  prices: [
    {
      key: "personalMonthly",
      lookupKey: "phone_agent_personal_monthly_usd",
      productKey: "personal",
      nickname: "Phone Agent Personal monthly plan",
      unitAmount: 1900,
      recurring: { interval: "month" }
    },
    {
      key: "personalCallMinuteOverage",
      lookupKey: "phone_agent_personal_call_minute_overage_usd",
      productKey: "personal",
      meterKey: "callMinute",
      nickname: "Personal plan assistant minute overage",
      billingScheme: "tiered",
      tiersMode: "graduated",
      tiers: [
        { up_to: 50, unit_amount: 0 },
        { up_to: "inf", unit_amount: 39 }
      ],
      recurring: { interval: "month", usage_type: "metered" }
    }
  ]
};

const metadata = {
  app: "phone-agent",
  environment: secretKey.startsWith("sk_test_") ? "test" : "live"
};

async function ensureProduct(definition) {
  for await (const product of stripe.products.list({ limit: 100 })) {
    if (
      product.name === definition.name &&
      product.metadata?.app === metadata.app &&
      product.metadata?.environment === metadata.environment
    ) {
      return product;
    }
  }

  return stripe.products.create({
    name: definition.name,
    description: definition.description,
    metadata
  });
}

async function ensurePrice(definition, productId) {
  const existing = await stripe.prices.list({
    lookup_keys: [definition.lookupKey],
    limit: 1
  });

  if (existing.data[0]) {
    return existing.data[0];
  }

  const recurring = { ...definition.recurring };
  if (definition.meterKey) {
    recurring.meter = metersByKey[definition.meterKey].id;
  }

  const params = {
    currency: "usd",
    product: productId,
    nickname: definition.nickname,
    lookup_key: definition.lookupKey,
    recurring,
    metadata
  };
  if (definition.billingScheme) {
    params.billing_scheme = definition.billingScheme;
  }
  if (definition.tiersMode) {
    params.tiers_mode = definition.tiersMode;
  }
  if (definition.tiers) {
    params.tiers = definition.tiers;
  }
  if (definition.unitAmount !== undefined) {
    params.unit_amount = definition.unitAmount;
  }

  return stripe.prices.create(params);
}

async function ensureMeter(definition) {
  for await (const meter of stripe.billing.meters.list({ limit: 100 })) {
    if (meter.event_name === definition.eventName) {
      if (meter.status === "inactive") {
        return stripe.billing.meters.reactivate(meter.id);
      }
      return meter;
    }
  }

  return stripe.billing.meters.create({
    display_name: definition.displayName,
    event_name: definition.eventName,
    default_aggregation: { formula: "sum" },
    customer_mapping: {
      type: "by_id",
      event_payload_key: "stripe_customer_id"
    },
    value_settings: {
      event_payload_key: "value"
    }
  });
}

const productsByKey = {};
for (const productDefinition of catalog.products) {
  productsByKey[productDefinition.key] = await ensureProduct(productDefinition);
}

const metersByKey = {};
for (const meterDefinition of catalog.meters) {
  metersByKey[meterDefinition.key] = await ensureMeter(meterDefinition);
}

const pricesByKey = {};
for (const priceDefinition of catalog.prices) {
  pricesByKey[priceDefinition.key] = await ensurePrice(
    priceDefinition,
    productsByKey[priceDefinition.productKey].id
  );
}

console.log(JSON.stringify({
  mode: metadata.environment,
  products: Object.fromEntries(Object.entries(productsByKey).map(([key, product]) => [key, product.id])),
  meters: Object.fromEntries(Object.entries(metersByKey).map(([key, meter]) => [
    key,
    {
      id: meter.id,
      eventName: meter.event_name,
      valuePayloadKey: meter.value_settings.event_payload_key,
      customerPayloadKey: meter.customer_mapping.event_payload_key
    }
  ])),
  prices: Object.fromEntries(Object.entries(pricesByKey).map(([key, price]) => [
    key,
    {
      id: price.id,
      lookupKey: price.lookup_key,
      unitAmount: price.unit_amount,
      billingScheme: price.billing_scheme,
      tiersMode: price.tiers_mode,
      recurring: price.recurring
    }
  ]))
}, null, 2));
