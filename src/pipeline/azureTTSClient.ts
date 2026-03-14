/**
 * Unified Azure TTS client for the content generation pipeline.
 * 
 * Extracts reusable TTS synthesis logic from existing scripts into a TypeScript module
 * with retry/backoff support for transient errors.
 */

import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { promises as fs } from 'fs';
import * as path from 'path';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

/**
 * Delay helper for rate limiting and backoff.
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Synthesizes text to speech using Azure TTS and saves to a file.
 * 
 * Features:
 * - Idempotent: skips if output file already exists and is non-empty
 * - Retry logic with exponential backoff for transient errors
 * - Automatic directory creation
 * 
 * @param params - Synthesis parameters
 * @param params.text - The text to synthesize (PT-BR)
 * @param params.voiceName - Azure voice name (e.g., "pt-BR-AntonioNeural")
 * @param params.outputPath - Full path where the WAV file should be saved
 * @param params.retryCount - Optional number of retries (default: 3)
 * @returns Promise that resolves with the output path on success
 * @throws {Error} If Azure credentials are missing or synthesis fails after retries
 */
export async function textToSpeechToFile(params: {
  text: string;
  voiceName: string;
  outputPath: string;
  retryCount?: number;
}): Promise<{ outputPath: string; skipped: boolean }> {
  const { text, voiceName, outputPath, retryCount = MAX_RETRIES } = params;
  // Check if file already exists and is non-empty (idempotent behavior)
  try {
    const stats = await fs.stat(outputPath);
    if (stats.size > 0) {
      // File exists and is non-empty, skip re-synthesizing
      return { outputPath, skipped: true };
    }
  } catch {
    // File doesn't exist, proceed with synthesis
  }

  // Read Azure credentials from environment variables
  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;

  if (!speechKey || !speechRegion) {
    throw new Error(
      'Missing Azure Speech credentials. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION environment variables.'
    );
  }

  // Ensure target directory exists
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });

  // Create speech config
  const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
  speechConfig.speechSynthesisLanguage = 'pt-BR';
  speechConfig.speechSynthesisVoiceName = voiceName;

  // Perform synthesis with retries
  let attempt = 0;
  let backoffMs = INITIAL_BACKOFF_MS;

  while (attempt <= retryCount) {
    try {
      await synthesizeOnce(text, speechConfig, outputPath);
      return { outputPath, skipped: false }; // Success
    } catch (err) {
      attempt++;
      const isLastAttempt = attempt > retryCount;

      const message = (err as Error).message ?? String(err);

      // Log the error
      if (isLastAttempt) {
        throw new Error(
          `Failed to synthesize "${text.slice(0, 40)}..." after ${retryCount} retries: ${message}`
        );
      }

      // Determine if this looks like throttling
      const looksLikeThrottling =
        message.includes('429') ||
        message.toLowerCase().includes('throttl') ||
        message.toLowerCase().includes('quota') ||
        message.toLowerCase().includes('rate limit');

      if (looksLikeThrottling) {
        // Exponential backoff for throttling
        await delay(backoffMs);
        backoffMs *= 2;
      } else {
        // Smaller delay for other transient errors
        await delay(INITIAL_BACKOFF_MS);
      }
    }
  }

  // This should never be reached, but TypeScript needs it for type safety
  throw new Error('Unexpected end of retry loop');
}

/**
 * Performs a single synthesis attempt.
 * 
 * @param text - The text to synthesize
 * @param speechConfig - Configured SpeechConfig instance
 * @param outputPath - Output file path
 */
async function synthesizeOnce(
  text: string,
  speechConfig: sdk.SpeechConfig,
  outputPath: string
): Promise<void> {
  // Create audio config for WAV file output
  const audioConfig = sdk.AudioConfig.fromAudioFileOutput(outputPath);

  // Create synthesizer
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

  try {
    const result = await new Promise<sdk.SpeechSynthesisResult>((resolve, reject) => {
      synthesizer.speakTextAsync(
        text,
        (res) => resolve(res),
        (err) => reject(err)
      );
    });

    if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
      return;
    }

    if (result.reason === sdk.ResultReason.Canceled) {
      const details = sdk.CancellationDetails.fromResult(result);
      const errorDetails = details.errorDetails || 'Unknown error';
      throw new Error(
        `Synthesis canceled: ${details.reason} – ${errorDetails}`
      );
    }

    throw new Error(`Unexpected synthesis result: ${result.reason}`);
  } finally {
    synthesizer.close();
  }
}
