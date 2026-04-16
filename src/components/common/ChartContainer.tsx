import type { ReactNode } from 'react';
import LoadingSpinner from './LoadingSpinner';

interface ChartContainerProps {
  title: string;
  children: ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
  errorMessage?: string;
  isLoading?: boolean;
}

export default function ChartContainer({
  title,
  children,
  isEmpty,
  emptyMessage = 'No data available yet.',
  errorMessage,
  isLoading,
}: ChartContainerProps) {
  return (
    <section className="card">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        {title}
      </h2>

      {isLoading ? (
        <LoadingSpinner message="Loading chart data..." />
      ) : errorMessage ? (
        <p className="text-sm text-red-600 dark:text-red-400 text-center py-6">
          {errorMessage}
        </p>
      ) : isEmpty ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
          {emptyMessage}
        </p>
      ) : (
        children
      )}
    </section>
  );
}
