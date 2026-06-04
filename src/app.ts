import cors from "cors";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import Retell from "retell-sdk";
import { ZodError } from "zod";
import { AgentNoteService } from "./application/agentNotes/agentNoteService.js";
import { AccountRemovalService, type AuthAccountAdmin } from "./application/accounts/accountRemovalService.js";
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
import { FirebaseAccountAdmin, NoopAuthAccountAdmin } from "./infrastructure/firebase/firebaseAccountAdmin.js";
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
import { FirestoreInvoiceMirrorRepository } from "./infrastructure/persistence/firestoreInvoiceMirrorRepository.js";
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
import { InMemoryInvoiceMirrorRepository } from "./infrastructure/persistence/inMemoryInvoiceMirrorRepository.js";
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
import { accountRoutes } from "./routes/accountRoutes.js";
import { agentNoteRoutes } from "./routes/agentNoteRoutes.js";
import { analyticsRoutes } from "./routes/analyticsRoutes.js";
import { billingReturnRoutes, billingRoutes } from "./routes/billingRoutes.js";
import { calendarRoutes } from "./routes/calendarRoutes.js";
import { callRoutes } from "./routes/callRoutes.js";
import { communicationRoutes } from "./routes/communicationRoutes.js";
import { contactRoutes } from "./routes/contactRoutes.js";
import { liveActionRoutes } from "./routes/liveActionRoutes.js";
import { notificationRoutes } from "./routes/notificationRoutes.js";
import { onboardingRoutes } from "./routes/onboardingRoutes.js";
import { outboundCallRoutes } from "./routes/outboundCallRoutes.js";
import { retellRawRoutes } from "./routes/retellRawRoutes.js";
import { asyncHandler, rawBody } from "./routes/routeSupport.js";
import { topicRoutes } from "./routes/topicRoutes.js";
import { userRoutes } from "./routes/userRoutes.js";
import { forbidden, HttpError, unauthorized } from "./shared/httpErrors.js";
import type { AppLogger } from "./shared/logger.js";
import { createRateLimiter } from "./shared/rateLimit.js";
import type { PushDeliveryClient } from "./application/notifications/pushDeliveryClient.js";

export interface AppDependencies {
  env: AppEnv;
  logger: AppLogger;
  authVerifier?: AuthVerifier;
  authAccountAdmin?: AuthAccountAdmin;
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
  const invoiceMirrors = firestore
    ? new FirestoreInvoiceMirrorRepository(firestore)
    : new InMemoryInvoiceMirrorRepository();
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
  const authAccountAdmin = dependencies.authAccountAdmin ?? (
    dependencies.authVerifier
      ? new NoopAuthAccountAdmin()
      : new FirebaseAccountAdmin(dependencies.env.FIREBASE_PROJECT_ID)
  );
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
    notifications,
    logger: dependencies.logger,
    rateCard: {
      version: "personal-v1",
      callMinuteOverageCents: dependencies.env.BILLING_CALL_MINUTE_OVERAGE_CENTS,
      estimatedCallMinuteCostCents: dependencies.env.BILLING_ESTIMATED_CALL_MINUTE_COST_CENTS,
      classificationRequestCostCents: dependencies.env.BILLING_CLASSIFICATION_COST_CENTS
    }
  });
  const billing = new BillingAccountService({
    billingAccounts,
    users: userConfigs,
    provider: billingProvider,
    webhookEvents,
    invoiceMirrors,
    notifications,
    publicBaseUrl: dependencies.env.APP_PUBLIC_BASE_URL,
    defaultSpendingCapCents: dependencies.env.BILLING_DEFAULT_SPENDING_CAP_CENTS,
    billingRequiredForProvisioning: dependencies.env.BILLING_REQUIRED_FOR_PROVISIONING,
    prices: {
      personalMonthlyPriceId: dependencies.env.STRIPE_PRICE_PERSONAL_MONTHLY,
      personalCallMinuteOveragePriceId: dependencies.env.STRIPE_PRICE_PERSONAL_CALL_MINUTE_OVERAGE
    }
  });
  const accountRemoval = new AccountRemovalService({
    billing,
    pushDeviceTokens,
    users: userConfigs,
    authAccountAdmin
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

  app.use(retellRawRoutes({
    providerRateLimiter,
    rawJson,
    retellWebhooks,
    retellVerifier,
    billing,
    transferApprovals,
    liveAnswers,
    calendar
  }));

  app.post("/webhooks/billing/stripe", providerRateLimiter, rawJson, asyncHandler(async (req, res) => {
    const result = await billing.handleStripeWebhook(rawBody(req), req.headers["stripe-signature"]);
    res.status(200).json(result);
  }));

  app.use(express.json({ limit: "1mb" }));
  app.use("/v1", clientRateLimiter);
  app.use("/v1", firebaseAuth({ verifier: authVerifier, users: userConfigs }));
  app.use("/v1/billing", billingRoutes({ billing, usage }));
  app.use("/v1", accountRoutes({ accountRemoval }));
  app.use("/v1/analytics", analyticsRoutes({ productAnalytics }));
  app.use("/v1", userRoutes({ userConfigs }));
  app.use("/v1", onboardingRoutes({
    billing,
    billingRequiredForProvisioning: dependencies.env.BILLING_REQUIRED_FOR_PROVISIONING,
    calls,
    communicationItems,
    userConfigs,
    voiceNumberProvisioning
  }));
  app.use("/v1", notificationRoutes({ notifications }));
  app.use("/v1", callRoutes({ calls, activeCalls, userConfigs }));
  app.use("/v1", communicationRoutes({ communicationItems }));
  app.use("/v1", topicRoutes({ topicThreads, topicSuggestions, communicationItems }));
  app.use(calendarRoutes({ calendar }));
  app.use("/v1", contactRoutes({ callerMemory, contacts }));
  app.use("/v1", liveActionRoutes({ liveAnswers, transferApprovals }));
  app.use("/v1", agentNoteRoutes({ agentNotes }));
  app.use("/v1", outboundCallRoutes({ billing, outboundCalls }));

  app.use(errorHandler(dependencies.logger));

  return app;
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
    if (config.accountStatus === "deleted") {
      next(forbidden("account_removed", "This Phone Agent account has been removed."));
      return;
    }
    res.locals.userId = config.userId;
    res.locals.firebaseUid = authUser.uid;
    next();
  });
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
