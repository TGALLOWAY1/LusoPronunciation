/**
 * Filesystem storage for TTS audio generated for user-created sentences.
 *
 * Layout:
 *   <baseDir>/<userId>/<sentenceId>.wav
 *
 * The base directory defaults to `<repoRoot>/public/audio/custom` so the file
 * is served by Vite in dev and by Express static in production (see
 * `src/server/app.ts` for the runtime mount). Override with
 * `CUSTOM_AUDIO_DIR` for tests or alternate deployment layouts.
 */

import { promises as fs } from 'fs';
import * as path from 'path';

const LOG_TAG = '[CustomAudioStorage]';

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export function getCustomAudioBaseDir(): string {
  if (process.env.CUSTOM_AUDIO_DIR && process.env.CUSTOM_AUDIO_DIR.trim().length > 0) {
    return path.resolve(process.env.CUSTOM_AUDIO_DIR);
  }
  return path.resolve(process.cwd(), 'public', 'audio', 'custom');
}

function assertSafeId(value: string, label: string): void {
  if (!SAFE_ID.test(value)) {
    throw new Error(`${label} contains unsafe characters: ${value}`);
  }
}

export interface CustomAudioLocation {
  /** Absolute filesystem path where the WAV should be written. */
  absolutePath: string;
  /** Public URL path that should be stored on the sentence document. */
  publicUrl: string;
  /** Directory that must exist before writing. */
  directory: string;
}

export function buildCustomAudioLocation(
  userId: string,
  sentenceId: string
): CustomAudioLocation {
  assertSafeId(userId, 'userId');
  assertSafeId(sentenceId, 'sentenceId');

  const baseDir = getCustomAudioBaseDir();
  const directory = path.join(baseDir, userId);
  const absolutePath = path.join(directory, `${sentenceId}.wav`);
  const publicUrl = `/audio/custom/${userId}/${sentenceId}.wav`;
  return { absolutePath, publicUrl, directory };
}

export async function ensureCustomAudioDirectory(userId: string): Promise<void> {
  assertSafeId(userId, 'userId');
  const dir = path.join(getCustomAudioBaseDir(), userId);
  await fs.mkdir(dir, { recursive: true });
}

export async function deleteCustomAudio(
  userId: string,
  sentenceId: string
): Promise<void> {
  const { absolutePath } = buildCustomAudioLocation(userId, sentenceId);
  try {
    await fs.unlink(absolutePath);
    console.log(`${LOG_TAG} deleted ${absolutePath}`);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    console.warn(`${LOG_TAG} failed to delete ${absolutePath}:`, err);
  }
}
