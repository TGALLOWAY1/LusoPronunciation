import { ReactNode } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  BookOpen,
  RotateCcw,
  BarChart3,
  Settings,
} from 'lucide-react';
import Header from './Header';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  children: ReactNode;
}

const sectionLabels: Record<string, string> = {
  '/': 'Practice',
  '/practice/sentence': 'Practice',
  '/practice/word': 'Practice',
  '/review': 'Review',
  '/sessions': 'Review',
  '/progress': 'Progress',
  '/settings': 'Settings',
  '/dev/analytics': 'Dev Analytics',
  '/dev/metrics': 'Dev Metrics',
};

// Check if dev features should be enabled
const isDevMode = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_ANALYTICS === 'true';

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const currentSection = sectionLabels[location.pathname] || '';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Mobile: Top navigation */}
      <div className="lg:hidden">
        <Header currentSection={currentSection} />
        <nav className="bg-gray-900 dark:bg-gray-950 text-white px-4 py-2 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            <Link
              to="/"
              className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                location.pathname === '/' || location.pathname.startsWith('/practice') ? 'bg-primary-500' : 'bg-gray-800 hover:bg-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <BookOpen size={18} />
                Practice
              </span>
            </Link>
            <Link
              to="/review"
              className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                location.pathname === '/review' ? 'bg-primary-500' : 'bg-gray-800 hover:bg-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <RotateCcw size={18} />
                Review
              </span>
            </Link>
            <Link
              to="/progress"
              className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                location.pathname === '/progress' ? 'bg-primary-500' : 'bg-gray-800 hover:bg-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <BarChart3 size={18} />
                Progress
              </span>
            </Link>
            <Link
              to="/settings"
              className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                location.pathname === '/settings' ? 'bg-primary-500' : 'bg-gray-800 hover:bg-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <Settings size={18} />
                Settings
              </span>
            </Link>
            {/* Dev-only navigation items */}
            {isDevMode && (
              <>
                <Link
                  to="/dev/analytics"
                  className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    location.pathname === '/dev/analytics' ? 'bg-primary-500' : 'bg-gray-800 hover:bg-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <BarChart3 size={18} />
                    Dev Analytics
                  </span>
                </Link>
                <Link
                  to="/dev/metrics"
                  className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    location.pathname === '/dev/metrics' ? 'bg-primary-500' : 'bg-gray-800 hover:bg-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <BarChart3 size={18} />
                    Dev Metrics
                  </span>
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>

      {/* Desktop: Sidebar layout */}
      <div className="hidden lg:flex lg:flex-row lg:min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header currentSection={currentSection} />
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile: Content area */}
      <div className="lg:hidden flex-1 p-4">
        {children}
      </div>
    </div>
  );
}
