import type { ErrorClass } from '@/lib/errorTaxonomy';

export const SPEECH_SERVICE_HEALTH_STORAGE_KEY = 'luso.metrics.speech-health.v1';

export type SpeechServiceHealthRecord = {
  checkedAt: string;
  ok: boolean;
  requestId: string | null;
  errorClass: ErrorClass | null;
  httpStatus: number | null;
  message: string | null;
};

function isLocalStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readSpeechServiceHealthRecord(): SpeechServiceHealthRecord | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SPEECH_SERVICE_HEALTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    if (typeof parsed.checkedAt !== 'string' || typeof parsed.ok !== 'boolean') {
      return null;
    }

    return {
      checkedAt: parsed.checkedAt,
      ok: parsed.ok,
      requestId: typeof parsed.requestId === 'string' ? parsed.requestId : null,
      errorClass: typeof parsed.errorClass === 'string' ? parsed.errorClass : null,
      httpStatus: typeof parsed.httpStatus === 'number' ? parsed.httpStatus : null,
      message: typeof parsed.message === 'string' ? parsed.message : null,
    };
  } catch {
    return null;
  }
}

export function writeSpeechServiceHealthRecord(record: SpeechServiceHealthRecord): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  window.localStorage.setItem(SPEECH_SERVICE_HEALTH_STORAGE_KEY, JSON.stringify(record));
}

export function clearSpeechServiceHealthRecord(): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  window.localStorage.removeItem(SPEECH_SERVICE_HEALTH_STORAGE_KEY);
}
