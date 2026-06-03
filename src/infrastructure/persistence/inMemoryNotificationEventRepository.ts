import {
  createNotificationEvent,
  type CreateNotificationEventInput,
  type NotificationEvent,
  type NotificationEventRepository
} from "../../domain/notifications/notificationEvent.js";

export class InMemoryNotificationEventRepository implements NotificationEventRepository {
  private readonly events = new Map<string, NotificationEvent>();

  async create(input: CreateNotificationEventInput): Promise<NotificationEvent> {
    const event = createNotificationEvent(input);
    this.events.set(event.id, event);
    return event;
  }

  async listForUser(userId: string, limit = 50): Promise<NotificationEvent[]> {
    await this.expireDue();
    return [...this.events.values()]
      .filter((event) => event.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async listUnreadForUser(userId: string, limit = 50): Promise<NotificationEvent[]> {
    await this.expireDue();
    return [...this.events.values()]
      .filter((event) => event.userId === userId && event.status === "unread")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async markRead(id: string, userId: string): Promise<NotificationEvent | undefined> {
    const event = this.events.get(id);
    if (!event || event.userId !== userId) {
      return undefined;
    }
    const next: NotificationEvent = { ...event, status: "read", readAt: new Date() };
    this.events.set(id, next);
    return next;
  }

  async dismiss(id: string, userId: string): Promise<NotificationEvent | undefined> {
    const event = this.events.get(id);
    if (!event || event.userId !== userId) {
      return undefined;
    }
    const next: NotificationEvent = { ...event, status: "dismissed", dismissedAt: new Date() };
    this.events.set(id, next);
    return next;
  }

  async dismissBySource(userId: string, sourceType: string, sourceId: string): Promise<number> {
    let count = 0;
    const now = new Date();
    for (const [id, event] of this.events) {
      if (
        event.userId === userId &&
        event.sourceType === sourceType &&
        event.sourceId === sourceId &&
        event.status === "unread"
      ) {
        this.events.set(id, { ...event, status: "dismissed", dismissedAt: now });
        count += 1;
      }
    }
    return count;
  }

  async expireDue(now = new Date()): Promise<number> {
    let count = 0;
    for (const [id, event] of this.events) {
      if (event.status === "unread" && event.expiresAt && event.expiresAt.getTime() <= now.getTime()) {
        this.events.set(id, { ...event, status: "expired" });
        count += 1;
      }
    }
    return count;
  }
}
