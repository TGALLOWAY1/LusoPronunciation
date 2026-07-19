import { Link, useLocation } from 'react-router-dom';
import {
  navItems,
  tourNavItem,
  devNavItems,
  isDevMode,
  isNavItemActive,
} from './navItems';

export default function Sidebar() {
  const location = useLocation();

  const TourIcon = tourNavItem.icon;

  return (
    <aside className="bg-gray-900 dark:bg-gray-950 text-white w-64 min-h-screen p-4 sm:p-6 shadow-lg flex flex-col">
      <nav className="space-y-2 flex-grow pt-2">
        {navItems.map((item) => {
          const isActive = isNavItemActive(item.path, location.pathname);
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

        {/* Public tour — always available, useful for sharing/portfolio */}
        <div className="pt-4 mt-4 border-t border-gray-700">
          <Link
            to={tourNavItem.path}
            className={`nav-link ${
              location.pathname === tourNavItem.path ? 'nav-link-active' : 'nav-link-inactive text-gray-300'
            }`}
          >
            <TourIcon size={20} className="mr-2" />
            <span className="text-sm sm:text-base">{tourNavItem.label}</span>
          </Link>
        </div>

        {/* Dev-only navigation items */}
        {isDevMode && (
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
        )}
      </nav>
    </aside>
  );
}
