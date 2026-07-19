/**
 * TTS wrapper for the Custom Sentence Builder pipeline.
 *
 * Delegates synthesis to the existing content-pipeline client
 * (`src/pipeline/azureTTSClient.ts`) and layers on:
 *   - Standardized voice selection (default: pt-BR-FranciscaNeural)
 *   - Return of the public URL path that clients should use
 *   - Optional lazy directory creation
 */

import * as path from 'path';
import { textToSpeechToFile } from '../../pipeline/azureTTSClient';
import {
  buildCustomAudioLocation,
  ensureCustomAudioDirectory,
} from './customAudioStorage';

const LOG_TAG = '[TTS]';

export const DEFAULT_PT_BR_VOICE = 'pt-BR-FranciscaNeural';

const DEFAULT_TTS_TIMEOUT_MS = 30_000;

function getTtsTimeoutMs(): number {
  const rawValue = process.env.CUSTOM_SENTENCE_TTS_TIMEOUT_MS;
  if (!rawValue) {
    return DEFAULT_TTS_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTS_TIMEOUT_MS;
}

/**
 * Azure's Speech SDK (`speakTextAsync`, used under the hood by
 * `textToSpeechToFile`) has no built-in request timeout, and offers no
 * signal/cancellation hook we can pass in from the call site. We can't cancel
 * the underlying synthesis call, but we can stop waiting on it so a stalled
 * Azure TTS connection can't hang the whole custom-sentence pipeline forever.
 */
export class TtsTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Azure TTS synthesis timed out after ${timeoutMs}ms`);
    this.name = 'TtsTimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TtsTimeoutError(timeoutMs)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export interface PortugueseTTSParams {
  text: string;
  userId: string;
  sentenceId: string;
  voiceName?: string;
}

export interface PortugueseTTSResult {
  audioUrl: string;
  absolutePath: string;
  voiceName: string;
  skipped: boolean;
}

export async function generatePortugueseTTS(
  params: PortugueseTTSParams
): Promise<PortugueseTTSResult> {
  const voiceName = params.voiceName ?? DEFAULT_PT_BR_VOICE;
  const location = buildCustomAudioLocation(params.userId, params.sentenceId);

  await ensureCustomAudioDirectory(params.userId);

  console.log(
    `${LOG_TAG} synthesizing ${params.text.length} chars → ${path.basename(location.absolutePath)} (voice=${voiceName})`
  );

  const { skipped } = await withTimeout(
    textToSpeechToFile({
      text: params.text,
      voiceName,
      outputPath: location.absolutePath,
    }),
    getTtsTimeoutMs()
  );

  return {
    audioUrl: location.publicUrl,
    absolutePath: location.absolutePath,
    voiceName,
    skipped,
  };
}
