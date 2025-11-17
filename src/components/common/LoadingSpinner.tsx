import { memo } from 'react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

function LoadingSpinner({ message = 'Loading...', size = 'md' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  };

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className={`inline-block animate-spin rounded-full border-b-2 border-primary-500 dark:border-primary-400 mb-4 ${sizeClasses[size]}`}></div>
        <p className="text-gray-600 dark:text-gray-400">{message}</p>
      </div>
    </div>
  );
}

export default memo(LoadingSpinner);

