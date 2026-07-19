import {
  BookOpen,
  Library,
  PenSquare,
  RotateCcw,
  BarChart3,
  Settings,
  Compass,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface NavItem {
  path: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}

/**
 * Single source of truth for primary navigation. Consumed by both the desktop
 * sidebar and the mobile top nav so the two never drift out of sync.
 */
export const navItems: NavItem[] = [
  { path: '/', label: 'Practice', icon: BookOpen },
  { path: '/builder', label: 'Sentence Builder', icon: PenSquare },
  { path: '/sentences/custom', label: 'My Sentences', icon: Library },
  { path: '/review', label: 'Review', icon: RotateCcw },
  { path: '/progress', label: 'Progress', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

/** Public tour — always available, useful for sharing/portfolio. */
export const tourNavItem: NavItem = {
  path: '/tour',
  label: 'Take a Tour',
  icon: Compass,
};

/** Dev-only navigation items, gated behind {@link isDevMode}. */
export const devNavItems: NavItem[] = [
  { path: '/dev/analytics', label: 'Dev Analytics', icon: BarChart3 },
  { path: '/dev/metrics', label: 'Dev Metrics', icon: BarChart3 },
];

/** Whether dev navigation/tooling should be surfaced. */
export const isDevMode =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_ANALYTICS === 'true';

/**
 * Active-state matcher shared by both nav chromes. The Practice entry (`/`)
 * also owns every `/practice/*` route.
 */
export function isNavItemActive(path: string, pathname: string): boolean {
  return path === '/'
    ? pathname === '/' || pathname.startsWith('/practice')
    : pathname === path;
}
