import { Clock, Flame, ClipboardList, Target, TrendingUp, TrendingDown, Minus, Lightbulb } from 'lucide-react';
import type { AnalyticsInsight, UserGlobalStats } from '@/lib/types';
import MetricTile from '@/components/common/MetricTile';

interface OverviewSectionProps {
  userStats: UserGlobalStats | null;
  totalAttempts: number;
  todayMinutes: number;
  dueCount: number;
  insights: AnalyticsInsight[];
}

const SEVERITY_ICON = {
  positive: TrendingUp,
  attention: TrendingDown,
  neutral: Minus,
} as const;

const SEVERITY_STYLES = {
  positive:
    'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300',
  attention:
    'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
  neutral:
    'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
} as const;

/**
 * Top-of-dashboard overview: headline metrics + deterministic personalized insights.
 */
export default function OverviewSection({
  userStats,
  totalAttempts,
  todayMinutes,
  dueCount,
  insights,
}: OverviewSectionProps) {
  const currentAvg = userStats?.rolling7DayAvgOverallScore ?? userStats?.rolling30DayAvgOverallScore;
  const trend = computeTrend(userStats);

  return (
    <section id="overview" className="space-y-4 scroll-mt-20">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricTile
          label="Current Score"
          value={currentAvg !== undefined ? Math.round(currentAvg) : '—'}
          icon={Target}
          description="Recent average pronunciation score"
          trend={trend}
        />
        <MetricTile
          label="Total Attempts"
          value={totalAttempts}
          icon={ClipboardList}
          description="Pronunciation attempts recorded"
        />
        <MetricTile
          label="Current Streak"
          value={userStats?.currentDailyStreak ?? 0}
          icon={Flame}
          description="Days practiced in a row"
        />
        <MetricTile
          label="Today's Practice"
          value={`${todayMinutes} min`}
          icon={Clock}
          description="Practice time today"
          action={dueCount > 0 ? { label: `${dueCount} due`, to: '/review' } : undefined}
        />
      </div>

      {insights.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={18} className="text-primary-500 dark:text-primary-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Insights
            </h2>
          </div>
          <div className="space-y-2">
            {insights.map((insight) => {
              const Icon = SEVERITY_ICON[insight.severity];
              return (
                <div
                  key={insight.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${SEVERITY_STYLES[insight.severity]}`}
                >
                  <Icon size={18} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">{insight.title}</p>
                    <p className="text-xs opacity-90 mt-0.5">{insight.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function computeTrend(
  userStats: UserGlobalStats | null,
): { direction: 'up' | 'down' | 'flat'; delta?: string } | undefined {
  if (!userStats) return undefined;
  const recent = userStats.rolling7DayAvgOverallScore;
  const baseline = userStats.rolling30DayAvgOverallScore;
  if (recent === undefined || baseline === undefined) return undefined;
  const delta = recent - baseline;
  if (Math.abs(delta) < 1) return { direction: 'flat' };
  return {
    direction: delta > 0 ? 'up' : 'down',
    delta: `${delta > 0 ? '+' : ''}${delta.toFixed(1)} vs 30-day`,
  };
}
