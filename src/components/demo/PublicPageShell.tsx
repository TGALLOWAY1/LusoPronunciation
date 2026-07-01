import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Compass, PlayCircle, LogIn } from 'lucide-react';

interface PublicPageShellProps {
  children: ReactNode;
}

/**
 * Standalone, unauthenticated layout for the public marketing surfaces
 * (`/tour` and `/demo`). Deliberately independent of the authenticated
 * AppLayout/Sidebar so recruiters and first-time visitors can explore the
 * product without hitting the login-gated app shell.
 */
export default function PublicPageShell({ children }: PublicPageShellProps) {
  const { pathname } = useLocation();

  const navLink = (to: string, label: string, Icon: typeof Compass) => {
    const active = pathname === to;
    return (
      <Link
        to={to}
        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          active
            ? 'bg-primary-500 text-white'
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
        }`}
      >
        <Icon size={16} />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-gray-900">
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-gray-800/90 backdrop-blur border-b border-gray-200/70 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link to="/tour" className="flex items-center gap-2">
            <span className="text-lg sm:text-xl font-bold text-primary-600 dark:text-primary-400">
              🇧🇷 LusoPronounce
            </span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            {navLink('/tour', 'Take a Tour', Compass)}
            {navLink('/demo', 'Try the Demo', PlayCircle)}
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
            >
              <LogIn size={16} />
              <span className="hidden sm:inline">Sign in</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full">{children}</main>

      <footer className="border-t border-gray-200/70 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p>
            LusoPronounce — a Brazilian Portuguese pronunciation trainer built with React, TypeScript, and Azure Speech.
          </p>
          <p>
            This tour and demo use sample data. No account or microphone required.
          </p>
        </div>
      </footer>
    </div>
  );
}
