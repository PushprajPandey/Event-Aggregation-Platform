export interface Event {
  _id: string;
  title: string;
  description: string;
  dateTime: string;
  venueName: string;
  venueAddress: string;
  imageUrl: string | null;
  categoryTags: string[];
  sourceWebsite: string;
  originalEventUrl: string;
}

export interface EventsResponse {
  events: Event[];
}

export type DataSource = 'live' | 'cache' | 'offline';

export interface SystemStatus {
  isOnline: boolean;
  dataSource: DataSource;
  lastUpdated?: string;
}
