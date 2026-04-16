import { Link } from 'react-router-dom';

interface ActionTarget {
  label: string;
  to: string;
}

interface ActionPanelProps {
  heading: string;
  description: string;
  primaryAction: ActionTarget;
  secondaryAction?: ActionTarget;
  variant?: 'default' | 'success' | 'warning';
}

const variantStyles = {
  default:
    'bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700 text-white',
  success:
    'bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 text-white',
  warning:
    'bg-gradient-to-br from-yellow-500 to-yellow-600 dark:from-yellow-600 dark:to-yellow-700 text-white',
};

export default function ActionPanel({
  heading,
  description,
  primaryAction,
  secondaryAction,
  variant = 'default',
}: ActionPanelProps) {
  return (
    <div
      className={`rounded-lg shadow-lg p-6 ${variantStyles[variant]} hover:shadow-xl transition-shadow`}
    >
      <h3 className="text-xl font-bold mb-2">{heading}</h3>
      <p className="text-sm opacity-90 mb-4">{description}</p>
      <div className="flex flex-wrap gap-3">
        <Link
          to={primaryAction.to}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 font-medium text-sm transition-colors"
        >
          {primaryAction.label}
        </Link>
        {secondaryAction && (
          <Link
            to={secondaryAction.to}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors"
          >
            {secondaryAction.label}
          </Link>
        )}
      </div>
    </div>
  );
}
