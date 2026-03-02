import type { ConfusionTag } from './minimalPairs.ptbr';

export type CoachingKind = 'retry' | 'minimal_pairs' | 'rhythm' | 'clarity' | 'coverage';
export type CoachingEventName = 'coaching_shown' | 'coaching_cta_clicked' | 'minimal_pairs_opened';

export type CoachingTelemetryEvent = {
  event: CoachingEventName;
  kind: CoachingKind;
  tags?: ConfusionTag[];
  createdAt: string;
};

export const COACHING_METRICS_STORAGE_KEY = 'luso.metrics.coaching.v1';
const COACHING_METRICS_MAX_RECORDS = 400;

function isLocalStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isValidEventName(value: unknown): value is CoachingEventName {
  return (
    value === 'coaching_shown' ||
    value === 'coaching_cta_clicked' ||
    value === 'minimal_pairs_opened'
  );
}

function isValidKind(value: unknown): value is CoachingKind {
  return (
    value === 'retry' ||
    value === 'minimal_pairs' ||
    value === 'rhythm' ||
    value === 'clarity' ||
    value === 'coverage'
  );
}

export function readCoachingTelemetryEvents(): CoachingTelemetryEvent[] {
  if (!isLocalStorageAvailable()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(COACHING_METRICS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is CoachingTelemetryEvent => {
      return (
        item &&
        typeof item === 'object' &&
        isValidEventName((item as CoachingTelemetryEvent).event) &&
        isValidKind((item as CoachingTelemetryEvent).kind) &&
        typeof (item as CoachingTelemetryEvent).createdAt === 'string'
      );
    });
  } catch {
    return [];
  }
}

export function writeCoachingTelemetryEvents(events: CoachingTelemetryEvent[]): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  window.localStorage.setItem(
    COACHING_METRICS_STORAGE_KEY,
    JSON.stringify(events.slice(0, COACHING_METRICS_MAX_RECORDS))
  );
}

export function appendCoachingTelemetryEvent(
  event: Omit<CoachingTelemetryEvent, 'createdAt'>
): void {
  const existing = readCoachingTelemetryEvents();
  const next: CoachingTelemetryEvent = {
    ...event,
    createdAt: new Date().toISOString(),
  };
  writeCoachingTelemetryEvents([next, ...existing]);
}

export function clearCoachingTelemetryEvents(): void {
  if (!isLocalStorageAvailable()) {
    return;
  }
  window.localStorage.removeItem(COACHING_METRICS_STORAGE_KEY);
}
