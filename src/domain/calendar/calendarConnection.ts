export interface CalendarConnection {
  id: string;
  userId: string;
  provider: "google";
  connected: boolean;
  refreshToken?: string;
  scopes: string[];
  connectedEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarConnectionRepository {
  get(userId: string): Promise<CalendarConnection | undefined>;
  save(connection: CalendarConnection): Promise<CalendarConnection>;
  disconnect(userId: string): Promise<CalendarConnection | undefined>;
}
