import { unauthorized } from "../../shared/httpErrors.js";

type RetellSdkLike = {
  verify: (rawBody: string, apiKey: string, signature: string) => boolean;
};

export interface WebhookVerifier {
  verify(rawBody: string, signature: string | string[] | undefined): Promise<void>;
}

export class RetellWebhookVerifier implements WebhookVerifier {
  constructor(
    private readonly options: {
      enabled: boolean;
      apiKey?: string;
      sdk: RetellSdkLike;
    }
  ) {}

  async verify(rawBody: string, signature: string | string[] | undefined): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    if (!this.options.apiKey) {
      throw unauthorized("retell_api_key_missing", "RETELL_API_KEY is required when Retell webhook verification is enabled.");
    }

    if (typeof signature !== "string") {
      throw unauthorized("retell_signature_missing", "Missing Retell webhook signature.");
    }

    if (!this.options.sdk.verify(rawBody, this.options.apiKey, signature)) {
      throw unauthorized("retell_signature_invalid", "Invalid Retell webhook signature.");
    }
  }
}
