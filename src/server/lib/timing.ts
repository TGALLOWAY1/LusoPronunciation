export function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>
): Promise<{ label: string; durationMs: number; value: T }> {
  const startedAt = nowMs();
  const value = await fn();
  const durationMs = Math.max(0, Math.round(nowMs() - startedAt));
  return {
    label,
    durationMs,
    value,
  };
}
