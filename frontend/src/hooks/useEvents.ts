import { useState, useEffect, useCallback } from 'react';
import { Event, DataSource } from '../types';
import { eventsService } from '../services/api';

interface UseEventsReturn {
  events: Event[];
  loading: boolean;
  error: string | null;
  dataSource: DataSource;
  refetch: () => Promise<void>;
}

export const useEvents = (city: string = 'Sydney'): UseEventsReturn => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>('live');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { events: fetchedEvents, source } = await eventsService.fetchEvents(city);
      setEvents(fetchedEvents);
      setDataSource(source);
      
      if (fetchedEvents.length === 0) {
        setError('No events found');
      }
    } catch (err) {
      setError('Failed to load events. Please try again.');
      console.error('Error in useEvents:', err);
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    loading,
    error,
    dataSource,
    refetch: fetchEvents,
  };
};
