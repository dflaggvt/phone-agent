export interface PushDeliveryInput {
  token: string;
  notificationId: string;
  type: string;
  priority: string;
  title: string;
  body: string;
  target: string;
}

export interface PushDeliveryResult {
  status: "sent" | "failed";
  errorCode?: string;
  disableToken?: boolean;
}

export interface PushDeliveryClient {
  send(input: PushDeliveryInput): Promise<PushDeliveryResult>;
}
