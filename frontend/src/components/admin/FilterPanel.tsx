import React from 'react';
import { AdminFilters, EventStatus } from '../../types/admin';

interface FilterPanelProps {
  filters: AdminFilters;
  onFilterChange: (filters: AdminFilters) => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ filters, onFilterChange }) => {
  const handleInputChange = (key: keyof AdminFilters, value: string) => {
    onFilterChange({ ...filters, [key]: value || undefined });
  };

  const handleStatusChange = (status: EventStatus | '') => {
    onFilterChange({ ...filters, status: status || undefined });
  };

  const handleClearFilters = () => {
    onFilterChange({
      city: 'Sydney',
      page: 1,
      limit: 20,
    });
  };

  const hasActiveFilters = 
    filters.keyword || 
    filters.dateFrom || 
    filters.dateTo || 
    filters.status;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* City Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            City
          </label>
          <select
            value={filters.city || 'Sydney'}
            onChange={(e) => handleInputChange('city', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="Sydney">Sydney</option>
            <option value="Melbourne">Melbourne</option>
            <option value="Brisbane">Brisbane</option>
            <option value="Perth">Perth</option>
          </select>
        </div>

        {/* Keyword Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Keyword Search
          </label>
          <input
            type="text"
            placeholder="Search title, venue, description..."
            value={filters.keyword || ''}
            onChange={(e) => handleInputChange('keyword', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date From
          </label>
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => handleInputChange('dateFrom', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date To
          </label>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => handleInputChange('dateTo', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Event Status
          </label>
          <select
            value={filters.status || ''}
            onChange={(e) => handleStatusChange(e.target.value as EventStatus | '')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="updated">Updated</option>
            <option value="inactive">Inactive</option>
            <option value="imported">Imported</option>
          </select>
        </div>

        {/* Active Filters Count */}
        {hasActiveFilters && (
          <div className="pt-2 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              {Object.keys(filters).filter(k => 
                filters[k as keyof AdminFilters] && 
                k !== 'city' && 
                k !== 'page' && 
                k !== 'limit'
              ).length} active filter(s)
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterPanel;
