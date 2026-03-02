import { ReactNode } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  AlignLeft,
  CaseSensitive,
  Layers,
  History as HistoryIcon,
  BarChart3,
} from 'lucide-react';
import Header from './Header';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  children: ReactNode;
}

const sectionLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/practice/sentence': 'Sentence Practice',
  '/practice/word': 'Word Practice',
  '/review': 'Review Queue',
  '/sessions': 'Recent Sessions',
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
                location.pathname === '/' ? 'bg-primary-500' : 'bg-gray-800 hover:bg-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <LayoutDashboard size={18} />
                Dashboard
              </span>
            </Link>
            <Link
              to="/practice/sentence"
              className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                location.pathname === '/practice/sentence' ? 'bg-primary-500' : 'bg-gray-800 hover:bg-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <AlignLeft size={18} />
                Sentences
              </span>
            </Link>
            <Link
              to="/practice/word"
              className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                location.pathname === '/practice/word' ? 'bg-primary-500' : 'bg-gray-800 hover:bg-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <CaseSensitive size={18} />
                Words
              </span>
            </Link>
            <Link
              to="/review"
              className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                location.pathname === '/review' ? 'bg-primary-500' : 'bg-gray-800 hover:bg-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <Layers size={18} />
                Review
              </span>
            </Link>
            <Link
              to="/sessions"
              className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                location.pathname === '/sessions' ? 'bg-primary-500' : 'bg-gray-800 hover:bg-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <HistoryIcon size={18} />
                History
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
