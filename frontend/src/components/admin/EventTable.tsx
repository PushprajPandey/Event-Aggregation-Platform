import React from 'react';
import { AdminEvent, EventStatus } from '../../types/admin';
import { formatDistance } from 'date-fns';

interface EventTableProps {
  events: AdminEvent[];
  selectedEventId: string | null;
  onSelectEvent: (event: AdminEvent) => void;
  onImportEvent: (eventId: string) => void;
  loading?: boolean;
}

const EventTable: React.FC<EventTableProps> = ({
  events,
  selectedEventId,
  onSelectEvent,
  onImportEvent,
  loading = false,
}) => {
  const getStatusBadge = (status: EventStatus) => {
    const styles = {
      new: 'bg-green-100 text-green-800 border-green-200',
      updated: 'bg-blue-100 text-blue-800 border-blue-200',
      inactive: 'bg-gray-100 text-gray-800 border-gray-200',
      imported: 'bg-purple-100 text-purple-800 border-purple-200',
    };

    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full border ${styles[status]}`}
      >
        {status.toUpperCase()}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-AU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Invalid date';
    }
  };

  const getTimeAgo = (dateString: string) => {
    try {
      return formatDistance(new Date(dateString), new Date(), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
          <span className="ml-3 text-gray-600">Loading events...</span>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center text-gray-500">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="text-lg font-medium">No events found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Event
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Venue
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Scraped
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {events.map((event) => (
              <tr
                key={event._id}
                onClick={() => onSelectEvent(event)}
                className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedEventId === event._id ? 'bg-blue-50' : ''
                }`}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    {event.imageUrl && (
                      <img
                        src={event.imageUrl}
                        alt={event.title}
                        className="h-10 w-10 rounded object-cover mr-3"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900 line-clamp-1">
                        {event.title}
                      </div>
                      <div className="text-xs text-gray-500">{event.sourceWebsite}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{formatDate(event.dateTime)}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 line-clamp-1">{event.venueName}</div>
                  <div className="text-xs text-gray-500 line-clamp-1">
                    {event.venueAddress}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(event.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {getTimeAgo(event.lastScrapedAt)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {event.status !== 'imported' ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onImportEvent(event._id);
                      }}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                      Import
                    </button>
                  ) : (
                    <span className="text-gray-400 text-xs">Already Imported</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EventTable;
