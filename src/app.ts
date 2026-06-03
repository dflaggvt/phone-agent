import cors from "cors";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import Retell from "retell-sdk";
import { z, ZodError } from "zod";
import { AgentNoteService } from "./application/agentNotes/agentNoteService.js";
import { LiveAnswerService } from "./application/answerRequests/liveAnswerService.js";
import { TransferApprovalService } from "./application/approvals/transferApprovalService.js";
import { BillingAccountService } from "./application/billing/billingAccountService.js";
import { UsageService } from "./application/billing/usageService.js";
import { ActiveCallService } from "./application/calls/activeCallService.js";
import { GoogleCalendarService } from "./application/calendar/googleCalendarService.js";
import { NotificationService } from "./application/notifications/notificationService.js";
import { OutboundCallService } from "./application/retell/outboundCallService.js";
import { RetellWebhookService } from "./application/retell/retellWebhookService.js";
import { TopicSuggestionService } from "./application/topics/topicSuggestionService.js";
import { TopicThreadService } from "./application/topics/topicThreadService.js";
import { UserConfigService } from "./application/users/userConfigService.js";
import { VoiceNumberProvisioningService } from "./application/users/voiceNumberProvisioningService.js";
import type { AuthVerifier } from "./application/auth/authVerifier.js";
import type { AppEnv } from "./config/env.js";
import { FirebaseAuthVerifier } from "./infrastructure/firebase/firebaseAuthVerifier.js";
import { FirebaseCloudMessagingPushClient, NoopPushDeliveryClient } from "./infrastructure/firebase/firebaseCloudMessagingPushClient.js";
import { FirestoreAgentNoteRepository } from "./infrastructure/persistence/firestoreAgentNoteRepository.js";
import { FirestoreProductAnalyticsEventRepository } from "./infrastructure/persistence/firestoreProductAnalyticsEventRepository.js";
import { FirestoreAnswerRequestRepository } from "./infrastructure/persistence/firestoreAnswerRequestRepository.js";
import { FirestoreApprovalRequestRepository } from "./infrastructure/persistence/firestoreApprovalRequestRepository.js";
import { FirestoreBillingAccountRepository } from "./infrastructure/persistence/firestoreBillingAccountRepository.js";
import { FirestoreCalendarConnectionRepository } from "./infrastructure/persistence/firestoreCalendarConnectionRepository.js";
import { FirestoreCalendarEventRequestRepository } from "./infrastructure/persistence/firestoreCalendarEventRequestRepository.js";
import { FirestoreCallerMemoryRepository } from "./infrastructure/persistence/firestoreCallerMemoryRepository.js";
import { FirestoreCallRepository } from "./infrastructure/persistence/firestoreCallRepository.js";
import { FirestoreCommunicationItemRepository } from "./infrastructure/persistence/firestoreCommunicationItemRepository.js";
import { FirestoreContactRepository } from "./infrastructure/persistence/firestoreContactRepository.js";
import { FirestoreNotificationActionAuditRepository } from "./infrastructure/persistence/firestoreNotificationActionAuditRepository.js";
import { FirestoreNotificationDeliveryRepository } from "./infrastructure/persistence/firestoreNotificationDeliveryRepository.js";
import { FirestoreNotificationEventRepository } from "./infrastructure/persistence/firestoreNotificationEventRepository.js";
import { FirestorePushDeviceTokenRepository } from "./infrastructure/persistence/firestorePushDeviceTokenRepository.js";
import { FirestoreRateLimitStore } from "./infrastructure/persistence/firestoreRateLimitStore.js";
import { FirestoreTopicSuggestionRepository } from "./infrastructure/persistence/firestoreTopicSuggestionRepository.js";
import { FirestoreTopicThreadRepository } from "./infrastructure/persistence/firestoreTopicThreadRepository.js";
import { FirestoreUsageEventRepository } from "./infrastructure/persistence/firestoreUsageEventRepository.js";
import { FirestoreUserConfigRepository } from "./infrastructure/persistence/firestoreUserConfigRepository.js";
import { FirestoreWebhookEventRepository } from "./infrastructure/persistence/firestoreWebhookEventRepository.js";
import { createFirestore } from "./infrastructure/persistence/firestoreClient.js";
import { InMemoryAgentNoteRepository } from "./infrastructure/persistence/inMemoryAgentNoteRepository.js";
import { InMemoryProductAnalyticsEventRepository } from "./infrastructure/persistence/inMemoryProductAnalyticsEventRepository.js";
import { InMemoryAnswerRequestRepository } from "./infrastructure/persistence/inMemoryAnswerRequestRepository.js";
import { InMemoryApprovalRequestRepository } from "./infrastructure/persistence/inMemoryApprovalRequestRepository.js";
import { InMemoryBillingAccountRepository } from "./infrastructure/persistence/inMemoryBillingAccountRepository.js";
import { InMemoryCalendarConnectionRepository } from "./infrastructure/persistence/inMemoryCalendarConnectionRepository.js";
import { InMemoryCalendarEventRequestRepository } from "./infrastructure/persistence/inMemoryCalendarEventRequestRepository.js";
import { InMemoryCallerMemoryRepository } from "./infrastructure/persistence/inMemoryCallerMemoryRepository.js";
import { InMemoryCallRepository } from "./infrastructure/persistence/inMemoryCallRepository.js";
import { InMemoryCommunicationItemRepository } from "./infrastructure/persistence/inMemoryCommunicationItemRepository.js";
import { InMemoryContactRepository } from "./infrastructure/persistence/inMemoryContactRepository.js";
import { InMemoryNotificationActionAuditRepository } from "./infrastructure/persistence/inMemoryNotificationActionAuditRepository.js";
import { InMemoryNotificationDeliveryRepository } from "./infrastructure/persistence/inMemoryNotificationDeliveryRepository.js";
import { InMemoryNotificationEventRepository } from "./infrastructure/persistence/inMemoryNotificationEventRepository.js";
import { InMemoryPushDeviceTokenRepository } from "./infrastructure/persistence/inMemoryPushDeviceTokenRepository.js";
import { InMemoryTopicSuggestionRepository } from "./infrastructure/persistence/inMemoryTopicSuggestionRepository.js";
import { InMemoryTopicThreadRepository } from "./infrastructure/persistence/inMemoryTopicThreadRepository.js";
import { InMemoryUsageEventRepository } from "./infrastructure/persistence/inMemoryUsageEventRepository.js";
import { InMemoryUserConfigRepository } from "./infrastructure/persistence/inMemoryUserConfigRepository.js";
import { InMemoryWebhookEventRepository } from "./infrastructure/persistence/inMemoryWebhookEventRepository.js";
import { OpenAiCommunicationClassifier } from "./infrastructure/openai/openAiCommunicationClassifier.js";
import {
  MissingRetellCallClient,
  MissingRetellPhoneNumberClient,
  RetellSdkCallClient,
  RetellSdkPhoneNumberClient
} from "./infrastructure/retell/retellClient.js";
import { RetellWebhookVerifier } from "./infrastructure/retell/retellWebhookVerifier.js";
import { MissingBillingProviderClient, StripeBillingClient } from "./infrastructure/stripe/stripeBillingClient.js";
import { analyticsRoutes } from "./routes/analyticsRoutes.js";
import { billingReturnRoutes, billingRoutes } from "./routes/billingRoutes.js";
import { HttpError, conflict, notFound, unauthorized } from "./shared/httpErrors.js";
import type { AppLogger } from "./shared/logger.js";
import { createRateLimiter } from "./shared/rateLimit.js";
import type { PushDeliveryClient } from "./application/notifications/pushDeliveryClient.js";

