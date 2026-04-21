import { Link, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import {
  BookOpen,
  RotateCcw,
  BarChart3,
  Settings,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import { useProgressStore } from '@/state/progressStore';
import { computeUserGlobalStats } from '@/lib/practiceAnalytics';
import MomentumStrip from '@/components/common/MomentumStrip';

interface NavItem {
  path: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Practice', icon: BookOpen },
  { path: '/review', label: 'Review', icon: RotateCcw },
  { path: '/progress', label: 'Progress', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

// Dev-only navigation items
const devNavItems: NavItem[] = [
  { path: '/dev/analytics', label: 'Dev Analytics', icon: BarChart3 },
  { path: '/dev/metrics', label: 'Dev Metrics', icon: BarChart3 },
];

// Check if dev features should be enabled
const isDevMode = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_ANALYTICS === 'true';

export default function Sidebar() {
  const location = useLocation();

  const { sessions, sentenceAttempts, wordAttempts } = usePracticeLogStore();
  const { getDueCount } = useProgressStore();
  const dueCount = getDueCount();

  const streak = useMemo(() => {
    if (sessions.length === 0) return 0;
    const stats = computeUserGlobalStats(sessions, sentenceAttempts, wordAttempts, 0, 0);
    return stats.currentDailyStreak;
  }, [sessions, sentenceAttempts, wordAttempts]);

  const todayAttempts = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const sentenceCount = sentenceAttempts.filter(
      (a) => new Date(a.createdAt).toISOString().split('T')[0] === todayStr,
    ).length;
    const wordCount = wordAttempts.filter(
      (a) => new Date(a.createdAt).toISOString().split('T')[0] === todayStr,
    ).length;
    return sentenceCount + wordCount;
  }, [sentenceAttempts, wordAttempts]);

  return (
    <aside className="bg-gray-900 dark:bg-gray-950 text-white w-64 min-h-screen p-4 sm:p-6 shadow-lg flex flex-col">
      <div className="mb-6 -mx-2 bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
        <MomentumStrip
          streak={streak}
          todayAttempts={todayAttempts}
          dueCount={dueCount}
        />
      </div>
      <nav className="space-y-2 flex-grow">
        {navItems.map((item) => {
          const isActive = item.path === '/'
            ? location.pathname === '/' || location.pathname.startsWith('/practice')
            : location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${
                isActive ? 'nav-link-active' : 'nav-link-inactive text-gray-300'
              }`}
            >
              <Icon size={20} className="mr-2" />
              <span className="text-sm sm:text-base">{item.label}</span>
            </Link>
          );
        })}
        
        {/* Dev-only navigation items */}
        {isDevMode && (
          <>
            <div className="pt-4 mt-4 border-t border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-2 uppercase tracking-wider">
                Dev Tools
              </p>
              {devNavItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`nav-link ${
                      isActive ? 'nav-link-active' : 'nav-link-inactive text-gray-300'
                    }`}
                  >
                    <Icon size={20} className="mr-2" />
                    <span className="text-sm sm:text-base">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </nav>
    </aside>
  );
}
