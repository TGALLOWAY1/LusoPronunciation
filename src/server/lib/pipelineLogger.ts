/**
 * Structured per-stage logger for multi-step server pipelines.
 *
 * Emits a single line per stage in the form:
 *   [pipeline:stage] {"userId":"…","durationMs":123,"tokens":4}
 *
 * Callers can wrap an async stage in `timeStage` to automatically record
 * its duration and log either a success (info) or failure (error) entry.
 * The logger never throws — logging problems must not take down the
 * request.
 */

export type PipelineLogLevel = 'info' | 'warn' | 'error';

export interface PipelineLogEntry {
  pipeline: string;
  stage: string;
  userId?: string;
  sentenceId?: string;
  durationMs?: number;
  data?: Record<string, unknown>;
  level?: PipelineLogLevel;
}

export function logStage(entry: PipelineLogEntry): void {
  const level: PipelineLogLevel = entry.level ?? 'info';
  const prefix = `[${entry.pipeline}:${entry.stage}]`;
  const payload: Record<string, unknown> = {};
  if (entry.userId) payload.userId = entry.userId;
  if (entry.sentenceId) payload.sentenceId = entry.sentenceId;
  if (typeof entry.durationMs === 'number') payload.durationMs = entry.durationMs;
  if (entry.data) Object.assign(payload, entry.data);

  let serialized: string;
  try {
    serialized = JSON.stringify(payload);
  } catch {
    serialized = '"<unserializable>"';
  }

  const line = `${prefix} ${serialized}`;
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export async function timeStage<T>(
  entry: Omit<PipelineLogEntry, 'durationMs' | 'level'>,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    logStage({ ...entry, durationMs: Date.now() - start });
    return result;
  } catch (err) {
    logStage({
      ...entry,
      durationMs: Date.now() - start,
      level: 'error',
      data: {
        ...(entry.data ?? {}),
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}