export interface AppDependencies {
  env: AppEnv;
  logger: AppLogger;
  authVerifier?: AuthVerifier;
  pushDelivery?: PushDeliveryClient;
}

export function createApp(dependencies: AppDependencies) {
  const app = express();
  const firestore = dependencies.env.PERSISTENCE_DRIVER === "firestore"
    ? createFirestore(dependencies.env.FIRESTORE_DATABASE_ID)
    : undefined;
  const calls = firestore ? new FirestoreCallRepository(firestore) : new InMemoryCallRepository();
  const approvals = firestore
    ? new FirestoreApprovalRequestRepository(firestore)
    : new InMemoryApprovalRequestRepository();
  const billingAccounts = firestore
    ? new FirestoreBillingAccountRepository(firestore)
    : new InMemoryBillingAccountRepository();
  const answerRequestRepository = firestore
    ? new FirestoreAnswerRequestRepository(firestore)
    : new InMemoryAnswerRequestRepository();
  const agentNoteRepository = firestore
    ? new FirestoreAgentNoteRepository(firestore)
    : new InMemoryAgentNoteRepository();
  const productAnalytics = firestore
    ? new FirestoreProductAnalyticsEventRepository(firestore)
    : new InMemoryProductAnalyticsEventRepository();
  const calendarConnections = firestore
    ? new FirestoreCalendarConnectionRepository(firestore)
    : new InMemoryCalendarConnectionRepository();
  const calendarEventRequests = firestore
    ? new FirestoreCalendarEventRequestRepository(firestore)
    : new InMemoryCalendarEventRequestRepository();
  const callerMemory = firestore
    ? new FirestoreCallerMemoryRepository(firestore)
    : new InMemoryCallerMemoryRepository();
  const communicationItems = firestore
    ? new FirestoreCommunicationItemRepository(firestore)
    : new InMemoryCommunicationItemRepository();
  const contacts = firestore
    ? new FirestoreContactRepository(firestore)
    : new InMemoryContactRepository();
  const notificationRepository = firestore
    ? new FirestoreNotificationEventRepository(firestore)
    : new InMemoryNotificationEventRepository();
  const notificationActionAudits = firestore
    ? new FirestoreNotificationActionAuditRepository(firestore)
    : new InMemoryNotificationActionAuditRepository();
  const notificationDeliveries = firestore
    ? new FirestoreNotificationDeliveryRepository(firestore)
    : new InMemoryNotificationDeliveryRepository();
  const pushDeviceTokens = firestore
    ? new FirestorePushDeviceTokenRepository(firestore)
    : new InMemoryPushDeviceTokenRepository();
  const topicThreadRepository = firestore
    ? new FirestoreTopicThreadRepository(firestore)
    : new InMemoryTopicThreadRepository();
  const topicSuggestionRepository = firestore
    ? new FirestoreTopicSuggestionRepository(firestore)
    : new InMemoryTopicSuggestionRepository();
  const userConfigRepository = firestore
    ? new FirestoreUserConfigRepository(firestore)
    : new InMemoryUserConfigRepository();
  const usageRepository = firestore
    ? new FirestoreUsageEventRepository(firestore)
    : new InMemoryUsageEventRepository();
  const webhookEvents = firestore
    ? new FirestoreWebhookEventRepository(firestore)
    : new InMemoryWebhookEventRepository();
  const rateLimitStore = firestore ? new FirestoreRateLimitStore(firestore) : undefined;
  const userConfigs = new UserConfigService({
    users: userConfigRepository,
    defaultConfig: {
      userId: "unresolved",
      billing: {
        plan: dependencies.env.BILLING_PLAN,
        monthlyIncludedMinutes: dependencies.env.BILLING_MONTHLY_INCLUDED_MINUTES,
        monthlyClassificationLimit: dependencies.env.BILLING_MONTHLY_CLASSIFICATION_LIMIT,
        retellNumberProvisioningAllowed: dependencies.env.SELF_SERVE_RETELL_PROVISIONING
      }
    }
  });
  const authVerifier = dependencies.authVerifier ?? new FirebaseAuthVerifier(dependencies.env.FIREBASE_PROJECT_ID);
  const billingProvider = dependencies.env.STRIPE_SECRET_KEY
    ? new StripeBillingClient(dependencies.env.STRIPE_SECRET_KEY, dependencies.env.STRIPE_WEBHOOK_SECRET)
    : new MissingBillingProviderClient();
  const pushDelivery = dependencies.pushDelivery ?? (
    firestore
      ? new FirebaseCloudMessagingPushClient(dependencies.env.FIREBASE_PROJECT_ID)
      : new NoopPushDeliveryClient()
  );
  const notifications = new NotificationService({
    notifications: notificationRepository,
    pushDeviceTokens,
    actionAudits: notificationActionAudits,
    deliveries: notificationDeliveries,
    pushDelivery,
    logger: dependencies.logger
  });
  const usage = new UsageService({
    usage: usageRepository,
    users: userConfigRepository,
    billingAccounts,
    billingProvider,
    logger: dependencies.logger
  });
  const billing = new BillingAccountService({
    billingAccounts,
    users: userConfigs,
    provider: billingProvider,
    webhookEvents,
    notifications,
    publicBaseUrl: dependencies.env.APP_PUBLIC_BASE_URL,
    defaultSpendingCapCents: dependencies.env.BILLING_DEFAULT_SPENDING_CAP_CENTS,
    billingRequiredForProvisioning: dependencies.env.BILLING_REQUIRED_FOR_PROVISIONING,
    prices: {
      personalMonthlyPriceId: dependencies.env.STRIPE_PRICE_PERSONAL_MONTHLY,
      personalCallMinuteOveragePriceId: dependencies.env.STRIPE_PRICE_PERSONAL_CALL_MINUTE_OVERAGE
    }
  });
  const retellCallClient = dependencies.env.RETELL_API_KEY
    ? new RetellSdkCallClient(dependencies.env.RETELL_API_KEY)
    : new MissingRetellCallClient();
  const retellPhoneNumberClient = dependencies.env.RETELL_API_KEY
    ? new RetellSdkPhoneNumberClient(dependencies.env.RETELL_API_KEY)
    : new MissingRetellPhoneNumberClient();

  const retellVerifier = new RetellWebhookVerifier({
    enabled: dependencies.env.RETELL_INBOUND_WEBHOOK_VERIFY,
    apiKey: dependencies.env.RETELL_API_KEY,
    sdk: {
      verify: Retell.verify
    }
  });

  const topicThreads = new TopicThreadService({
    topics: topicThreadRepository,
    communicationItems
  });

  const topicSuggestions = new TopicSuggestionService({
    suggestions: topicSuggestionRepository,
    topics: topicThreadRepository,
    communicationItems,
    classifier: dependencies.env.OPENAI_API_KEY
      ? new OpenAiCommunicationClassifier({
        apiKey: dependencies.env.OPENAI_API_KEY,
        model: dependencies.env.OPENAI_CLASSIFIER_MODEL
      })
      : undefined,
    usage,
    notifications,
    logger: dependencies.logger
  });

  const retellWebhooks = new RetellWebhookService({
    calls,
    callerMemory,
    contacts,
    communicationItems,
    topicSuggestions,
    notifications,
    users: userConfigs,
    billing,
    usage,
    agentNotes: new AgentNoteService({ notes: agentNoteRepository }),
    webhookEvents,
    verifier: retellVerifier,
    logger: dependencies.logger,
    defaultAgentId: dependencies.env.RETELL_DEFAULT_AGENT_ID
  });

  const transferApprovals = new TransferApprovalService({
    approvals,
    notifications,
    logger: dependencies.logger,
    transferToNumber: dependencies.env.USER_TRANSFER_PHONE_NUMBER,
    timeoutMs: dependencies.env.LIVE_REQUEST_TIMEOUT_MS,
    pollIntervalMs: 1000
  });

  const liveAnswers = new LiveAnswerService({
    answerRequests: answerRequestRepository,
    notifications,
    logger: dependencies.logger,
    timeoutMs: dependencies.env.LIVE_REQUEST_TIMEOUT_MS,
    pollIntervalMs: 1000
  });

  const agentNotes = new AgentNoteService({ notes: agentNoteRepository });

  const outboundCalls = new OutboundCallService({
    retell: retellCallClient,
    calls,
    logger: dependencies.logger,
    defaultAgentId: dependencies.env.RETELL_DEFAULT_AGENT_ID,
    defaultFromNumber: dependencies.env.RETELL_DEFAULT_FROM_NUMBER
  });

  const voiceNumberProvisioning = new VoiceNumberProvisioningService({
    users: userConfigs,
    retellPhoneNumbers: retellPhoneNumberClient,
    defaultRetellAgentId: dependencies.env.RETELL_DEFAULT_AGENT_ID,
    publicBaseUrl: dependencies.env.APP_PUBLIC_BASE_URL,
    selfServeProvisioningEnabled: dependencies.env.SELF_SERVE_RETELL_PROVISIONING
  });

  const activeCalls = new ActiveCallService({
    calls,
    callerMemory,
    approvals,
    answerRequests: answerRequestRepository
  });

  const calendar = new GoogleCalendarService({
    connections: calendarConnections,
    eventRequests: calendarEventRequests,
    notifications,
    logger: dependencies.logger,
    config: {
      clientId: dependencies.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: dependencies.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirectUri: dependencies.env.GOOGLE_OAUTH_REDIRECT_URI,
      stateSecret: dependencies.env.GOOGLE_OAUTH_STATE_SECRET
    },
    timeoutMs: 60_000,
    pollIntervalMs: 1000
  });

  app.use(helmet());
  app.use(cors());
  app.use(pinoHttp({ logger: dependencies.logger }));

  const clientRateLimiter = createRateLimiter({
    keyPrefix: "client",
    windowMs: dependencies.env.RATE_LIMIT_WINDOW_MS,
    maxRequests: dependencies.env.RATE_LIMIT_MAX_REQUESTS
  }, rateLimitStore);
  const providerRateLimiter = createRateLimiter({
    keyPrefix: "provider",
    windowMs: dependencies.env.RATE_LIMIT_WINDOW_MS,
    maxRequests: dependencies.env.WEBHOOK_RATE_LIMIT_MAX_REQUESTS
  }, rateLimitStore);

  const healthHandler: RequestHandler = (_req, res) => {
    res.status(200).json({ status: "ok" });
  };

  app.get("/", healthHandler);
  app.get("/healthz", healthHandler);
  app.get("/readyz", healthHandler);
  app.use("/billing", billingReturnRoutes());

  const rawJson = express.raw({ type: "application/json", limit: "2mb" });

  app.post("/webhooks/retell/inbound", providerRateLimiter, rawJson, asyncHandler(async (req, res) => {
    const decision = await retellWebhooks.handleInbound(rawBody(req), req.headers["x-retell-signature"]);
    res.status(200).json(decision);
  }));

  app.post("/webhooks/retell/events", providerRateLimiter, rawJson, asyncHandler(async (req, res) => {
    await retellWebhooks.handleCallEvent(rawBody(req), req.headers["x-retell-signature"]);
    res.status(204).send();
  }));

  app.post("/webhooks/billing/stripe", providerRateLimiter, rawJson, asyncHandler(async (req, res) => {
    const result = await billing.handleStripeWebhook(rawBody(req), req.headers["stripe-signature"]);
    res.status(200).json(result);
  }));

  app.post("/tools/retell/request-transfer", providerRateLimiter, rawJson, asyncHandler(async (req, res) => {
    await retellVerifier.verify(rawBody(req), req.headers["x-retell-signature"]);
    const request = retellTransferToolSchema.parse(JSON.parse(rawBody(req)));
    const billingGate = await retellToolBillingGate(billing, retellToolUserId(request));
    if (!billingGate.allowed) {
      res.status(200).json({ status: "unavailable", message: billingGate.message });
      return;
    }
    const args = request.args ?? {};
    const result = await transferApprovals.requestAndWait({
      userId: request.call?.retell_llm_dynamic_variables?.phone_agent_user_id,
      providerCallId: request.call?.call_id,
      callerNumber: request.call?.from_number,
      callerName: args.caller_name ?? request.call?.retell_llm_dynamic_variables?.caller_name,
      reason: args.reason ?? "Caller requested live attention.",
      urgency: args.urgency,
      transferToNumber: request.call?.retell_llm_dynamic_variables?.user_transfer_phone_number
    });
    res.status(200).json(result);
  }));

  app.post("/tools/retell/request-user-answer", providerRateLimiter, rawJson, asyncHandler(async (req, res) => {
    await retellVerifier.verify(rawBody(req), req.headers["x-retell-signature"]);
    const request = retellAnswerToolSchema.parse(JSON.parse(rawBody(req)));
    const billingGate = await retellToolBillingGate(billing, retellToolUserId(request));
    if (!billingGate.allowed) {
      res.status(200).json({ status: "unavailable", message: billingGate.message });
      return;
    }
    const args = request.args ?? {};
    const result = await liveAnswers.requestAndWait({
      userId: request.call?.retell_llm_dynamic_variables?.phone_agent_user_id,
      providerCallId: request.call?.call_id,
      callerNumber: request.call?.from_number,
      callerName: args.caller_name ?? request.call?.retell_llm_dynamic_variables?.caller_name,
      question: args.question,
      reason: args.reason,
      urgency: args.urgency
    });
    res.status(200).json(result);
  }));

  app.post("/tools/retell/check-calendar-freebusy", providerRateLimiter, rawJson, asyncHandler(async (req, res) => {
    await retellVerifier.verify(rawBody(req), req.headers["x-retell-signature"]);
    const request = retellFreeBusyToolSchema.parse(JSON.parse(rawBody(req)));
    const billingGate = await retellToolBillingGate(billing, retellToolUserId(request));
    if (!billingGate.allowed) {
      res.status(200).json({ connected: false, status: "unavailable", message: billingGate.message });
      return;
    }
    if (!calendar.isConfigured()) {
      res.status(200).json({ connected: false, status: "unavailable", message: "Google Calendar OAuth is not configured." });
      return;
    }
    const userId = retellToolUserId(request);
    if (!userId) {
      res.status(200).json({ connected: false, status: "unavailable", message: "The assistant account could not be verified." });
      return;
    }
    const status = await calendar.status(userId);
    if (!status.connected) {
      res.status(200).json({ connected: false, status: "unavailable", message: "The user's Google Calendar is not connected." });
      return;
    }
    const result = await calendar.checkFreeBusy({
      userId,
      timeMin: new Date(request.args.time_min),
      timeMax: new Date(request.args.time_max),
      timeZone: request.args.time_zone
    });
    res.status(200).json(result);
  }));

  app.post("/tools/retell/request-calendar-event", providerRateLimiter, rawJson, asyncHandler(async (req, res) => {
    await retellVerifier.verify(rawBody(req), req.headers["x-retell-signature"]);
    const request = retellCalendarEventToolSchema.parse(JSON.parse(rawBody(req)));
    const billingGate = await retellToolBillingGate(billing, retellToolUserId(request));
    if (!billingGate.allowed) {
      res.status(200).json({ status: "unavailable", message: billingGate.message });
      return;
    }
    const args = request.args;
    const userId = retellToolUserId(request);
    if (!userId) {
      res.status(200).json({ status: "unavailable", message: "The assistant account could not be verified. Take a concise message instead." });
      return;
    }
    const result = await calendar.createCalendarEvent({
      userId,
      providerCallId: request.call?.call_id,
      callerNumber: request.call?.from_number,
      callerName: args.caller_name ?? request.call?.retell_llm_dynamic_variables?.caller_name,
      title: args.title,
      description: args.description,
      startTime: new Date(args.start_time),
      endTime: new Date(args.end_time),
      timeZone: args.time_zone,
      reason: args.reason
    });
    res.status(200).json(result);
  }));

  app.post("/tools/retell/update-calendar-event", providerRateLimiter, rawJson, asyncHandler(async (req, res) => {
    await retellVerifier.verify(rawBody(req), req.headers["x-retell-signature"]);
    const request = retellCalendarEventUpdateToolSchema.parse(JSON.parse(rawBody(req)));
    const billingGate = await retellToolBillingGate(billing, retellToolUserId(request));
    if (!billingGate.allowed) {
      res.status(200).json({ status: "unavailable", message: billingGate.message });
      return;
    }
    const args = request.args;
    const userId = retellToolUserId(request);
    if (!userId) {
      res.status(200).json({ status: "unavailable", message: "The assistant account could not be verified. Take a concise message instead." });
      return;
    }
    const result = await calendar.updateCalendarEvent({
      userId,
      providerCallId: request.call?.call_id,
      callerNumber: request.call?.from_number,
      callerName: args.caller_name ?? request.call?.retell_llm_dynamic_variables?.caller_name,
      calendarEventRequestId: args.calendar_event_request_id,
      calendarEventId: args.calendar_event_id,
      title: args.title,
      description: args.description,
      startTime: args.start_time ? new Date(args.start_time) : undefined,
      endTime: args.end_time ? new Date(args.end_time) : undefined,
      timeZone: args.time_zone,
      reason: args.reason
    });
    res.status(200).json(result);
  }));

  app.use(express.json({ limit: "1mb" }));
  app.use("/v1", clientRateLimiter);
  app.use("/v1", firebaseAuth({ verifier: authVerifier, users: userConfigs }));
  app.use("/v1/billing", billingRoutes({ billing, usage }));
  app.use("/v1/analytics", analyticsRoutes({ productAnalytics }));

  app.get("/v1/calls", asyncHandler(async (_req, res) => {
    const userConfig = await userConfigs.getOrCreate(currentUserId(res));
    const sessions = await calls.listCallsForRoute(userConfig.phoneRouting.retellPhoneNumber ?? "");
    res.status(200).json({ calls: sessions });
  }));

  app.get("/v1/calls/active", asyncHandler(async (_req, res) => {
    const userConfig = await userConfigs.getOrCreate(currentUserId(res));
    const activeCall = await activeCalls.getActiveCall({
      userId: userConfig.userId,
      userRetellPhoneNumber: userConfig.phoneRouting.retellPhoneNumber
    });
    res.status(200).json({ activeCall: activeCall ?? null });
  }));

  app.get("/v1/me", asyncHandler(async (_req, res) => {
    const config = await userConfigs.getOrCreate(currentUserId(res));
    res.status(200).json({ user: redactedUserConfig(config) });
  }));

  app.patch("/v1/me/config", asyncHandler(async (req, res) => {
    const input = userConfigUpdateSchema.parse(req.body);
    const config = await userConfigs.upsert({
      userId: currentUserId(res),
      displayName: input.displayName,
      phoneRouting: input.phoneRouting,
      billing: input.billing
    });
    res.status(200).json({ user: redactedUserConfig(config) });
  }));

  app.patch("/v1/me/assistant-profile", asyncHandler(async (req, res) => {
    const input = assistantProfileUpdateSchema.parse(req.body);
    const config = await userConfigs.updateAssistantProfile(currentUserId(res), input);
    res.status(200).json({ user: redactedUserConfig(config), assistantProfile: config.assistantProfile });
  }));

  app.post("/v1/onboarding/assistant-number", asyncHandler(async (req, res) => {
    const input = assistantNumberAssignmentSchema.parse(req.body);
    await billing.assertPaidInfrastructureAllowed(currentUserId(res));
    const assignment = await voiceNumberProvisioning.assignRetellNumber({
      userId: currentUserId(res),
      areaCode: input.areaCode,
      phoneNumber: input.phoneNumber
    });
    const config = await userConfigs.getOrCreate(currentUserId(res));
    res.status(200).json({ assignment, user: redactedUserConfig(config) });
  }));

  app.post("/v1/onboarding/forwarding-instructions-viewed", asyncHandler(async (_req, res) => {
    const config = await userConfigs.upsert({
      userId: currentUserId(res),
      phoneRouting: {
        forwardingInstructionsViewedAt: new Date()
      }
    });
    res.status(200).json({ user: redactedUserConfig(config) });
  }));

  app.get("/v1/notifications", asyncHandler(async (req, res) => {
    const unreadOnly = req.query.unread === "true";
    const events = await notifications.list(currentUserId(res), unreadOnly);
    res.status(200).json({ notifications: events.map(redactedNotificationEvent) });
  }));

  app.get("/v1/notifications/action-audits", asyncHandler(async (_req, res) => {
    const audits = await notifications.listActionAudits(currentUserId(res));
    res.status(200).json({ audits });
  }));

  app.get("/v1/notifications/deliveries", asyncHandler(async (_req, res) => {
    const deliveries = await notifications.listDeliveries(currentUserId(res));
    res.status(200).json({ deliveries });
  }));

  app.post("/v1/push-tokens", asyncHandler(async (req, res) => {
    const input = pushTokenRegistrationSchema.parse(req.body);
    const token = await notifications.registerPushDeviceToken({
      userId: currentUserId(res),
      token: input.token,
      platform: input.platform,
      deviceId: input.deviceId,
      appVersion: input.appVersion
    });
    res.status(200).json({
      pushToken: token
        ? {
          id: token.id,
          platform: token.platform,
          status: token.status,
          lastSeenAt: token.lastSeenAt,
          updatedAt: token.updatedAt
        }
        : { status: "unavailable" }
    });
  }));

  app.post("/v1/notifications/:notificationId/read", asyncHandler(async (req, res) => {
    const notificationId = requireRouteParam(req.params.notificationId, "notificationId");
    const event = await notifications.markRead(notificationId, currentUserId(res));
    if (!event) {
      throw notFound("notification_not_found", "Notification was not found.");
    }
    res.status(200).json({ notification: redactedNotificationEvent(event) });
  }));

  app.post("/v1/notifications/:notificationId/dismiss", asyncHandler(async (req, res) => {
    const notificationId = requireRouteParam(req.params.notificationId, "notificationId");
    const event = await notifications.dismiss(notificationId, currentUserId(res));
    if (!event) {
      throw notFound("notification_not_found", "Notification was not found.");
    }
    res.status(200).json({ notification: redactedNotificationEvent(event) });
  }));

  app.get("/v1/onboarding/status", asyncHandler(async (_req, res) => {
    const userId = currentUserId(res);
    const userConfig = await userConfigs.getOrCreate(userId);
    const [communicationList, callList] = await Promise.all([
      communicationItems.listRecentForUser(userId, 10),
      calls.listCalls()
    ]);
    const billingAccount = await billing.getOrCreateAccount(userId);
    const billingRequired = dependencies.env.BILLING_REQUIRED_FOR_PROVISIONING;

    const hasCompletedCall = callList.some((call) => call.status === "completed" || Boolean(call.summary?.text));
    const hasUsefulCommunication = communicationList.some((item) =>
      Boolean(item.summary)
      || item.extractedFacts.length > 0
      || item.extractedTasks.length > 0
      || item.extractedDecisions.length > 0
      || item.extractedOpenQuestions.length > 0
    );
    const checklist = [
      {
        id: "account",
        label: "Create account",
        complete: Boolean(userConfig.onboarding.accountCreatedAt),
        action: "account"
      },
      {
        id: "phone_verification",
        label: "Verify your mobile number",
        complete: Boolean(userConfig.auth.primaryPhoneVerifiedAt),
        action: "verify_phone"
      },
      {
        id: "assistant_profile",
        label: "Name your assistant",
        complete: Boolean(userConfig.onboarding.assistantProfileConfiguredAt),
        action: "assistant_name"
      },
      ...(billingRequired
        ? [{
          id: "billing",
          label: "Add payment method and spending cap",
          complete: billingAccount.status === "active",
          action: "billing"
        }]
        : []),
      {
        id: "assistant_number",
        label: "Assign assistant forwarding number",
        complete: Boolean(userConfig.phoneRouting.retellPhoneNumber),
        action: "assistant_number"
      },
      {
        id: "forwarding",
        label: "Configure carrier call forwarding",
        complete: Boolean(userConfig.phoneRouting.forwardingInstructionsViewedAt) || hasCompletedCall,
        action: "forwarding"
      },
      {
        id: "test_call",
        label: "Make a test call",
        complete: callList.length > 0,
        action: "call"
      },
      {
        id: "first_useful_call",
        label: "Review first useful handled call",
        complete: hasCompletedCall && hasUsefulCommunication,
        action: "inbox"
      }
    ];

    const completedCount = checklist.filter((item) => item.complete).length;
    const requiredActivationComplete = checklist
      .filter((item) => item.id !== "first_useful_call")
      .every((item) => item.complete);
    res.status(200).json({
      status: {
        readyForBetaUse: requiredActivationComplete && hasCompletedCall,
        completedCount,
        totalCount: checklist.length,
        nextAction: checklist.find((item) => !item.complete) ?? null,
        checklist,
        activation: {
          accountCreated: Boolean(userConfig.onboarding.accountCreatedAt),
          phoneVerified: Boolean(userConfig.auth.primaryPhoneVerifiedAt),
          assistantProfileConfigured: Boolean(userConfig.onboarding.assistantProfileConfiguredAt),
          billingRequired,
          billingActive: billingAccount.status === "active",
          assistantNumberAssigned: Boolean(userConfig.phoneRouting.retellPhoneNumber),
          firstCallReceived: callList.length > 0,
          firstUsefulHandledCall: hasCompletedCall && hasUsefulCommunication,
          communicationCount: communicationList.length
        }
      }
    });
  }));

  app.get("/v1/communications", asyncHandler(async (_req, res) => {
    const items = await communicationItems.listRecentForUser(currentUserId(res));
    res.status(200).json({ communicationItems: items });
  }));

  app.get("/v1/communications/:communicationItemId", asyncHandler(async (req, res) => {
    const communicationItemId = requireRouteParam(req.params.communicationItemId, "communicationItemId");
    const item = await communicationItems.get(communicationItemId);
    if (!item || item.userId !== currentUserId(res)) {
      throw notFound("communication_item_not_found", "Communication item was not found.");
    }
    res.status(200).json({ communicationItem: item });
  }));

  app.get("/v1/topics", asyncHandler(async (_req, res) => {
    const topics = await topicThreads.list(currentUserId(res));
    res.status(200).json({ topics });
  }));

  app.post("/v1/topics", asyncHandler(async (req, res) => {
    const input = topicCreateSchema.parse(req.body);
    const topic = await topicThreads.create({ userId: currentUserId(res), ...input });
    res.status(201).json({ topic });
  }));

  app.get("/v1/topics/:topicThreadId", asyncHandler(async (req, res) => {
    const topicThreadId = requireRouteParam(req.params.topicThreadId, "topicThreadId");
    const topic = await topicThreads.get(topicThreadId);
    if (!topic || topic.userId !== currentUserId(res)) {
      throw notFound("topic_thread_not_found", "Topic thread was not found.");
    }
    res.status(200).json({ topic });
  }));

  app.post("/v1/topics/:topicThreadId/communications", asyncHandler(async (req, res) => {
    const topicThreadId = requireRouteParam(req.params.topicThreadId, "topicThreadId");
    const input = topicAttachCommunicationSchema.parse(req.body);
    const item = await communicationItems.get(input.communicationItemId);
    if (!item || item.userId !== currentUserId(res)) {
      throw notFound("communication_item_not_found", "Communication item was not found.");
    }
    const existingTopic = await topicThreads.get(topicThreadId);
    if (!existingTopic || existingTopic.userId !== currentUserId(res)) {
      throw notFound("topic_thread_not_found", "Topic thread was not found.");
    }
    const topic = await topicThreads.attachCommunication({ topicThreadId, ...input });
    if (!topic) {
      throw notFound("topic_thread_not_found", "Topic thread was not found.");
    }
    res.status(200).json({ topic });
  }));

  app.post("/v1/topics/:topicThreadId/decisions", asyncHandler(async (req, res) => {
    const topicThreadId = requireRouteParam(req.params.topicThreadId, "topicThreadId");
    const input = decisionCreateSchema.parse(req.body);
    await requireUserTopic(topicThreads, topicThreadId, currentUserId(res));
    const topic = await topicThreads.addDecision(topicThreadId, input);
    if (!topic) {
      throw notFound("topic_thread_not_found", "Topic thread was not found.");
    }
    res.status(201).json({ topic, decision: topic.decisions.at(-1) });
  }));

  app.post("/v1/topics/:topicThreadId/open-questions", asyncHandler(async (req, res) => {
    const topicThreadId = requireRouteParam(req.params.topicThreadId, "topicThreadId");
    const input = openQuestionCreateSchema.parse(req.body);
    await requireUserTopic(topicThreads, topicThreadId, currentUserId(res));
    const topic = await topicThreads.addOpenQuestion(topicThreadId, input);
    if (!topic) {
      throw notFound("topic_thread_not_found", "Topic thread was not found.");
    }
    res.status(201).json({ topic, openQuestion: topic.openQuestions.at(-1) });
  }));

  app.post("/v1/topics/:topicThreadId/tasks", asyncHandler(async (req, res) => {
    const topicThreadId = requireRouteParam(req.params.topicThreadId, "topicThreadId");
    const input = topicTaskCreateSchema.parse(req.body);
    await requireUserTopic(topicThreads, topicThreadId, currentUserId(res));
    const topic = await topicThreads.addTask(topicThreadId, input);
    if (!topic) {
      throw notFound("topic_thread_not_found", "Topic thread was not found.");
    }
    res.status(201).json({ topic, task: topic.tasks.at(-1) });
  }));

  app.get("/v1/topic-suggestions", asyncHandler(async (_req, res) => {
    const suggestions = await topicSuggestions.listPending(currentUserId(res));
    res.status(200).json({ suggestions });
  }));

  app.post("/v1/topic-suggestions/:suggestionId/accept", asyncHandler(async (req, res) => {
    const suggestionId = requireRouteParam(req.params.suggestionId, "suggestionId");
    const result = await topicSuggestions.acceptSuggestion(suggestionId, currentUserId(res));
    if (!result) {
      throw notFound("topic_suggestion_not_found", "Topic suggestion was not found.");
    }
    res.status(200).json(result);
  }));

  app.post("/v1/topic-suggestions/:suggestionId/dismiss", asyncHandler(async (req, res) => {
    const suggestionId = requireRouteParam(req.params.suggestionId, "suggestionId");
    const suggestion = await topicSuggestions.dismissSuggestion(suggestionId, currentUserId(res));
    if (!suggestion) {
      throw notFound("topic_suggestion_not_found", "Topic suggestion was not found.");
    }
    res.status(200).json({ suggestion });
  }));

  app.get("/v1/calendar/status", asyncHandler(async (_req, res) => {
    res.status(200).json(await calendar.status(currentUserId(res)));
  }));

  app.get("/v1/calendar/connect-url", asyncHandler(async (_req, res) => {
    if (!calendar.isConfigured()) {
      throw new HttpError(400, "google_calendar_oauth_not_configured", "Google Calendar OAuth credentials are not configured.");
    }
    res.status(200).json({ url: calendar.getConnectUrl(currentUserId(res)) });
  }));

  app.get("/oauth/google/calendar/callback", asyncHandler(async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const state = typeof req.query.state === "string" ? req.query.state : undefined;
    if (!code) {
      throw new HttpError(400, "oauth_code_missing", "Google OAuth callback did not include a code.");
    }
    await calendar.handleCallback(code, state);
    res.status(200).send("<html><body><h1>Google Calendar connected</h1><p>You can return to Phone Agent.</p></body></html>");
  }));

  app.post("/v1/calendar/disconnect", asyncHandler(async (_req, res) => {
    const connection = await calendar.disconnect(currentUserId(res));
    res.status(200).json({ connection: connection ?? null });
  }));

  app.get("/v1/calendar/event-requests", asyncHandler(async (_req, res) => {
    const eventRequests = await calendar.listRecentEventRequests(currentUserId(res));
    res.status(200).json({ eventRequests });
  }));

  app.post("/v1/calendar/event-requests/:eventRequestId/accept", asyncHandler(async (req, res) => {
    const eventRequestId = requireRouteParam(req.params.eventRequestId, "eventRequestId");
    const eventRequest = await calendar.acceptEventRequest(eventRequestId, currentUserId(res));
    if (!eventRequest) {
      throw notFound("calendar_event_request_not_found", "Calendar event request was not found.");
    }
    res.status(200).json({ eventRequest });
  }));

  app.post("/v1/calendar/event-requests/:eventRequestId/decline", asyncHandler(async (req, res) => {
    const eventRequestId = requireRouteParam(req.params.eventRequestId, "eventRequestId");
    const eventRequest = await calendar.declineEventRequest(eventRequestId, currentUserId(res));
    if (!eventRequest) {
      throw notFound("calendar_event_request_not_found", "Calendar event request was not found.");
    }
    res.status(200).json({ eventRequest });
  }));

  app.get("/v1/callers", asyncHandler(async (_req, res) => {
    const callers = await callerMemory.listProfiles(currentUserId(res));
    res.status(200).json({ callers });
  }));

  app.get("/v1/contacts/status", asyncHandler(async (_req, res) => {
    const status = await contacts.statusForUser(currentUserId(res));
    res.status(200).json({ status });
  }));

  app.post("/v1/contacts/sync", asyncHandler(async (req, res) => {
    const input = contactSyncSchema.parse(req.body);
    const result = await contacts.syncForUser(currentUserId(res), input.contacts);
    res.status(200).json({ result });
  }));

  app.get("/v1/callers/:callerId", asyncHandler(async (req, res) => {
    const callerId = requireRouteParam(req.params.callerId, "callerId");
    const caller = await callerMemory.getProfile(currentUserId(res), callerId);
    if (!caller) {
      throw notFound("caller_not_found", "Caller profile was not found.");
    }
    res.status(200).json({ caller });
  }));

  app.patch("/v1/callers/:callerId", asyncHandler(async (req, res) => {
    const callerId = requireRouteParam(req.params.callerId, "callerId");
    const input = updateCallerProfileSchema.parse(req.body);
    const caller = await callerMemory.updateProfile(currentUserId(res), callerId, input);
    if (!caller) {
      throw notFound("caller_not_found", "Caller profile was not found.");
    }
    res.status(200).json({ caller });
  }));

  app.get("/v1/approval-requests", asyncHandler(async (_req, res) => {
    const approvalRequests = await transferApprovals.listPending(currentUserId(res));
    res.status(200).json({ approvalRequests });
  }));

  app.post("/v1/approval-requests/:approvalRequestId/accept", asyncHandler(async (req, res) => {
    const approvalRequestId = requireRouteParam(req.params.approvalRequestId, "approvalRequestId");
    const approvalRequest = await transferApprovals.accept(approvalRequestId, currentUserId(res), notificationActionSurface(req));
    if (!approvalRequest) {
      throw notFound("approval_request_not_found", "Approval request was not found.");
    }
    if (approvalRequest.status === "expired") {
      throw conflict("approval_request_expired", "This transfer request expired.");
    }
    res.status(200).json({ approvalRequest });
  }));

  app.post("/v1/approval-requests/:approvalRequestId/decline", asyncHandler(async (req, res) => {
    const approvalRequestId = requireRouteParam(req.params.approvalRequestId, "approvalRequestId");
    const approvalRequest = await transferApprovals.decline(approvalRequestId, currentUserId(res), notificationActionSurface(req));
    if (!approvalRequest) {
      throw notFound("approval_request_not_found", "Approval request was not found.");
    }
    if (approvalRequest.status === "expired") {
      throw conflict("approval_request_expired", "This transfer request expired.");
    }
    res.status(200).json({ approvalRequest });
  }));

  app.get("/v1/answer-requests", asyncHandler(async (_req, res) => {
    const answerRequests = await liveAnswers.listPending(currentUserId(res));
    res.status(200).json({ answerRequests });
  }));

  app.post("/v1/answer-requests/:answerRequestId/reply", asyncHandler(async (req, res) => {
    const answerRequestId = requireRouteParam(req.params.answerRequestId, "answerRequestId");
    const input = answerRequestReplySchema.parse(req.body);
    const answerRequest = await liveAnswers.answer(answerRequestId, input.answer, currentUserId(res), notificationActionSurface(req));
    if (!answerRequest) {
      throw notFound("answer_request_not_found", "Answer request was not found.");
    }
    if (answerRequest.status === "expired") {
      throw conflict("answer_request_expired", "This answer request expired.");
    }
    res.status(200).json({ answerRequest });
  }));

  app.post("/v1/answer-requests/:answerRequestId/decline", asyncHandler(async (req, res) => {
    const answerRequestId = requireRouteParam(req.params.answerRequestId, "answerRequestId");
    const answerRequest = await liveAnswers.decline(answerRequestId, currentUserId(res), notificationActionSurface(req));
    if (!answerRequest) {
      throw notFound("answer_request_not_found", "Answer request was not found.");
    }
    if (answerRequest.status === "expired") {
      throw conflict("answer_request_expired", "This answer request expired.");
    }
    res.status(200).json({ answerRequest });
  }));

  app.get("/v1/agent-notes", asyncHandler(async (_req, res) => {
    const notes = await agentNotes.list(currentUserId(res));
    res.status(200).json({ notes });
  }));

  app.post("/v1/agent-notes", asyncHandler(async (req, res) => {
    const input = agentNoteCreateSchema.parse(req.body);
    const note = await agentNotes.create({ userId: currentUserId(res), ...input });
    res.status(201).json({ note });
  }));

  app.patch("/v1/agent-notes/:noteId", asyncHandler(async (req, res) => {
    const noteId = requireRouteParam(req.params.noteId, "noteId");
    const input = agentNoteUpdateSchema.parse(req.body);
    const note = await agentNotes.update(noteId, currentUserId(res), input);
    if (!note) {
      throw notFound("agent_note_not_found", "Agent note was not found.");
    }
    res.status(200).json({ note });
  }));

  app.delete("/v1/agent-notes/:noteId", asyncHandler(async (req, res) => {
    const noteId = requireRouteParam(req.params.noteId, "noteId");
    const note = await agentNotes.archive(noteId, currentUserId(res));
    if (!note) {
      throw notFound("agent_note_not_found", "Agent note was not found.");
    }
    res.status(200).json({ note });
  }));

  app.post("/v1/outbound-calls", asyncHandler(async (req, res) => {
    await billing.assertPaidRuntimeAllowed(currentUserId(res));
    const created = await outboundCalls.createApprovedCall(req.body);
    res.status(201).json(created);
  }));

  app.use(errorHandler(dependencies.logger));

  return app;
}

const updateCallerProfileSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  organization: z.string().min(1).max(200).optional(),
  relationship: z
    .enum(["unknown", "family", "close_friend", "coworker", "vendor", "healthcare", "school", "spam", "blocked"])
    .optional(),
  trustLevel: z.enum(["unknown", "trusted", "standard", "low", "blocked"]).optional()
});

const contactPhoneNumberSchema = z.object({
  number: z.string().min(3).max(40),
  label: z.string().min(1).max(80).optional()
});

const contactSyncSchema = z.object({
  contacts: z.array(z.object({
    source: z.literal("android_contacts").default("android_contacts"),
    sourceContactId: z.string().min(1).max(200),
    displayName: z.string().min(1).max(200),
    phoneNumbers: z.array(contactPhoneNumberSchema).min(1).max(20)
  })).max(10000)
});

const phoneRoutingUpdateSchema = z.object({
  primaryPhoneNumber: z.string().min(3).max(40).optional(),
  retellPhoneNumber: z.string().min(3).max(40).optional(),
  retellAgentId: z.string().min(1).max(200).optional(),
  transferPhoneNumber: z.string().min(3).max(40).optional()
});

const assistantRatingSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

const assistantProfileUpdateSchema = z.object({
  assistantName: z.string().min(1).max(80).optional(),
  greetingStyle: z.enum(["concise", "warm", "formal", "protective"]).optional(),
  disclosureStyle: z.enum(["standard", "explicit"]).optional(),
  warmth: assistantRatingSchema.optional(),
  brevity: assistantRatingSchema.optional(),
  proactivity: assistantRatingSchema.optional(),
  unknownCallerPolicy: z.enum(["screen", "message_only", "ring_me"]).optional(),
  trustedCallerPolicy: z.enum(["can_interrupt", "ask_first", "message_only"]).optional(),
  transferPolicy: z.enum(["approval_required", "trusted_can_transfer", "never_transfer"]).optional(),
  calendarPolicy: z.enum(["free_busy_only", "create_events", "disabled"]).optional(),
  topicMemoryPolicy: z.enum(["use_relevant_threads", "ask_before_using", "disabled"]).optional()
});

