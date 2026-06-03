import type { CalendarConnection, CalendarConnectionRepository } from "../../domain/calendar/calendarConnection.js";

export class InMemoryCalendarConnectionRepository implements CalendarConnectionRepository {
  private readonly connections = new Map<string, CalendarConnection>();

  async get(userId: string): Promise<CalendarConnection | undefined> {
    return this.connections.get(userId);
  }

  async save(connection: CalendarConnection): Promise<CalendarConnection> {
    this.connections.set(connection.userId, connection);
    return connection;
  }

  async disconnect(userId: string): Promise<CalendarConnection | undefined> {
    const connection = this.connections.get(userId);
    if (!connection) {
      return undefined;
    }
    const updated = { ...connection, connected: false, refreshToken: undefined, updatedAt: new Date() };
    this.connections.set(userId, updated);
    return updated;
  }
}
