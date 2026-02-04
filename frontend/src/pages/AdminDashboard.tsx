import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { adminService } from '../services/admin';
import { AdminEvent, AdminFilters, DashboardStats, User } from '../types/admin';
import FilterPanel from '../components/admin/FilterPanel';
import EventTable from '../components/admin/EventTable';
import EventPreviewPanel from '../components/admin/EventPreviewPanel';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<DashboardStats['data'] | null>(null);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<AdminEvent | null>(null);
  const [filters, setFilters] = useState<AdminFilters>({
    city: 'Sydney',
    page: 1,
    limit: 20,
  });
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    pages: 0,
  });

  // Fetch user on mount
  useEffect(() => {
    const fetchUser = async () => {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    };
    fetchUser();
  }, []);

  // Fetch dashboard stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await adminService.getDashboardStats();
        setStats(response.data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };
    fetchStats();
  }, []);

  // Fetch events when filters change
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const response = await adminService.getEvents(filters);
        setEvents(response.data.events);
        setPagination(response.data.pagination);
      } catch (error) {
        console.error('Error fetching events:', error);
        // If unauthorized, redirect to login
        if ((error as any).response?.status === 401) {
          navigate('/login');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [filters, navigate]);

  const handleFilterChange = (newFilters: AdminFilters) => {
    setFilters({ ...newFilters, page: 1 }); // Reset to page 1 on filter change
  };

  const handleSelectEvent = (event: AdminEvent) => {
    setSelectedEvent(event);
  };

  const handleImportEvent = async (eventId: string) => {
    setImporting(eventId);
    try {
      const response = await adminService.importEvent(eventId);
      if (response.success) {
        // Update the event in the list
        setEvents((prev) =>
          prev.map((e) =>
            e._id === eventId ? { ...e, status: 'imported' as const } : e
          )
        );
        // Update selected event if it's the one being imported
        if (selectedEvent?._id === eventId) {
          setSelectedEvent((prev) =>
            prev ? { ...prev, status: 'imported' as const } : null
          );
        }
        // Refresh stats
        const statsResponse = await adminService.getDashboardStats();
        setStats(statsResponse.data);
      }
    } catch (error) {
      console.error('Error importing event:', error);
      alert('Failed to import event. Please try again.');
    } finally {
      setImporting(null);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg font-bold">
                ADMIN
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Sydney Events Dashboard
                </h1>
                <p className="text-sm text-gray-500">Manage scraped events</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-3">
                  {user.profilePhoto && (
                    <img
                      src={user.profilePhoto}
                      alt={user.displayName}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <span className="text-sm text-gray-700">{user.displayName}</span>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      {stats && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{stats.totalEvents}</div>
                <div className="text-sm text-gray-600">Total Events</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {stats.eventsByStatus.new}
                </div>
                <div className="text-sm text-gray-600">New</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.eventsByStatus.updated}
                </div>
                <div className="text-sm text-gray-600">Updated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.eventsByStatus.imported}
                </div>
                <div className="text-sm text-gray-600">Imported</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <FilterPanel filters={filters} onFilterChange={handleFilterChange} />
          </div>

          {/* Events Table */}
          <div className="lg:col-span-2">
            <EventTable
              events={events}
              selectedEventId={selectedEvent?._id || null}
              onSelectEvent={handleSelectEvent}
              onImportEvent={handleImportEvent}
              loading={loading}
            />

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="mt-4 flex items-center justify-between bg-white px-4 py-3 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-700">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Event Preview Panel */}
          <div className="lg:col-span-1">
            <EventPreviewPanel
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
              onImport={handleImportEvent}
            />
          </div>
        </div>
      </div>

      {/* Import Loading Overlay */}
      {importing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
            <span className="text-gray-900 font-medium">Importing event...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
