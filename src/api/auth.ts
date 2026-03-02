/**
 * Authentication API client
 * Handles registration, login, and token management
 */

import type { User } from '../shared/types';
import {
  appendAttemptTelemetryRecord,
  createAttemptTelemetryRecord,
} from '@/lib/attemptMetrics';
import { ERROR_CLASS, isErrorClass } from '@/lib/errorTaxonomy';
import { writeSpeechServiceHealthRecord } from '@/lib/speechServiceHealth';

const AUTH_TOKEN_KEY = 'luso_auth_token';

type SpeechServiceHealthResponse = {
  ok: boolean;
  checkedAt: string;
  requestId: string;
  error?: string;
  message?: string;
  errorClass?: string;
  httpStatus?: number;
};

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

  // Fire-and-forget speech health ping after login to detect outage early.
  void pingSpeechServiceHealth();

  return data;
}

function recordSpeechHealthFailure(params: {
  checkedAt: string;
  requestId: string | null;
  httpStatus: number | null;
  message: string | null;
}): void {
  writeSpeechServiceHealthRecord({
    checkedAt: params.checkedAt,
    ok: false,
    requestId: params.requestId,
    errorClass: ERROR_CLASS.azureServiceUnavailable,
    httpStatus: params.httpStatus,
    message: params.message,
  });

  const telemetry = createAttemptTelemetryRecord(`speech_health_${Date.now()}`);
  telemetry.createdAt = params.checkedAt;
  telemetry.requestId = params.requestId;
  telemetry.error.errorClass = ERROR_CLASS.azureServiceUnavailable;
  telemetry.error.httpStatus = params.httpStatus;
  appendAttemptTelemetryRecord(telemetry);
}

export async function pingSpeechServiceHealth(): Promise<void> {
  const checkedAt = new Date().toISOString();

  try {
    const response = await authenticatedFetch('/api/pronunciation/speech-health', {
      method: 'GET',
    });
    const payload = (await response.json().catch(() => null)) as SpeechServiceHealthResponse | null;
    const requestId = payload?.requestId ?? response.headers.get('X-Request-Id');

    if (!response.ok || !payload?.ok) {
      const errorClass = isErrorClass(payload?.errorClass)
        ? payload.errorClass
        : ERROR_CLASS.azureServiceUnavailable;
      recordSpeechHealthFailure({
        checkedAt: payload?.checkedAt ?? checkedAt,
        requestId,
        httpStatus: payload?.httpStatus ?? response.status,
        message: payload?.message ?? payload?.error ?? 'Speech service health check failed.',
      });

      // Keep persisted class as the route-specific failure bucket.
      if (errorClass !== ERROR_CLASS.azureServiceUnavailable) {
        writeSpeechServiceHealthRecord({
          checkedAt: payload?.checkedAt ?? checkedAt,
          ok: false,
          requestId,
          errorClass,
          httpStatus: payload?.httpStatus ?? response.status,
          message: payload?.message ?? payload?.error ?? 'Speech service health check failed.',
        });
      }
      return;
    }

    writeSpeechServiceHealthRecord({
      checkedAt: payload.checkedAt,
      ok: true,
      requestId: payload.requestId,
      errorClass: null,
      httpStatus: response.status,
      message: null,
    });
  } catch (error) {
    recordSpeechHealthFailure({
      checkedAt,
      requestId: null,
      httpStatus: null,
      message: error instanceof Error ? error.message : 'Speech service health check failed.',
    });
  }
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
