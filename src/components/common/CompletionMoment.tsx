import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

interface CompletionMomentProps {
  message: string;
  metric?: string;
  action?: { label: string; to: string };
}

export default function CompletionMoment({ message, metric, action }: CompletionMomentProps) {
  return (
    <div className="card text-center py-8 animate-in">
      <CheckCircle size={48} className="mx-auto text-green-500 dark:text-green-400 mb-4" />
      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        {message}
      </p>
      {metric && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {metric}
        </p>
      )}
      {action && (
        <Link to={action.to} className="btn btn-primary btn-sm mt-2">
          {action.label}
        </Link>
      )}
    </div>
  );
}
