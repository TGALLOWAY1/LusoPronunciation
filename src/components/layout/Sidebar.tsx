import { Link, useLocation } from 'react-router-dom';
import {
  BookOpen,
  RotateCcw,
  BarChart3,
  Settings,
} from 'lucide-react';
import type { ComponentType } from 'react';

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

  return (
    <aside className="bg-gray-900 dark:bg-gray-950 text-white w-64 min-h-screen p-4 sm:p-6 shadow-lg">
      <nav className="space-y-2">
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
