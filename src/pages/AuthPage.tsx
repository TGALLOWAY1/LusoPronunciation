import { useNavigate } from 'react-router-dom';
import AuthForm from '@/components/auth/AuthForm';
import type { User } from '@/shared/types';

export default function AuthPage() {
  const navigate = useNavigate();

  const handleSuccess = (user: User) => {
    // Redirect to dashboard after successful auth
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <AuthForm onSuccess={handleSuccess} />
    </div>
  );
}

