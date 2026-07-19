import { ReactNode } from 'react';
import { useLocation, Link } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import {
  navItems,
  tourNavItem,
  devNavItems,
  isDevMode,
  isNavItemActive,
} from './navItems';

interface AppLayoutProps {
  children: ReactNode;
}

const sectionLabels: Record<string, string> = {
  '/': 'Practice',
  '/practice/sentence': 'Practice',
  '/practice/word': 'Practice',
  '/builder': 'Sentence Builder',
  '/sentences/custom': 'My Sentences',
  '/review': 'Review',
  '/sessions': 'Review',
  '/progress': 'Progress',
  '/settings': 'Settings',
  '/dev/analytics': 'Dev Analytics',
  '/dev/metrics': 'Dev Metrics',
};

function resolveSection(pathname: string): string {
  const exact = sectionLabels[pathname];
  if (exact) return exact;
  // Dynamic custom-sentence practice route (/practice/custom/:id)
  if (pathname.startsWith('/practice/custom/')) return 'Practice';
  return '';
}

// Items shown in the mobile top nav: everything the sidebar exposes, plus the
// tour, plus dev tools when enabled — so nothing is unreachable on mobile.
const mobileNavItems = [
  ...navItems,
  tourNavItem,
  ...(isDevMode ? devNavItems : []),
];

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const currentSection = resolveSection(location.pathname);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Desktop: sidebar chrome (hidden on mobile) */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <Header currentSection={currentSection} />

        {/* Mobile: top navigation chrome (hidden on desktop) */}
        <nav className="lg:hidden bg-gray-900 dark:bg-gray-950 text-white px-4 py-2 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {mobileNavItems.map((item) => {
              const isActive = isNavItemActive(item.path, location.pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    isActive
                      ? 'bg-primary-500'
                      : 'bg-gray-800 hover:bg-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon size={18} />
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Single content mount — rendered exactly once across breakpoints.
            id + tabIndex let route changes move focus here (see App.tsx). */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 p-4 lg:p-6 overflow-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
