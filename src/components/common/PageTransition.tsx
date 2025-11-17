import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Simple fade-in transition wrapper for page content.
 * Provides smooth transitions between routes.
 */
export default function PageTransition({ children }: PageTransitionProps) {
  return (
    <div className="animate-in fade-in duration-200">
      {children}
    </div>
  );
}

