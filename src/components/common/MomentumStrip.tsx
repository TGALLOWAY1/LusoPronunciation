import { Link } from 'react-router-dom';
import { Flame, Target, ClipboardList } from 'lucide-react';

interface MomentumStripProps {
  streak: number;
  todayAttempts: number;
  dailyTarget?: number;
  dueCount: number;
}

export default function MomentumStrip({
  streak,
  todayAttempts,
  dailyTarget = 10,
  dueCount,
}: MomentumStripProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
      {/* Streak */}
      <div className="flex items-center gap-1.5" title="Current daily streak">
        <Flame size={16} className={streak > 0 ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'} />
        <span className="font-medium text-gray-900 dark:text-gray-100">{streak}</span>
        <span>day{streak !== 1 ? 's' : ''}</span>
      </div>

      <span className="text-gray-300 dark:text-gray-600">|</span>

      {/* Today's progress */}
      <div className="flex items-center gap-1.5" title="Attempts today">
        <Target size={16} className="text-primary-500" />
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {todayAttempts}
        </span>
        <span>/ {dailyTarget} today</span>
      </div>

      {/* Review due badge */}
      {dueCount > 0 && (
        <>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <Link
            to="/review"
            className="flex items-center gap-1.5 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            title="Items due for review"
          >
            <ClipboardList size={16} className="text-yellow-500" />
            <span className="font-medium text-gray-900 dark:text-gray-100">{dueCount}</span>
            <span>due</span>
          </Link>
        </>
      )}
    </div>
  );
}
