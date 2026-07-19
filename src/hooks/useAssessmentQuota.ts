import { useCallback, useEffect, useState } from 'react';
import { authenticatedFetch } from '@/api/auth';

/**
 * Server-reported assessment allowance for the signed-in user.
 * Mirrors the `quota` object returned by the assessment endpoint and the
 * GET /api/assessment-quota read endpoint.
 */
export interface AssessmentQuotaState {
  dailyUsed: number;
  dailyLimit: number;
  lifetimeUsed: number;
  lifetimeLimit: number;
  exempt: boolean;
}

export interface UseAssessmentQuotaResult {
  quota: AssessmentQuotaState | null;
  loading: boolean;
  /** Re-read the current allowance from the server. */
  refresh: () => void;
}

function isQuotaState(value: unknown): value is AssessmentQuotaState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.dailyUsed === 'number' &&
    typeof v.dailyLimit === 'number' &&
    typeof v.lifetimeUsed === 'number' &&
    typeof v.lifetimeLimit === 'number' &&
    typeof v.exempt === 'boolean'
  );
}

/**
 * Reads the current per-user assessment quota (daily + lifetime) from the
 * server so the practice UI can show remaining allowance and honest
 * limit-reached messaging.
 *
 * @param refreshToken - change this (e.g. the attempt count) to trigger a
 *   re-read after each assessment, keeping the displayed allowance fresh.
 */
export function useAssessmentQuota(refreshToken?: unknown): UseAssessmentQuotaResult {
  const [quota, setQuota] = useState<AssessmentQuotaState | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualToken, setManualToken] = useState(0);

  const refresh = useCallback(() => setManualToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const response = await authenticatedFetch('/api/assessment-quota', { method: 'GET' });
        if (!response.ok) {
          return;
        }
        const data = await response.json().catch(() => null);
        if (!cancelled && isQuotaState(data)) {
          setQuota(data);
        }
      } catch {
        // Non-fatal: the quota display is best-effort. Enforcement is server-side.
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshToken, manualToken]);

  return { quota, loading, refresh };
}
