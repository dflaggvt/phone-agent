export interface CalendarConnection {
  id: "primary";
  provider: "google";
  connected: boolean;
  refreshToken?: string;
  scopes: string[];
  connectedEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarConnectionRepository {
  get(): Promise<CalendarConnection | undefined>;
  save(connection: CalendarConnection): Promise<CalendarConnection>;
  disconnect(): Promise<CalendarConnection | undefined>;
}