const assistantNumberAssignmentSchema = z.object({
  areaCode: z.number().int().min(200).max(999).optional(),
  phoneNumber: z.string().min(3).max(40).optional()
});

const userConfigUpdateSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  phoneRouting: phoneRoutingUpdateSchema.optional(),
  billing: z
    .object({
      plan: z.string().min(1).max(100).optional(),
      monthlyIncludedMinutes: z.number().int().nonnegative().optional(),
      monthlyClassificationLimit: z.number().int().nonnegative().optional()
    })
    .optional()
});

const pushTokenRegistrationSchema = z.object({
  token: z.string().min(20).max(4096),
  platform: z.literal("android"),
  deviceId: z.string().min(1).max(200).optional(),
  appVersion: z.string().min(1).max(80).optional()
});

const topicCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000).optional(),
  participantIds: z.array(z.string().min(1).max(200)).max(50).optional()
});

const topicAttachCommunicationSchema = z.object({
  communicationItemId: z.string().min(1).max(200),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().min(1).max(500).optional()
});

const decisionCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000).optional(),
  requiredApproverParticipantIds: z.array(z.string().min(1).max(200)).max(20).optional(),
  dueAt: z.string().datetime({ offset: true }).optional().transform((value) => value ? new Date(value) : undefined),
  sourceCommunicationItemIds: z.array(z.string().min(1).max(200)).max(20).optional()
});

