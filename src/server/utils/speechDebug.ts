import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

type SpeechLogLevel = 'info' | 'warn' | 'error';

const SPEECH_DEBUG_VALUES = new Set(['1', 'true', 'yes', 'on']);
const SENSITIVE_KEY_PARTS = [
  'reference',
  'pronunciation',
  'header',
  'token',
  'rawazure',
  'nbest',
  'word',
  'payload',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

function redactSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return `[redacted array:${value.length}]`;
  }

  if (isPlainObject(value)) {
    const redacted: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      redacted[key] = isSensitiveKey(key) ? '[redacted]' : redactSensitiveValue(nestedValue);
    }
    return redacted;
  }

  return value;
}

export function isSpeechDebugEnabled(): boolean {
  const value = process.env.SPEECH_DEBUG;
  if (!value) {
    return false;
  }
  return SPEECH_DEBUG_VALUES.has(value.trim().toLowerCase());
}

export function speechLog(
  level: SpeechLogLevel,
  message: string,
  details?: Record<string, unknown>,
  options?: { allowSensitive?: boolean }
): void {
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  const shouldAllowSensitive = Boolean(options?.allowSensitive && isSpeechDebugEnabled());
  const safeDetails = details
    ? (shouldAllowSensitive ? details : (redactSensitiveValue(details) as Record<string, unknown>))
    : undefined;

  if (safeDetails && Object.keys(safeDetails).length > 0) {
    logFn(`[Speech] ${message}`, safeDetails);
    return;
  }

  logFn(`[Speech] ${message}`);
}

export async function writeSpeechDebugDump(filename: string, payload: unknown): Promise<void> {
  if (!isSpeechDebugEnabled()) {
    return;
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const debugDir = join(process.cwd(), 'data', 'debug');
  const filepath = join(debugDir, safeFilename);
  await mkdir(debugDir, { recursive: true });
  await writeFile(filepath, JSON.stringify(payload, null, 2), 'utf-8');

  speechLog('info', 'Speech debug dump written', { file: filepath }, { allowSensitive: true });
}
