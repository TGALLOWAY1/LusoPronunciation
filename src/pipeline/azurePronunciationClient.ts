/**
 * Azure Pronunciation Assessment client for the content generation pipeline.
 * 
 * Provides a reusable client for assessing audio files using Azure Speech Service
 * pronunciation assessment API. Maps Azure responses to AttemptScore format.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { mapAzurePronunciationResultToAttemptScore } from '../lib/pronunciationUtils';
import type { AttemptScore } from '../types/pronunciation';

/**
 * Gets Azure Speech configuration from environment variables.
 */
function getAzureSpeechConfig(): { key: string; region: string } {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;

  if (!key || typeof key !== 'string' || key.trim() === '') {
    throw new Error(
      'Missing required environment variable: AZURE_SPEECH_KEY\n' +
      'Please set AZURE_SPEECH_KEY in your environment.'
    );
  }

  if (!region || typeof region !== 'string' || region.trim() === '') {
    throw new Error(
      'Missing required environment variable: AZURE_SPEECH_REGION\n' +
      'Please set AZURE_SPEECH_REGION in your environment.\n' +
      'Example values: "eastus", "westus2", "brazilsouth"'
    );
  }

  return { key, region };
}

/**
 * Builds the pronunciation assessment configuration JSON and base64-encodes it.
 */
function buildPronunciationAssessmentHeader(referenceText: string): string {
  const paConfig = {
    ReferenceText: referenceText,
    GradingSystem: 'HundredMark',
    Granularity: 'Word',
    Dimension: 'Comprehensive',
    EnableMiscue: 'True',
  };

  const jsonString = JSON.stringify(paConfig);
  return Buffer.from(jsonString, 'utf-8').toString('base64');
}

/**
 * Assesses audio pronunciation using Azure Speech Service.
 * 
 * Loads a WAV file, sends it to Azure Pronunciation Assessment API,
 * and maps the response to an AttemptScore.
 * 
 * @param wavPath - Path to the WAV file to assess (absolute or relative to cwd)
 * @param referenceText - The reference text (PT-BR) to compare against
 * @returns AttemptScore with pronunciation assessment results
 * @throws {Error} If file doesn't exist, Azure credentials are missing, or API call fails
 */
export async function assessAudio(
  wavPath: string,
  referenceText: string
): Promise<AttemptScore> {
  // Resolve path relative to current working directory if not absolute
  const absolutePath = path.isAbsolute(wavPath)
    ? wavPath
    : path.join(process.cwd(), wavPath);

  // Check if file exists
  try {
    await fs.access(absolutePath);
  } catch {
    throw new Error(`Audio file not found: ${absolutePath}`);
  }

  // Read audio file
  const audioBuffer = await fs.readFile(absolutePath);

  // Get Azure config
  const { key, region } = getAzureSpeechConfig();

  // Build Azure endpoint URL
  const language = 'pt-BR';
  const azureEndpoint = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(language)}&format=detailed`;

  // Build pronunciation assessment header
  const paHeader = buildPronunciationAssessmentHeader(referenceText);

  // Call Azure Speech API
  const audioBody = new Uint8Array(audioBuffer);
  const azureResponse = await fetch(azureEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'audio/wav',
      'Ocp-Apim-Subscription-Key': key,
      'Pronunciation-Assessment': paHeader,
    },
    body: audioBody,
  });

  // Handle non-200 responses
  if (!azureResponse.ok) {
    const errorText = await azureResponse.text();
    throw new Error(
      `Azure Speech API request failed: ${azureResponse.status} ${azureResponse.statusText} - ${errorText}`
    );
  }

  // Parse Azure response
  const rawAzure = await azureResponse.json();

  // Map to AttemptScore
  const attemptId = randomUUID();
  const sentenceId = path.basename(absolutePath, '.wav'); // Use filename as sentenceId
  const attemptScore = mapAzurePronunciationResultToAttemptScore(
    rawAzure,
    sentenceId,
    attemptId,
    undefined // audioUrl - not needed for fixtures
  );

  return attemptScore;
}