const openQuestionCreateSchema = z.object({
  question: z.string().min(1).max(500),
  ownerParticipantId: z.string().min(1).max(200).optional(),
  dueAt: z.string().datetime({ offset: true }).optional().transform((value) => value ? new Date(value) : undefined),
  sourceCommunicationItemIds: z.array(z.string().min(1).max(200)).max(20).optional()
});

const topicTaskCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000).optional(),
  assigneeParticipantId: z.string().min(1).max(200).optional(),
  dueAt: z.string().datetime({ offset: true }).optional().transform((value) => value ? new Date(value) : undefined),
  sourceCommunicationItemIds: z.array(z.string().min(1).max(200)).max(20).optional()
});

const retellTransferToolSchema = z.object({
  name: z.string().optional(),
  call: z
    .object({
      call_id: z.string().optional(),
      from_number: z.string().optional(),
      retell_llm_dynamic_variables: z.record(z.string()).optional()
    })
    .optional(),
  args: z
    .object({
      caller_name: z.string().optional(),
      reason: z.string().optional(),
      urgency: z.enum(["unknown", "low", "normal", "high", "emergency"]).optional()
    })
    .optional()
});

const retellAnswerToolSchema = z.object({
  name: z.string().optional(),
  call: z
    .object({
      call_id: z.string().optional(),
      from_number: z.string().optional(),
      retell_llm_dynamic_variables: z.record(z.string()).optional()
    })
    .optional(),
  args: z.object({
    caller_name: z.string().optional(),
    question: z.string().min(1).max(500),
    reason: z.string().max(500).optional(),
    urgency: z.enum(["unknown", "low", "normal", "high", "emergency"]).optional()
  })
});

