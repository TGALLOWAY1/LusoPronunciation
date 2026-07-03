import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthForm from '@/components/auth/AuthForm';
import type { User } from '@/shared/types';

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oauthError = searchParams.get('error');

  const handleSuccess = (_user: User) => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <AuthForm onSuccess={handleSuccess} oauthError={oauthError || undefined} />
      <p className="mt-6 text-sm text-gray-500 dark:text-gray-400 text-center">
        New here? <Link to="/tour" className="text-primary-600 dark:text-primary-400 font-medium hover:underline">Take a tour</Link>
        {' '}or{' '}
        <Link to="/demo" className="text-primary-600 dark:text-primary-400 font-medium hover:underline">try the demo</Link>
        {' '}— no account needed.
      </p>
    </div>
  );
}
