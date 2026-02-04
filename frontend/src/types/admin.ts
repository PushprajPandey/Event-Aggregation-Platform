// Admin-specific types for the dashboard

export interface User {
  _id: string;
  googleId: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  profilePhoto?: string;
  role: 'user' | 'admin';
  createdAt: string;
  lastLogin: string;
}

export interface AdminEvent {
  _id: string;
  title: string;
  dateTime: string;
  venueName: string;
  venueAddress: string;
  city: string;
  description: string;
  categoryTags: string[];
  imageUrl?: string;
  sourceWebsite: string;
  originalEventUrl: string;
  ticketUrl?: string;
  status: EventStatus;
  lastScrapedAt: string;
  importedAt?: string;
  importedBy?: string;
  importNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export type EventStatus = 'new' | 'updated' | 'inactive' | 'imported';

export interface AdminFilters {
  city?: string;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: EventStatus;
  page?: number;
  limit?: number;
}

export interface AdminEventsResponse {
  success: boolean;
  data: {
    events: AdminEvent[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
  };
  message?: string;
}

export interface DashboardStats {
  success: boolean;
  data: {
    totalEvents: number;
    eventsByStatus: {
      new: number;
      updated: number;
      inactive: number;
      imported: number;
    };
    recentScrapes: number;
    sourcesCount: number;
  };
}

export interface ImportEventRequest {
  notes?: string;
}

export interface ImportEventResponse {
  success: boolean;
  data?: {
    event: AdminEvent;
  };
  message?: string;
  error?: string;
}
