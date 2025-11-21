import { useMemo } from 'react';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import type { PracticeSession } from '@/lib/types';

export default function RecentSessions() {
  const { sessions } = usePracticeLogStore();

  // Group sessions by date
  const sessionsByDate = useMemo(() => {
    const grouped = new Map<string, PracticeSession[]>();
    
    // Sort sessions by date (most recent first)
    const sortedSessions = [...sessions].sort((a, b) => {
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });

    for (const session of sortedSessions) {
      const date = new Date(session.startedAt);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(session);
    }

    // Convert to array and sort dates descending
    return Array.from(grouped.entries()).sort((a, b) => {
      return b[0].localeCompare(a[0]); // Most recent dates first
    });
  }, [sessions]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
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
    <div className="w-full px-8 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          Recent Sessions
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          View your recent practice sessions organized by date
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-2">📊</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No sessions yet
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Start practicing to see your session history here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sessionsByDate.map(([dateKey, dateSessions]) => {
            const firstSession = dateSessions[0];
            const displayDate = formatDate(firstSession.startedAt);
            
            return (
              <div key={dateKey} className="card">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                  {displayDate}
                </h2>
                <div className="grid grid-cols-5 gap-3">
                  {dateSessions.map((session) => (
                    <div
                      key={session.sessionId}
                      className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-md transition-all group cursor-pointer"
                      title={`${getModeLabel(session.mode)} session at ${formatTime(session.startedAt)}. ${formatDuration(session.durationSeconds)}, ${session.totalAttempts} attempts${session.avgOverallScore !== undefined ? `, ${session.avgOverallScore.toFixed(1)} avg score` : ''}`}
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

