import { useState, useEffect, FormEvent } from 'react';
import { register, login, devLogin, fetchAuthProviders, type AuthResponse } from '@/api/auth';
import type { User } from '@/shared/types';

interface AuthFormProps {
  onSuccess: (user: User) => void;
  initialMode?: 'login' | 'register';
  oauthError?: string;
}

function GitHubIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M17.04 17.043h-2.962v-4.64c0-1.107-.023-2.531-1.544-2.531-1.544 0-1.78 1.205-1.78 2.451v4.72H7.793V7.5h2.844v1.3h.039c.397-.75 1.364-1.54 2.807-1.54 3.001 0 3.556 1.974 3.556 4.541v5.242zM4.447 6.194a1.72 1.72 0 11-.001-3.44 1.72 1.72 0 010 3.44zM5.93 17.043H2.963V7.5H5.93v9.543zM18.521 0H1.476C.66 0 0 .645 0 1.44v17.12C0 19.355.66 20 1.476 20h17.042c.815 0 1.482-.645 1.482-1.44V1.44C20 .645 19.333 0 18.518 0h.003z" />
    </svg>
  );
}

export default function AuthForm({ onSuccess, initialMode = 'login', oauthError }: AuthFormProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(oauthError || null);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<string[]>(['email']);

  useEffect(() => {
    fetchAuthProviders().then(setProviders);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let response: AuthResponse;

      if (mode === 'register') {
        response = await register(email, password, displayName || undefined);
      } else {
        response = await login(email, password);
      }

      onSuccess(response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">
        {mode === 'login' ? 'Welcome Back' : 'Create Account'}
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      {/* Dev Quick Login */}
      {providers.includes('dev') && (
        <div className="mb-6">
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setError(null);
              setLoading(true);
              try {
                const response = await devLogin();
                onSuccess(response.user);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Dev login failed');
              } finally {
                setLoading(false);
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            Quick Dev Login
          </button>
          <p className="text-xs text-gray-400 text-center mt-1">Development mode only</p>
        </div>
      )}

      {/* OAuth Buttons */}
      {(providers.includes('github') || providers.includes('linkedin')) && (
        <div className="space-y-3 mb-6">
          {providers.includes('github') && (
            <a
              href="/api/auth/oauth/github"
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
            >
              <GitHubIcon />
              Continue with GitHub
            </a>
          )}

          {providers.includes('linkedin') && (
            <a
              href="/api/auth/oauth/linkedin"
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-[#0A66C2] text-white rounded-md hover:bg-[#004182] transition-colors"
            >
              <LinkedInIcon />
              Continue with LinkedIn
            </a>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">or continue with email</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
              Display Name (optional)
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your name"
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="your@email.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === 'register' ? 6 : undefined}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={mode === 'register' ? 'At least 6 characters' : 'Your password'}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {mode === 'login'
            ? "Don't have an account? Register"
            : 'Already have an account? Login'}
        </button>
      </div>
    </div>
  );
}
