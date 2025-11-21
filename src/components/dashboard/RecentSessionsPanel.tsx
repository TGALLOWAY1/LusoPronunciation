import type { PracticeSession } from '@/lib/types';

interface RecentSessionsPanelProps {
  sessions: PracticeSession[];
}

/**
 * Horizontal layout showing recent practice sessions.
 * Desktop-only component.
 */
export default function RecentSessionsPanel({ sessions }: RecentSessionsPanelProps) {
  if (sessions.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
        No sessions yet
      </p>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getModeIcon = (mode: PracticeSession['mode']) => {
    switch (mode) {
      case 'sentences':
        return '💬';
      case 'words':
        return '📝';
      case 'mixed':
        return '🔄';
      case 'assessment':
        return '📊';
      default:
        return '📚';
    }
  };

  const getModeLabel = (mode: PracticeSession['mode']) => {
    switch (mode) {
      case 'sentences':
        return 'Sentences';
      case 'words':
        return 'Words';
      case 'mixed':
        return 'Mixed';
      case 'assessment':
        return 'Assessment';
      default:
        return 'Practice';
    }
  };

  return (
    <div className="grid grid-cols-5 gap-3">
      {sessions.map((session) => (
        <div
          key={session.sessionId}
          className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-md transition-all group cursor-pointer"
          title={`${getModeLabel(session.mode)} session on ${formatDate(session.startedAt)} at ${formatTime(session.startedAt)}. ${formatDuration(session.durationSeconds)}, ${session.totalAttempts} attempts${session.avgOverallScore !== undefined ? `, ${session.avgOverallScore.toFixed(1)} avg score` : ''}`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xl group-hover:scale-110 transition-transform">{getModeIcon(session.mode)}</span>
            {session.avgOverallScore !== undefined && (
              <span className="text-xs font-bold text-primary-600 dark:text-primary-400 group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">
                {session.avgOverallScore.toFixed(0)}
              </span>
            )}
          </div>
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
              {getModeLabel(session.mode)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatDate(session.startedAt)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatTime(session.startedAt)}
            </div>
            <div className="pt-1.5 border-t border-gray-200 dark:border-gray-700 mt-1.5">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <div>⏱ {formatDuration(session.durationSeconds)}</div>
                <div>🎯 {session.totalAttempts}</div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