const retellFreeBusyToolSchema = z.object({
  name: z.string().optional(),
  call: z
    .object({
      retell_llm_dynamic_variables: z.record(z.string()).optional()
    })
    .optional(),
  args: z.object({
    time_min: z.string().datetime({ offset: true }),
    time_max: z.string().datetime({ offset: true }),
    time_zone: z.string().min(1).max(100).optional()
  })
});

const retellCalendarEventToolSchema = z.object({
  name: z.string().optional(),
  call: z
    .object({
      call_id: z.string().optional(),
      from_number: z.string().optional(),
      retell_llm_dynamic_variables: z.record(z.string()).optional()
    })
    .optional(),
  args: z.object({
    caller_name: z.string().optional(),
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    start_time: z.string().datetime({ offset: true }),
    end_time: z.string().datetime({ offset: true }),
    time_zone: z.string().min(1).max(100).optional(),
    reason: z.string().max(500).optional()
  })
});

const retellCalendarEventUpdateToolSchema = z.object({
  name: z.string().optional(),
  call: z
    .object({
      call_id: z.string().optional(),
      from_number: z.string().optional(),
      retell_llm_dynamic_variables: z.record(z.string()).optional()
    })
    .optional(),
  args: z.object({
    caller_name: z.string().optional(),
    calendar_event_request_id: z.string().min(1).max(200).optional(),
    calendar_event_id: z.string().min(1).max(500).optional(),
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    start_time: z.string().datetime({ offset: true }).optional(),
    end_time: z.string().datetime({ offset: true }).optional(),
    time_zone: z.string().min(1).max(100).optional(),
    reason: z.string().max(500).optional()
  })
});

