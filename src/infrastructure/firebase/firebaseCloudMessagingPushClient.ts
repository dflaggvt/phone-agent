import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import type { PushDeliveryClient, PushDeliveryInput, PushDeliveryResult } from "../../application/notifications/pushDeliveryClient.js";

export class FirebaseCloudMessagingPushClient implements PushDeliveryClient {
  constructor(private readonly projectId?: string) {}

  async send(input: PushDeliveryInput): Promise<PushDeliveryResult> {
    const app = getApps()[0] ?? initializeApp({
      credential: applicationDefault(),
      projectId: this.projectId
    });
    try {
      await getMessaging(app).send({
        token: input.token,
        android: {
          priority: input.priority === "urgent" || input.priority === "high" ? "high" : "normal"
        },
        data: {
          notification_id: input.notificationId,
          type: input.type,
          priority: input.priority,
          title: input.title,
          body: input.body,
          target: input.target
        }
      });
      return { status: "sent" };
    } catch (error) {
      const code = errorCode(error);
      return {
        status: "failed",
        errorCode: code,
        disableToken: code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token"
      };
    }
  }
}

export class NoopPushDeliveryClient implements PushDeliveryClient {
  async send(): Promise<PushDeliveryResult> {
    return { status: "failed", errorCode: "push_delivery_not_configured" };
  }
}

function errorCode(error: unknown): string {
  const candidate = error as { code?: unknown; errorInfo?: { code?: unknown } };
  if (typeof candidate?.code === "string") {
    return candidate.code;
  }
  if (typeof candidate?.errorInfo?.code === "string") {
    return candidate.errorInfo.code;
  }
  return "push_delivery_failed";
}
