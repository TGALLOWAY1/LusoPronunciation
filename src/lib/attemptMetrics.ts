import type { ErrorClass } from '@/lib/errorTaxonomy';

export const ATTEMPT_METRICS_STORAGE_KEY = 'luso.metrics.attempts.v1';
export const ATTEMPT_METRICS_MAX_RECORDS = 200;

export type ClientTimingsMs = {
  submitToResponseMs: number | null;
  responseToRenderMs: number | null;
};

export type ServerTimingsMs = {
  convertMs: number | null;
  azureMs: number | null;
  normalizeMs: number | null;
};

export type AttemptTelemetryRecord = {
  attemptId: string;
  requestId: string | null;
  timeToFeedbackMs: number | null;
  clientTimingsMs: ClientTimingsMs;
  serverTimingsMs: ServerTimingsMs;
  flags: {
    fallbackUsed: boolean;
    canceled: boolean;
  };
  error: {
    errorClass: ErrorClass | null;
    httpStatus: number | null;
  };
  createdAt: string;
};

export function createAttemptTelemetryRecord(attemptId: string): AttemptTelemetryRecord {
  return {
    attemptId,
    requestId: null,
    timeToFeedbackMs: null,
    clientTimingsMs: {
      submitToResponseMs: null,
      responseToRenderMs: null,
    },
    serverTimingsMs: {
      convertMs: null,
      azureMs: null,
      normalizeMs: null,
    },
    flags: {
      fallbackUsed: false,
      canceled: false,
    },
    error: {
      errorClass: null,
      httpStatus: null,
    },
    createdAt: new Date().toISOString(),
  };
}

function isLocalStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readAttemptTelemetryRecords(): AttemptTelemetryRecord[] {
  if (!isLocalStorageAvailable()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(ATTEMPT_METRICS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is AttemptTelemetryRecord => {
      return (
        item &&
        typeof item === 'object' &&
        typeof item.attemptId === 'string' &&
        typeof item.createdAt === 'string'
      );
    });
  } catch {
    return [];
  }
}

export function writeAttemptTelemetryRecords(records: AttemptTelemetryRecord[]): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  window.localStorage.setItem(
    ATTEMPT_METRICS_STORAGE_KEY,
    JSON.stringify(records.slice(0, ATTEMPT_METRICS_MAX_RECORDS))
  );
}

export function appendAttemptTelemetryRecord(record: AttemptTelemetryRecord): void {
  const existing = readAttemptTelemetryRecords();
  const updated = [record, ...existing].slice(0, ATTEMPT_METRICS_MAX_RECORDS);
  writeAttemptTelemetryRecords(updated);
}

export function clearAttemptTelemetryRecords(): void {
  if (!isLocalStorageAvailable()) {
    return;
  }
  window.localStorage.removeItem(ATTEMPT_METRICS_STORAGE_KEY);
}

export function computeMedian(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

export function computePercentile(values: number[], percentile: number): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const boundedPercentile = Math.min(1, Math.max(0, percentile));
  const index = Math.max(0, Math.ceil(boundedPercentile * sorted.length) - 1);
  return sorted[index];
}