const optionalDate = z
  .string()
  .datetime()
  .optional()
  .transform((value) => (value ? new Date(value) : undefined));

const agentNoteCreateSchema = z.object({
  text: z.string().min(1).max(2000),
  title: z.string().min(1).max(200).optional(),
  targetPhoneNumber: z.string().min(3).max(40).optional(),
  targetCallerName: z.string().min(1).max(200).optional(),
  topic: z.string().min(1).max(200).optional(),
  oneTime: z.boolean().optional(),
  expiresAt: optionalDate
});

const agentNoteUpdateSchema = z.object({
  text: z.string().min(1).max(2000).optional(),
  title: z.string().min(1).max(200).optional(),
  targetPhoneNumber: z.string().min(3).max(40).optional(),
  targetCallerName: z.string().min(1).max(200).optional(),
  topic: z.string().min(1).max(200).optional(),
  oneTime: z.boolean().optional(),
  status: z.enum(["active", "archived"]).optional(),
  expiresAt: z
    .union([z.string().datetime().transform((value) => new Date(value)), z.null()])
    .optional()
});

const answerRequestReplySchema = z.object({
  answer: z.string().min(1).max(2000)
});

function rawBody(req: express.Request): string {
  if (!Buffer.isBuffer(req.body)) {
    throw new HttpError(400, "raw_body_missing", "Expected raw application/json request body.");
  }

  return req.body.toString("utf-8");
}

