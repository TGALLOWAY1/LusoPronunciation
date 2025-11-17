interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: string;
  description?: string;
}

export default function SummaryCard({ title, value, icon, description }: SummaryCardProps) {
  return (
    <div className="card card-hover">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{description}</p>
          )}
        </div>
        <div className="text-4xl opacity-20 dark:opacity-10">{icon}</div>
      </div>
    </div>
  );
}

