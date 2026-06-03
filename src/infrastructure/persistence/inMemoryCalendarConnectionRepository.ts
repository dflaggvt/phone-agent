import type { CalendarConnection, CalendarConnectionRepository } from "../../domain/calendar/calendarConnection.js";

export class InMemoryCalendarConnectionRepository implements CalendarConnectionRepository {
  private connection: CalendarConnection | undefined;

  async get(): Promise<CalendarConnection | undefined> {
    return this.connection;
  }

  async save(connection: CalendarConnection): Promise<CalendarConnection> {
    this.connection = connection;
    return connection;
  }

  async disconnect(): Promise<CalendarConnection | undefined> {
    if (!this.connection) {
      return undefined;
    }
    const updated = { ...this.connection, connected: false, refreshToken: undefined, updatedAt: new Date() };
    this.connection = updated;
    return updated;
  }
}
