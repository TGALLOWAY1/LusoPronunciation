/**
 * Pronunciation Assessment API Handler
 * 
 * This handler processes audio recordings and sends them to Azure Speech Service
 * for pronunciation assessment.
 * 
 * To wire this into your server:
 * 
 * Example with Express:
 *   import express from 'express';
 *   import { handlePronunciationAssessment } from './server/routes/pronunciationAssessment';
 *   const app = express();
 *   app.post('/api/pronunciation-assessment', async (req, res) => {
 *     const response = await handlePronunciationAssessment(req);
 *     res.status(response.status);
 *     response.headers.forEach((value, key) => res.setHeader(key, value));
 *     res.send(await response.text());
 *   });
 * 
 * Example with Vercel/Netlify serverless:
 *   export default async function handler(req, res) {
 *     if (req.method !== 'POST') return res.status(405).end();
 *     const response = await handlePronunciationAssessment(new Request(req.url, {
 *       method: req.method,
 *       headers: req.headers,
 *       body: JSON.stringify(req.body),
 *     }));
 *     res.status(response.status);
 *     response.headers.forEach((value, key) => res.setHeader(key, value));
 *     res.json(await response.json());
 *   }
 */

import { randomUUID } from 'crypto';
import { mapAzurePronunciationResultToAttemptScore } from '@/lib/pronunciationUtils';
import type { AttemptScore } from '@/types/pronunciation';

/**
 * Server-side Azure Speech configuration
 * Reads from process.env (Node.js environment variables)
 */
function getAzureSpeechConfig() {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;

  if (!key || typeof key !== 'string' || key.trim() === '') {
    throw new Error(
      'Missing required environment variable: AZURE_SPEECH_KEY\n' +
      'Please set AZURE_SPEECH_KEY in your server environment.'
    );
  }

  if (!region || typeof region !== 'string' || region.trim() === '') {
    throw new Error(
      'Missing required environment variable: AZURE_SPEECH_REGION\n' +
      'Please set AZURE_SPEECH_REGION in your server environment.\n' +
      'Example values: "eastus", "westus2", "brazilsouth"'
    );
  }

  return { key, region };
}

/**
 * Builds the pronunciation assessment configuration JSON and base64-encodes it
 */
function buildPronunciationAssessmentHeader(referenceText: string): string {
  const paConfig = {
    ReferenceText: referenceText,
    GradingSystem: 'HundredMark',
    Granularity: 'Word',
    Dimension: 'Comprehensive',
    EnableMiscue: 'True',
    // EnableProsodyAssessment can be added later; REST doesn't fully support prosody yet.
  };

  const jsonString = JSON.stringify(paConfig);
  return Buffer.from(jsonString, 'utf-8').toString('base64');
}

/**
 * Handles pronunciation assessment requests
 * 
 * Expected request:
 * - Method: POST
 * - Content-Type: multipart/form-data
 * - Fields:
 *   - audio: File/Blob (audio recording)
 *   - sentenceId: string
 *   - referenceText: string
 *   - language: string (e.g., "pt-BR")
 * 
 * Returns:
 * {
 *   rawAzure: <raw Azure response>,
 *   attemptScore: <AttemptScore>
 * }
 */
export async function handlePronunciationAssessment(
  request: Request
): Promise<Response> {
  try {
    // Get Azure config
    const { key, region } = getAzureSpeechConfig();

    // Parse multipart form data
    const formData = await request.formData();
    
    const audioFile = formData.get('audio');
    const sentenceId = formData.get('sentenceId');
    const referenceText = formData.get('referenceText');
    const language = formData.get('language');

    // Validate required fields
    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: 'Missing audio file' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!sentenceId || typeof sentenceId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid sentenceId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!referenceText || typeof referenceText !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid referenceText' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!language || typeof language !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid language' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Convert audio file to Buffer
    // audioFile from FormData can be File, Blob, or string - we'll convert it to Buffer
    let audioBuffer: Buffer;
    try {
      if (typeof audioFile === 'string') {
        // If it's already a string, convert directly
        audioBuffer = Buffer.from(audioFile, 'base64');
      } else if ('arrayBuffer' in audioFile && typeof audioFile.arrayBuffer === 'function') {
        // If it has arrayBuffer method (File/Blob), use it
        const arrayBuffer = await audioFile.arrayBuffer();
        audioBuffer = Buffer.from(arrayBuffer);
      } else if (Buffer.isBuffer(audioFile)) {
        // If it's already a Buffer, use it directly
        audioBuffer = audioFile;
      } else {
        throw new Error('Unsupported audio file format');
      }
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to process audio file', details: error instanceof Error ? error.message : 'Unknown error' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build Azure endpoint URL
    const azureEndpoint = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(language)}&format=detailed`;

    // Build pronunciation assessment header
    const paHeader = buildPronunciationAssessmentHeader(referenceText);

    // Call Azure Speech API
    // Convert Buffer to Uint8Array for fetch compatibility
    const audioBody = new Uint8Array(audioBuffer);
    const azureResponse = await fetch(azureEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/ogg; codecs=opus; samplerate=16000',
        'Ocp-Apim-Subscription-Key': key,
        'Pronunciation-Assessment': paHeader,
      },
      body: audioBody,
    });

    // Handle non-200 responses
    if (!azureResponse.ok) {
      const errorText = await azureResponse.text();
      console.error('Azure Speech API error:', {
        status: azureResponse.status,
        statusText: azureResponse.statusText,
        body: errorText,
      });

      return new Response(
        JSON.stringify({
          error: 'Azure Speech API request failed',
          status: azureResponse.status,
          details: errorText,
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse Azure response
    const rawAzure = await azureResponse.json();

    // Map to AttemptScore
    const attemptId = randomUUID();
    const attemptScore: AttemptScore = mapAzurePronunciationResultToAttemptScore(
      rawAzure,
      sentenceId,
      attemptId,
      undefined // audioUrl - client will attach the blob URL
    );

    // Return both raw and mapped response
    return new Response(
      JSON.stringify({
        rawAzure,
        attemptScore,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    // Log server-side errors
    console.error('Pronunciation assessment error:', error);

    // Return safe error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: errorMessage,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

