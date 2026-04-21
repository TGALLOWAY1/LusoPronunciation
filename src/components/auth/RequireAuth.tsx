import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '@/api/auth';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
}
