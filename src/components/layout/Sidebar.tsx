import { Link, useLocation } from 'react-router-dom';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/practice/sentence', label: 'Practice Sentences', icon: '💬' },
  { path: '/practice/word', label: 'Practice Words', icon: '📝' },
  { path: '/review', label: 'Review Queue', icon: '🔄' },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="bg-gray-900 dark:bg-gray-950 text-white w-64 min-h-screen p-4 sm:p-6 shadow-lg">
      <nav className="space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${
                isActive ? 'nav-link-active' : 'nav-link-inactive text-gray-300'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm sm:text-base">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

