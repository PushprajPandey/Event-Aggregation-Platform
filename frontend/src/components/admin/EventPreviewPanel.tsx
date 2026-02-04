import React from 'react';
import { AdminEvent } from '../../types/admin';
import { formatDistance } from 'date-fns';

interface EventPreviewPanelProps {
  event: AdminEvent | null;
  onClose: () => void;
  onImport: (eventId: string) => void;
}

const EventPreviewPanel: React.FC<EventPreviewPanelProps> = ({
  event,
  onClose,
  onImport,
}) => {
  if (!event) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center text-gray-500">
          <svg
            className="mx-auto h-16 w-16 text-gray-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-lg font-medium">No Event Selected</p>
          <p className="text-sm mt-1">Click on an event to view details</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Event Details</h3>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-6 overflow-y-auto max-h-[calc(100vh-16rem)]">
        {/* Event Image */}
        {event.imageUrl && (
          <img
            src={event.imageUrl}
            alt={event.title}
            className="w-full h-48 object-cover rounded-lg mb-6"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}

        {/* Title & Status */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{event.title}</h2>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                event.status === 'new'
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : event.status === 'updated'
                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                  : event.status === 'inactive'
                  ? 'bg-gray-100 text-gray-800 border-gray-200'
                  : 'bg-purple-100 text-purple-800 border-purple-200'
              }`}
            >
              {event.status.toUpperCase()}
            </span>
            <span className="text-sm text-gray-500">{event.sourceWebsite}</span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="space-y-4">
          {/* Date & Time */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-1">Date & Time</h4>
            <p className="text-gray-900">{formatDate(event.dateTime)}</p>
          </div>

          {/* Venue */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-1">Venue</h4>
            <p className="text-gray-900">{event.venueName}</p>
            <p className="text-sm text-gray-600">{event.venueAddress}</p>
            <p className="text-sm text-gray-600">{event.city}</p>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-1">Description</h4>
            <p className="text-gray-900 whitespace-pre-wrap">{event.description}</p>
          </div>

          {/* Categories */}
          {event.categoryTags && event.categoryTags.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Categories</h4>
              <div className="flex flex-wrap gap-2">
                {event.categoryTags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Metadata</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Last Scraped:</span>
                <span className="text-gray-900">{getTimeAgo(event.lastScrapedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span className="text-gray-900">{getTimeAgo(event.createdAt)}</span>
              </div>
              {event.importedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Imported:</span>
                  <span className="text-gray-900">{getTimeAgo(event.importedAt)}</span>
                </div>
              )}
              {event.importNotes && (
                <div className="pt-2">
                  <span className="text-gray-600">Import Notes:</span>
                  <p className="text-gray-900 mt-1">{event.importNotes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Links */}
          <div className="flex gap-3 pt-4">
            <a
              href={event.originalEventUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              View Original
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>

          {/* Import Button */}
          {event.status !== 'imported' && (
            <button
              onClick={() => onImport(event._id)}
              className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              Import to Platform
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventPreviewPanel;
