interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: string;
  description?: string;
}

export default function SummaryCard({ title, value, icon, description }: SummaryCardProps) {
  return (
    <div 
      className="card card-hover group cursor-pointer"
      title={description}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{value}</p>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{description}</p>
          )}
        </div>
        <div className="text-3xl opacity-20 dark:opacity-10 group-hover:opacity-30 dark:group-hover:opacity-20 transition-opacity">{icon}</div>
      </div>
    </div>
  );
}

