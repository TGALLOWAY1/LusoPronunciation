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

  const { skipped } = await textToSpeechToFile({
    text: params.text,
    voiceName,
    outputPath: location.absolutePath,
  });

  return {
    audioUrl: location.publicUrl,
    absolutePath: location.absolutePath,
    voiceName,
    skipped,
  };
}
