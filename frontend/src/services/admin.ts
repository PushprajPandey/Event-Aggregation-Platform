import axios from 'axios';
import {
  AdminEvent,
  AdminEventsResponse,
  AdminFilters,
  DashboardStats,
  ImportEventRequest,
  ImportEventResponse,
} from '../types/admin';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const adminApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important for session cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

class AdminService {
  /**
   * Fetch admin events with filters
   */
  async getEvents(filters: AdminFilters = {}): Promise<AdminEventsResponse> {
    try {
      const response = await adminApi.get<AdminEventsResponse>('/api/admin/events', {
        params: filters,
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching admin events:', error);
      throw error;
    }
  }

  /**
   * Get single event details
   */
  async getEvent(id: string): Promise<AdminEvent> {
    try {
      const response = await adminApi.get<{ success: boolean; data: { event: AdminEvent } }>(
        `/api/admin/events/${id}`
      );
      return response.data.data.event;
    } catch (error) {
      console.error('Error fetching event:', error);
      throw error;
    }
  }

  /**
   * Import event to platform
   */
  async importEvent(id: string, request: ImportEventRequest = {}): Promise<ImportEventResponse> {
    try {
      const response = await adminApi.post<ImportEventResponse>(
        `/api/admin/events/${id}/import`,
        request
      );
      return response.data;
    } catch (error) {
      console.error('Error importing event:', error);
      throw error;
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const response = await adminApi.get<DashboardStats>('/api/admin/dashboard');
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }
}

export const adminService = new AdminService();
export default adminService;
