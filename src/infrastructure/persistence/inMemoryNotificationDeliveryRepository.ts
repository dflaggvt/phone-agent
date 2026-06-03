import {
  createNotificationDelivery,
  type CreateNotificationDeliveryInput,
  type NotificationDelivery,
  type NotificationDeliveryRepository
} from "../../domain/notifications/notificationDelivery.js";

export class InMemoryNotificationDeliveryRepository implements NotificationDeliveryRepository {
  private readonly deliveries = new Map<string, NotificationDelivery>();

  async create(input: CreateNotificationDeliveryInput): Promise<NotificationDelivery> {
    const delivery = createNotificationDelivery(input);
    this.deliveries.set(delivery.id, delivery);
    return delivery;
  }

  async listForUser(userId: string, limit = 50): Promise<NotificationDelivery[]> {
    return [...this.deliveries.values()]
      .filter((delivery) => delivery.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}
