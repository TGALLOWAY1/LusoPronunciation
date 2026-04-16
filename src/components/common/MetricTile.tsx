import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';

interface MetricTileProps {
  label: string;
  value: string | number;
  icon: ComponentType<{ size?: number; className?: string }>;
  description?: string;
  trend?: { direction: 'up' | 'down' | 'flat'; delta?: string };
  action?: { label: string; to: string };
}

export default function MetricTile({
  label,
  value,
  icon: Icon,
  description,
  trend,
  action,
}: MetricTileProps) {
  return (
    <div className="card card-hover group" title={description}>
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {label}
        </p>
        <Icon
          size={20}
          className="text-gray-300 dark:text-gray-600 group-hover:text-primary-400 dark:group-hover:text-primary-500 transition-colors"
        />
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
        {value}
      </p>
      {trend && (
        <p className={`text-xs mt-1 ${
          trend.direction === 'up'
            ? 'text-green-600 dark:text-green-400'
            : trend.direction === 'down'
              ? 'text-red-600 dark:text-red-400'
              : 'text-gray-500 dark:text-gray-400'
        }`}>
          {trend.direction === 'up' ? '\u2191' : trend.direction === 'down' ? '\u2193' : '\u2192'}
          {trend.delta && ` ${trend.delta}`}
        </p>
      )}
      {action && (
        <Link
          to={action.to}
          className="text-xs text-primary-600 dark:text-primary-400 hover:underline mt-2 inline-block"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
