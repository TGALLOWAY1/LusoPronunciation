import { ReactNode } from 'react';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  children?: ReactNode;
}

/**
 * Reusable error message component for displaying errors in pages.
 * Used in Dashboard, SentencePractice, WordPractice, etc.
 */
export default function ErrorMessage({ 
  title = 'Error', 
  message, 
  onRetry,
  children 
}: ErrorMessageProps) {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 dark:border-red-500 rounded p-4 mb-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <span className="text-2xl">⚠️</span>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
            {title}
          </h3>
          <div className="mt-2 text-sm text-red-700 dark:text-red-300">
            <p>{message}</p>
            {children}
          </div>
          {onRetry && (
            <div className="mt-4">
              <button
                onClick={onRetry}
                className="btn btn-sm btn-primary"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

