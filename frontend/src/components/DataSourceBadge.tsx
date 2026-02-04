import React from 'react';
import { DataSource } from '../types';

interface DataSourceBadgeProps {
  source: DataSource;
}

const DataSourceBadge: React.FC<DataSourceBadgeProps> = ({ source }) => {
  const config = {
    live: {
      label: 'Live Data',
      className: 'bg-green-100 text-green-800 border-green-200',
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="4" />
        </svg>
      ),
    },
    cache: {
      label: 'Cached',
      className: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
    },
    offline: {
      label: 'Offline',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
        </svg>
      ),
    },
  };

  const { label, className, icon } = config[source];

  return (
    <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${className}`}>
      {icon}
      <span>{label}</span>
    </div>
  );
};

export default DataSourceBadge;
