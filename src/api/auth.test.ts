import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { login } from './auth';
import { SPEECH_SERVICE_HEALTH_STORAGE_KEY } from '@/lib/speechServiceHealth';
import { ATTEMPT_METRICS_STORAGE_KEY } from '@/lib/attemptMetrics';
import { ERROR_CLASS } from '@/lib/errorTaxonomy';

describe('auth login speech health ping', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('pings speech health after login and stores healthy status', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: 'jwt-token',
            user: { id: 'u1', email: 'test@example.com' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            checkedAt: new Date().toISOString(),
            requestId: 'req-health-1',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    await login('test@example.com', 'password123');
    await vi.waitFor(() => {
      expect(window.localStorage.getItem(SPEECH_SERVICE_HEALTH_STORAGE_KEY)).not.toBeNull();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/pronunciation/speech-health',
      expect.objectContaining({ method: 'GET' })
    );
    const stored = JSON.parse(
      window.localStorage.getItem(SPEECH_SERVICE_HEALTH_STORAGE_KEY) || 'null'
    );
    expect(stored).toEqual(
      expect.objectContaining({
        ok: true,
        errorClass: null,
      })
    );
  });

  it('stores special outage error when speech health ping fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: 'jwt-token',
            user: { id: 'u1', email: 'test@example.com' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    vi.stubGlobal('fetch', fetchMock);

    await login('test@example.com', 'password123');
    await vi.waitFor(() => {
      expect(window.localStorage.getItem(SPEECH_SERVICE_HEALTH_STORAGE_KEY)).not.toBeNull();
    });

    const stored = JSON.parse(
      window.localStorage.getItem(SPEECH_SERVICE_HEALTH_STORAGE_KEY) || 'null'
    );
    expect(stored).toEqual(
      expect.objectContaining({
        ok: false,
        errorClass: ERROR_CLASS.azureServiceUnavailable,
      })
    );

    const attempts = JSON.parse(window.localStorage.getItem(ATTEMPT_METRICS_STORAGE_KEY) || '[]');
    expect(attempts[0]?.error?.errorClass).toBe(ERROR_CLASS.azureServiceUnavailable);
  });
});
