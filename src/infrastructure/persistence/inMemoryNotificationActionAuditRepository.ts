import {
  createNotificationActionAudit,
  type CreateNotificationActionAuditInput,
  type NotificationActionAudit,
  type NotificationActionAuditRepository
} from "../../domain/notifications/notificationActionAudit.js";

export class InMemoryNotificationActionAuditRepository implements NotificationActionAuditRepository {
  private readonly audits = new Map<string, NotificationActionAudit>();

  async create(input: CreateNotificationActionAuditInput): Promise<NotificationActionAudit> {
    const audit = createNotificationActionAudit(input);
    this.audits.set(audit.id, audit);
    return audit;
  }

  async listForUser(userId: string, limit = 50): Promise<NotificationActionAudit[]> {
    return [...this.audits.values()]
      .filter((audit) => audit.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}
