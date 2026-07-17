import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Compass, PlayCircle } from 'lucide-react';
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
      <div className="w-full max-w-md rounded-xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-400/30 dark:bg-primary-500/10">
        <p className="text-sm font-medium text-primary-900 dark:text-primary-200">
          New here? No account needed to preview LusoPronounce.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Link
            to="/tour"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
          >
            <Compass size={18} />
            Take a tour
          </Link>
          <Link
            to="/demo"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-primary-300 bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50 dark:border-primary-400/40 dark:bg-transparent dark:text-primary-300 dark:hover:bg-primary-500/10"
          >
            <PlayCircle size={18} />
            Try the demo
          </Link>
        </div>
      </div>
      <AuthForm onSuccess={handleSuccess} oauthError={oauthError || undefined} />
    </div>
  );
}
