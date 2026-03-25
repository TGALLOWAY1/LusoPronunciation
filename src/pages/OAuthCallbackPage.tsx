import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { handleOAuthCallback } from '@/api/auth';

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      const messages: Record<string, string> = {
        missing_code: 'OAuth authorization was cancelled or failed.',
        token_exchange_failed: 'Failed to verify your account with the provider.',
        no_email: 'No email address found on your account. Please use a provider with a verified email.',
        server_error: 'An unexpected error occurred. Please try again.',
      };
      navigate(`/auth?error=${encodeURIComponent(messages[error] || 'Login failed. Please try again.')}`);
      return;
    }

    if (token) {
      handleOAuthCallback(token);
      navigate('/');
    } else {
      navigate('/auth?error=Login failed. Please try again.');
    }
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}
