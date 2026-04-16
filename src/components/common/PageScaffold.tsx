import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface ActionConfig {
  label: string;
  to: string;
}

interface PageScaffoldProps {
  title: string;
  subtitle?: string;
  primaryAction?: ActionConfig;
  children: ReactNode;
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '4xl';
}

export default function PageScaffold({
  title,
  subtitle,
  primaryAction,
  children,
  maxWidth = '4xl',
}: PageScaffoldProps) {
  const widthClass = `max-w-${maxWidth}`;

  return (
    <div className={`${widthClass} mx-auto px-4 sm:px-6 py-6 space-y-6`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {primaryAction && (
          <Link to={primaryAction.to} className="btn btn-primary btn-sm shrink-0">
            {primaryAction.label}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}
