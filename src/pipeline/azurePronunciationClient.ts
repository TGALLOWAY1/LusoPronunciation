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
 * Raw Azure pronunciation assessment result type.
 */
export type AzurePronunciationRawResult = any; // The raw JSON response from Azure

/**
 * Assesses pronunciation using Azure Speech Service REST API.
 * 
 * This is a generic function that can assess text directly (by generating TTS first)
 * or assess an existing audio file. It uses the Azure Pronunciation Assessment REST API.
 * 
 * @param params - Assessment parameters
 * @param params.text - The text to assess (PT-BR)
 * @param params.referenceAudioPath - Optional path to reference audio file (if not provided, TTS will be generated)
 * @param params.locale - Optional locale (default: "pt-BR")
 * @returns Promise resolving to raw Azure pronunciation assessment result
 * @throws {Error} If Azure credentials are missing or API call fails
 */
export async function assessPronunciation(params: {
  text: string;
  referenceAudioPath?: string;
  locale?: string;
}): Promise<AzurePronunciationRawResult> {
  const { text, referenceAudioPath, locale = 'pt-BR' } = params;
  
  // Get Azure config
  const { key, region } = getAzureSpeechConfig();
  
  let audioBuffer: Buffer;
  
  if (referenceAudioPath) {
    // Use provided audio file
    const absolutePath = path.isAbsolute(referenceAudioPath)
      ? referenceAudioPath
      : path.join(process.cwd(), referenceAudioPath);
    
    try {
      await fs.access(absolutePath);
    } catch {
      throw new Error(`Reference audio file not found: ${absolutePath}`);
    }
    
    audioBuffer = await fs.readFile(absolutePath);
  } else {
    // Generate TTS audio for the text
    // Import TTS client dynamically to avoid circular dependencies
    const { textToSpeechToFile } = await import('./azureTTSClient');
    
    // Create a temporary file for TTS output
    const tempDir = path.join(process.cwd(), 'data', 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    const tempAudioPath = path.join(tempDir, `temp_${Date.now()}.wav`);
    
    // Use the first available voice (default to male)
    const voiceName = 'pt-BR-AntonioNeural'; // Default voice
    
    try {
      await textToSpeechToFile({
        text,
        voiceName,
        outputPath: tempAudioPath,
      });
      
      audioBuffer = await fs.readFile(tempAudioPath);
      
      // Clean up temp file
      await fs.unlink(tempAudioPath).catch(() => {
        // Ignore cleanup errors
      });
    } catch (error) {
      throw new Error(`Failed to generate TTS audio for assessment: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Build Azure endpoint URL
  const azureEndpoint = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(locale)}&format=detailed`;
  
  // Build pronunciation assessment header
  const paHeader = buildPronunciationAssessmentHeader(text);
  
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
  
  // Parse and return raw Azure response
  const rawAzure = await azureResponse.json();
  return rawAzure;
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

  // Use the new assessPronunciation function
  const rawAzure = await assessPronunciation({
    text: referenceText,
    referenceAudioPath: absolutePath,
    locale: 'pt-BR',
  });

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

