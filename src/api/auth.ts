/**
 * Authentication API client
 * Handles registration, login, and token management
 */

import type { User } from '../shared/types';

const AUTH_TOKEN_KEY = 'luso_auth_token';

/**
 * Auth response from API
 */
export interface AuthResponse {
  token: string;
  user: User;
}

/**
 * Register a new user
 */
export async function register(
  email: string,
  password: string,
  displayName?: string
): Promise<AuthResponse> {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, displayName }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
  }

  const data: AuthResponse = await response.json();
  
  // Store token
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
  }

  return data;
}

/**
 * Login with email and password
 */
export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
  }

  const data: AuthResponse = await response.json();
  
  // Store token
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
  }

  return data;
}

/**
 * Logout (clears token)
 */
export function logout(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

/**
 * Get stored auth token
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Check if user is authenticated (has token)
 */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}

/**
 * Get authorization header value for API requests
 */
export function getAuthHeader(): string | null {
  const token = getAuthToken();
  return token ? `Bearer ${token}` : null;
}

/**
 * Fetch wrapper that automatically adds auth header
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const authHeader = getAuthHeader();
  const headers = new Headers(options.headers);

  if (authHeader) {
    headers.set('Authorization', authHeader);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

