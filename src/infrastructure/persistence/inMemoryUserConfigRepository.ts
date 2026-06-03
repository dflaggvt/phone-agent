import type { UpsertUserConfigInput, UserConfig, UserConfigRepository } from "../../domain/users/userConfig.js";
import { createUserConfig } from "../../domain/users/userConfig.js";

export class InMemoryUserConfigRepository implements UserConfigRepository {
  private readonly configs = new Map<string, UserConfig>();

  async get(userId: string): Promise<UserConfig | undefined> {
    return this.configs.get(userId);
  }

  async getByRetellPhoneNumber(phoneNumber: string): Promise<UserConfig | undefined> {
    const normalized = normalizePhone(phoneNumber);
    return [...this.configs.values()].find((config) => normalizePhone(config.phoneRouting.retellPhoneNumber) === normalized);
  }

  async upsert(input: UpsertUserConfigInput): Promise<UserConfig> {
    const existing = this.configs.get(input.userId);
    const now = new Date();
    const next: UserConfig = existing
      ? {
        ...existing,
        displayName: input.displayName ?? existing.displayName,
        auth: { ...existing.auth, ...input.auth },
        assistantProfile: {
          ...existing.assistantProfile,
          ...input.assistantProfile,
          profileVersion: input.assistantProfile
            ? existing.assistantProfile.profileVersion + 1
            : existing.assistantProfile.profileVersion
        },
        phoneRouting: { ...existing.phoneRouting, ...input.phoneRouting },
        billing: { ...existing.billing, ...input.billing },
        onboarding: { ...existing.onboarding, ...input.onboarding },
        updatedAt: now
      }
      : createUserConfig({ ...input, now });
    this.configs.set(next.userId, next);
    return next;
  }
}

function normalizePhone(value?: string): string {
  return (value ?? "").replace(/[^\d+]/g, "");
}
