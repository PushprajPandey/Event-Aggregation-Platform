import React, { useState, useEffect } from 'react';
import { eventsService } from '../services/api';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
  ticketUrl: string;
}

const EmailModal: React.FC<EmailModalProps> = ({
  isOpen,
  onClose,
  eventId,
  eventTitle,
  ticketUrl,
}) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setError('');
    }
  }, [isOpen]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);

    try {
      // Submit email to backend
      await eventsService.submitEmail(email, eventId);

      // Redirect to ticket URL
      window.open(ticketUrl, '_blank', 'noopener,noreferrer');
      
      // Close modal
      onClose();
    } catch (err: any) {
      // Handle 409 Conflict (email already submitted for this event)
      if (err?.response?.status === 409) {
        // Email already captured, just proceed to tickets
        window.open(ticketUrl, '_blank', 'noopener,noreferrer');
        onClose();
      } else {
        // For other errors, show message but still allow user to proceed
        console.error('Email submission failed:', err);
        setError('Unable to save email, but you can still get tickets');
        // Still redirect after a brief moment
        setTimeout(() => {
          window.open(ticketUrl, '_blank', 'noopener,noreferrer');
          onClose();
        }, 1500);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    window.open(ticketUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all w-full max-w-md">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="p-6 sm:p-8">
            {/* Icon */}
            <div className="w-14 h-14 bg-gradient-to-br from-primary-600 to-accent-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-gray-900 text-center mb-2" id="modal-title">
              Get Tickets
            </h3>
            <p className="text-sm text-gray-600 text-center mb-6">
              Enter your email to stay updated about {eventTitle}
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-shadow"
                  required
                />
                {error && (
                  <p className="mt-2 text-sm text-red-600">{error}</p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex flex-col space-y-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-6 py-3 bg-gradient-to-r from-primary-600 to-accent-600 text-white rounded-lg font-semibold hover:from-primary-700 hover:to-accent-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Submitting...' : 'Continue to Tickets'}
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="w-full px-6 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </form>

            {/* Privacy note */}
            <p className="text-xs text-gray-500 text-center mt-4">
              We respect your privacy. Your email will only be used for event updates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailModal;
