import axios from 'axios';
import { Event, DataSource } from '../types';

// Configure base URL - adjust based on your backend deployment
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Cache management
const CACHE_KEY = 'sydney_events_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CachedData {
  events: Event[];
  timestamp: number;
  source: DataSource;
}

class EventsService {
  /**
   * Fetch events from the backend API
   */
  async fetchEvents(city: string = 'Sydney'): Promise<{ events: Event[]; source: DataSource }> {
    try {
      // Check if online
      if (!navigator.onLine) {
        return this.getFromCache('offline');
      }

      // Attempt to fetch from API
      const response = await api.get<any>('/api/events', {
        params: { city },
      });

      // Backend returns { success, data: { events, pagination }, message }
      const events = response.data?.data?.events || response.data?.events || [];
      
      // Cache the results
      this.saveToCache(events, 'live');

      return { events, source: 'live' };
    } catch (error) {
      console.error('Error fetching events:', error);

      // Try to get from cache on error
      return this.getFromCache('cache');
    }
  }

  /**
   * Save events to local storage cache
   */
  private saveToCache(events: Event[], source: DataSource): void {
    try {
      const cacheData: CachedData = {
        events,
        timestamp: Date.now(),
        source,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  }

  /**
   * Retrieve events from cache
   */
  private getFromCache(fallbackSource: DataSource): { events: Event[]; source: DataSource } {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) {
        return { events: [], source: fallbackSource };
      }

      const cacheData: CachedData = JSON.parse(cached);
      const age = Date.now() - cacheData.timestamp;

      // Return cached data with appropriate source indicator
      return {
        events: cacheData.events,
        source: age > CACHE_DURATION ? fallbackSource : 'cache',
      };
    } catch (error) {
      console.error('Error reading from cache:', error);
      return { events: [], source: fallbackSource };
    }
  }

  /**
   * Check if cache exists and is valid
   */
  hasCachedData(): boolean {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      return !!cached;
    } catch {
      return false;
    }
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Submit email before ticket redirect
   */
  async submitEmail(email: string, eventId: string): Promise<void> {
    try {
      await api.post('/api/email-capture', { 
        email, 
        eventId, 
        consentGiven: true 
      });
    } catch (error) {
      console.error('Error submitting email:', error);
      // Don't block user from proceeding even if email submission fails
    }
  }
}

export const eventsService = new EventsService();
export default eventsService;