function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function requireRouteParam(value: string | string[] | undefined, name: string): string {
  if (!value || Array.isArray(value)) {
    throw new HttpError(400, "route_param_missing", `${name} route parameter is required.`);
  }
  return value;
}

async function requireUserTopic(topicThreads: TopicThreadService, topicThreadId: string, userId: string) {
  const topic = await topicThreads.get(topicThreadId);
  if (!topic || topic.userId !== userId) {
    throw notFound("topic_thread_not_found", "Topic thread was not found.");
  }
  return topic;
}

function firebaseAuth(input: {
  verifier: AuthVerifier;
  users: UserConfigService;
}): RequestHandler {
  return asyncHandler(async (req, res, next) => {
    const authorization = req.headers.authorization;
    const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : undefined;

    if (!bearerToken) {
      next(unauthorized("auth_required", "A valid Firebase bearer token is required."));
      return;
    }

    const authUser = await input.verifier.verifyIdToken(bearerToken);
    const config = await input.users.getOrCreateForFirebaseUser(authUser);
    res.locals.userId = config.userId;
    res.locals.firebaseUid = authUser.uid;
    next();
  });
}

function currentUserId(res: express.Response): string {
  return typeof res.locals.userId === "string" && res.locals.userId.length > 0
    ? res.locals.userId
    : "";
}

function notificationActionSurface(req: express.Request): "notification_action" | "app_screen" | "api" {
  const surface = req.header("x-phone-agent-action-surface");
  return surface === "notification_action" || surface === "app_screen" ? surface : "api";
}

function retellToolUserId(request: {
  call?: {
    retell_llm_dynamic_variables?: Record<string, string>;
  };
}): string | undefined {
  return request.call?.retell_llm_dynamic_variables?.phone_agent_user_id;
}

async function retellToolBillingGate(
  billing: BillingAccountService,
  userId: string | undefined
): Promise<{ allowed: true } | { allowed: false; message: string }> {
  if (!userId) {
    return {
      allowed: false,
      message: "The assistant account could not be verified. Take a concise message instead."
    };
  }

  try {
    await billing.assertPaidRuntimeAllowed(userId);
    return { allowed: true };
  } catch (error) {
    if (error instanceof HttpError && (error.code === "billing_payment_required" || error.code === "billing_cap_reached")) {
      return {
        allowed: false,
        message: "The assistant is unavailable because billing needs attention. Take a concise message instead."
      };
    }
    throw error;
  }
}

function redactedUserConfig(config: Awaited<ReturnType<UserConfigService["getOrCreate"]>>) {
  return {
    userId: config.userId,
    displayName: config.displayName,
    auth: {
      firebaseUid: config.auth.firebaseUid,
      email: config.auth.email,
      primaryPhoneVerifiedAt: config.auth.primaryPhoneVerifiedAt,
      phoneNumber: config.auth.phoneNumber,
      phoneVerificationStatus: config.auth.primaryPhoneVerifiedAt ? "verified" : "not_started"
    },
    assistantProfile: config.assistantProfile,
    phoneRouting: config.phoneRouting,
    billing: config.billing,
    onboarding: config.onboarding,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt
  };
}

function redactedNotificationEvent(event: Awaited<ReturnType<NotificationService["create"]>>) {
  return {
    id: event.id,
    type: event.type,
    priority: event.priority,
    privacy: event.privacy,
    title: event.title,
    body: event.body,
    target: event.target,
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    actions: event.actions,
    status: event.status,
    expiresAt: event.expiresAt,
    createdAt: event.createdAt,
    readAt: event.readAt,
    dismissedAt: event.dismissedAt
  };
}

function errorHandler(logger: AppLogger): ErrorRequestHandler {
  return (error, _req, res, _next) => {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
      return;
    }

    if (error instanceof ZodError) {
      res.status(400).json({
        error: {
          code: "validation_failed",
          message: "Request validation failed.",
          issues: error.issues
        }
      });
      return;
    }

    if (isJsonParseError(error)) {
      res.status(400).json({
        error: {
          code: "invalid_json",
          message: "Request body must be valid JSON."
        }
      });
      return;
    }

    logger.error({ error }, "unhandled request error");
    res.status(500).json({ error: { code: "internal_error", message: "Internal server error." } });
  };
}

function isJsonParseError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as { status?: unknown; type?: unknown };
  return candidate.status === 400 && candidate.type === "entity.parse.failed";
}
