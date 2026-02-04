import React, { useState } from 'react';
import { Event } from '../types';
import EmailModal from './EmailModal';

interface EventCardProps {
  event: Event;
}

const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  const handleGetTickets = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="bg-white rounded-xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 group">
        {/* Image */}
        <div className="relative h-48 bg-gradient-to-br from-primary-500 to-accent-500 overflow-hidden">
          {event.imageUrl && !imageError ? (
            <img
              src={event.imageUrl}
              alt={event.title}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-16 h-16 text-white opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
          )}
          
          {/* Date Badge */}
          <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg px-3 py-2 text-center min-w-[60px]">
            <div className="text-2xl font-bold text-gray-900">
              {new Date(event.dateTime).getDate()}
            </div>
            <div className="text-xs font-semibold text-gray-600 uppercase">
              {new Date(event.dateTime).toLocaleDateString('en-AU', { month: 'short' })}
            </div>
          </div>

          {/* Category Tag */}
          {event.categoryTags.length > 0 && (
            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1">
              <span className="text-xs font-semibold text-gray-700">
                {event.categoryTags[0]}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Title */}
          <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors">
            {event.title}
          </h3>

          {/* Date & Time */}
          <div className="flex items-center text-sm text-gray-600 mb-3">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formatDate(event.dateTime)} at {formatTime(event.dateTime)}</span>
          </div>

          {/* Venue */}
          <div className="flex items-start text-sm text-gray-600 mb-3">
            <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div>
              <div className="font-medium text-gray-900">{event.venueName}</div>
              <div className="text-xs">{event.venueAddress}</div>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 mb-4 line-clamp-3">
            {truncateText(event.description, 120)}
          </p>

          {/* Source Website */}
          <div className="flex items-center text-xs text-gray-500 mb-4">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span>Source: {event.sourceWebsite}</span>
          </div>

          {/* Get Tickets Button */}
          <button
            onClick={handleGetTickets}
            className="w-full px-4 py-3 bg-gradient-to-r from-primary-600 to-accent-600 text-white rounded-lg font-semibold hover:from-primary-700 hover:to-accent-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            Get Tickets
          </button>
        </div>
      </div>

      {/* Email Modal */}
      <EmailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        eventId={event._id}
        eventTitle={event.title}
        ticketUrl={event.originalEventUrl}
      />
    </>
  );
};

export default EventCard;
