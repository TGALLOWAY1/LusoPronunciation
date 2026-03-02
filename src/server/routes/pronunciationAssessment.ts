/**
 * Pronunciation Assessment API Handler
 * 
 * This handler processes audio recordings and sends them to Azure Speech Service
 * for pronunciation assessment.
 * 
 * AZURE CONFIGURATION REQUIREMENTS:
 * 
 * Endpoint: https://{region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1
 * 
 * Required Headers:
 * - Content-Type: audio/wav (preferred) or audio/webm; codecs=opus
 * - Ocp-Apim-Subscription-Key: {your-key}
 * - Pronunciation-Assessment: base64-encoded JSON config with ReferenceText
 * 
 * Required Query Parameters:
 * - language: e.g., "pt-BR"
 * - format: "detailed" (required for pronunciation assessment)
 * 
 * Pronunciation Assessment Config (base64-encoded in header):
 * {
 *   "ReferenceText": "the text to compare against",
 *   "GradingSystem": "HundredMark",
 *   "Granularity": "Word",
 *   "Dimension": "Comprehensive",
 *   "EnableMiscue": "True"
 * }
 * 
 * AUDIO FORMAT REQUIREMENT:
 * 
 * CRITICAL: Azure Pronunciation Assessment REQUIRES PCM/WAV format:
 * - Format: PCM/WAV (NOT webm/opus)
 * - Sample Rate: 16,000 Hz
 * - Bit Depth: 16 bits
 * - Channels: Mono
 * 
 * MediaRecorder produces webm/opus, which Azure may not properly process.
 * If PronunciationAssessment fields are missing in responses, the audio format
 * is likely the cause. Convert webm/opus to WAV before sending to Azure.
 * 
 * RESPONSE NORMALIZATION:
 * 
 * Azure returns different response formats:
 * - Azure Studio: Array format with nested PronunciationAssessment objects
 * - REST API: Object format, may have scores directly on NBest[0] or nested
 * 
 * The normalizeAzurePronunciationResponse() function handles both formats and
 * ensures consistent structure for mapping to AttemptScore.
 * 
 * KNOWN ISSUES:
 * 
 * 1. Audio Format Mismatch:
 *    - Current: Sending webm/opus from MediaRecorder
 *    - Required: PCM/WAV 16kHz 16-bit mono
 *    - Impact: Azure may not return PronunciationAssessment fields
 *    - Solution: Convert audio to WAV format before sending
 * 
 * 2. Response Structure Differences:
 *    - Fixture JSON (Azure Studio): Array with nested PronunciationAssessment
 *    - Live REST API: Object with scores directly or nested (varies)
 *    - Solution: normalizeAzurePronunciationResponse() handles both
 * 
 * To wire this into your server:
 * 
 * Example with Express:
 *   import express from 'express';
 *   import { handlePronunciationAssessment } from './server/routes/pronunciationAssessment';
 *   const app = express();
 *   app.post('/api/pronunciation/assessment', async (req, res) => {
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
import { mapAzurePronunciationResultToAttemptScore } from '../../lib/pronunciationUtils';
import type { AttemptScore } from '../../types/pronunciation';
import { exec } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { Router, Request as ExpressRequest, Response as ExpressResponse } from 'express';
import multer from 'multer';

// Web API Request/Response types (available in Node.js 18+)
// Using global types - no import needed
type WebRequest = Request;
type WebResponse = Response;

const execAsync = promisify(exec);

/**
 * TODO: Audio Conversion Implementation Summary
 * 
 * Library Choice: ffmpeg-static (optional) + child_process.exec
 * 
 * Why this approach:
 * - ffmpeg-static: Bundles ffmpeg binary (~50MB), no system dependency required
 * - child_process.exec: Simple, direct interface (no wrapper library needed)
 * - Most reliable for webm/opus → WAV conversion
 * - Handles all codec variants and edge cases
 * - Industry-standard tool
 * 
 * Trade-offs:
 * - Binary size: ~50MB added to node_modules (only on server, not client)
 * - Performance: Fast conversion (~100-500ms for typical 1-5 second recordings)
 * - Fallback: If ffmpeg-static not installed, uses system ffmpeg (if available)
 * - File I/O: Uses temp files (acceptable for <1MB audio files)
 * 
 * Alternative considered: @ffmpeg/ffmpeg (WASM)
 * - Pros: Pure JS, no binary dependency
 * - Cons: Slower (~2-5x), larger bundle, more complex API, potential memory issues
 * 
 * Future optimizations:
 * - Cache converted WAVs if same audio blob is re-submitted (unlikely for live recordings)
 * - Stream conversion instead of file-based (more complex, minimal benefit for <1MB files)
 * - Consider WebAssembly solution if binary size becomes deployment issue
 * - Batch conversion if multiple requests arrive simultaneously (add queue)
 * - Pre-warm ffmpeg process pool for faster startup
 */

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
 * Converts webm/opus audio buffer to PCM/WAV format required by Azure.
 * 
 * @param webmBuffer - Input webm/opus audio buffer
 * @returns Promise resolving to WAV buffer (16kHz, 16-bit, mono PCM)
 * @throws Error if conversion fails
 */
async function convertWebmOpusToWav(webmBuffer: Buffer): Promise<Buffer> {
  // Use ffmpeg-static if available, otherwise fall back to system ffmpeg
  let ffmpegPath = 'ffmpeg';
  try {
    // Try to use ffmpeg-static (bundled binary)
    // Dynamic import to avoid requiring it at module load time
    // @ts-ignore - ffmpeg-static is optional dependency, may not be installed
    const ffmpegStatic = await import('ffmpeg-static').catch(() => null);
    if (ffmpegStatic) {
      // ffmpeg-static exports the path as default or as the module itself
      if (typeof ffmpegStatic === 'string') {
        ffmpegPath = ffmpegStatic;
      } else if (typeof (ffmpegStatic as any).default === 'string') {
        ffmpegPath = (ffmpegStatic as any).default;
      } else if (typeof (ffmpegStatic as any) === 'string') {
        ffmpegPath = ffmpegStatic as any;
      }
    }
  } catch (err) {
    // ffmpeg-static not installed, use system ffmpeg
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Audio Conversion] ffmpeg-static not found, using system ffmpeg. Install it for better reliability.');
    }
  }

  // Create temporary files for input and output
  const tempDir = tmpdir();
  const inputPath = join(tempDir, `input_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.webm`);
  const outputPath = join(tempDir, `output_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.wav`);

  try {
    // Write input buffer to temp file
    await writeFile(inputPath, webmBuffer);

    // Convert using ffmpeg: webm/opus -> WAV (16kHz, 16-bit, mono PCM)
    // -f wav: WAV format
    // -ar 16000: 16kHz sample rate
    // -ac 1: Mono channel
    // -sample_fmt s16: 16-bit signed integer samples
    // -y: Overwrite output file
    // -loglevel error: Only show errors (reduce noise)
    const { stdout, stderr } = await execAsync(
      `"${ffmpegPath}" -i "${inputPath}" -f wav -ar 16000 -ac 1 -sample_fmt s16 -loglevel error -y "${outputPath}"`,
      { timeout: 10000 } // 10 second timeout
    );

    // Read converted WAV file
    if (!existsSync(outputPath)) {
      throw new Error(`ffmpeg conversion failed: output file not created. stderr: ${stderr || 'none'}`);
    }

    const wavBuffer = await readFile(outputPath);

    // Verify WAV header (basic sanity check)
    if (wavBuffer.length < 12 || wavBuffer.toString('ascii', 0, 4) !== 'RIFF' || wavBuffer.toString('ascii', 8, 12) !== 'WAVE') {
      throw new Error('Converted file does not appear to be a valid WAV file');
    }

    return wavBuffer;
  } finally {
    // Clean up temp files
    try {
      if (existsSync(inputPath)) await unlink(inputPath).catch(() => {});
      if (existsSync(outputPath)) await unlink(outputPath).catch(() => {});
    } catch (cleanupErr) {
      // Ignore cleanup errors (non-critical)
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Audio Conversion] Failed to clean up temp files:', cleanupErr);
      }
    }
  }
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
    // Note: ProsodyScore is only available for en-US locale.
    // For pt-BR and other locales, Azure will not return ProsodyScore even with Comprehensive dimension.
    // This is a limitation of Azure Speech Service, not our implementation.
  };

  const jsonString = JSON.stringify(paConfig);
  return Buffer.from(jsonString, 'utf-8').toString('base64');
}

/**
 * Core pronunciation assessment logic
 * Processes audio and returns assessment results
 */
interface AssessmentParams {
  audioBuffer: Buffer;
  sentenceId: string;
  referenceText: string;
  language: string;
}

interface AssessmentResult {
  rawAzure: any;
  attemptScore: AttemptScore;
}

async function processPronunciationAssessment(
  params: AssessmentParams
): Promise<AssessmentResult> {
  const { audioBuffer, sentenceId, referenceText, language } = params;

  // Get Azure config
  const { key, region } = getAzureSpeechConfig();

  // Convert webm/opus to WAV format required by Azure
  // Azure Pronunciation Assessment REQUIRES PCM/WAV (16kHz, 16-bit, mono)
  let wavBuffer: Buffer;
  let contentType: string;
  
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Pronunciation Assessment] Converting webm/opus to WAV...');
      const conversionStart = Date.now();
      wavBuffer = await convertWebmOpusToWav(audioBuffer);
      const conversionTime = Date.now() - conversionStart;
      console.log(`[Pronunciation Assessment] Conversion completed in ${conversionTime}ms, output size: ${wavBuffer.length} bytes`);
    } else {
      wavBuffer = await convertWebmOpusToWav(audioBuffer);
    }
    contentType = 'audio/wav';
  } catch (conversionError) {
    console.error('[Pronunciation Assessment] Audio conversion failed:', conversionError);
    // Fall back to original format (may not work, but better than failing completely)
    wavBuffer = audioBuffer;
    contentType = 'audio/webm; codecs=opus';
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Pronunciation Assessment] WARNING: Using original webm/opus format. Azure may not return PronunciationAssessment fields.');
    }
  }

  // Build Azure endpoint URL
  // NOTE: This endpoint supports pronunciation assessment when the Pronunciation-Assessment header is included
  const azureEndpoint = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(language)}&format=detailed`;

  // Build pronunciation assessment header
  const paHeader = buildPronunciationAssessmentHeader(referenceText);
  
  // Comprehensive debug logging (development only)
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Pronunciation Assessment] ===== REQUEST DEBUG =====');
    console.log('[Pronunciation Assessment] Endpoint:', azureEndpoint.replace(key, '***'));
    console.log('[Pronunciation Assessment] Reference text:', referenceText);
    console.log('[Pronunciation Assessment] Language:', language);
    console.log('[Pronunciation Assessment] Input audio size:', audioBuffer.length, 'bytes');
    console.log('[Pronunciation Assessment] Output audio size:', wavBuffer.length, 'bytes');
    console.log('[Pronunciation Assessment] Content-Type:', contentType);
    console.log('[Pronunciation Assessment] PA header (base64):', paHeader);
    // Decode to verify
    try {
      const decoded = Buffer.from(paHeader, 'base64').toString('utf-8');
      console.log('[Pronunciation Assessment] PA header (decoded):', decoded);
    } catch (e) {
      console.warn('[Pronunciation Assessment] Failed to decode PA header:', e);
    }
    console.log('[Pronunciation Assessment] ========================');
  }

  // Call Azure Speech API
  // Convert Buffer to Uint8Array for fetch compatibility
  const audioBody = new Uint8Array(wavBuffer);
  
  const azureResponse = await fetch(azureEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
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

    throw new Error(`Azure Speech API request failed: ${azureResponse.status} - ${errorText}`);
  }

  // Parse Azure response
  const rawAzure = await azureResponse.json();
  
  // Comprehensive debug logging and save response (development only)
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Pronunciation Assessment] ===== RESPONSE DEBUG =====');
    console.log('[Pronunciation Assessment] Response status:', azureResponse.status);
    console.log('[Pronunciation Assessment] Response structure analysis:');
    console.log('  - Is array?', Array.isArray(rawAzure));
    console.log('  - Root keys:', Object.keys(Array.isArray(rawAzure) ? rawAzure[0] || {} : rawAzure || {}));
    console.log('  - RecognitionStatus:', (Array.isArray(rawAzure) ? rawAzure[0] : rawAzure)?.RecognitionStatus);
    console.log('  - DisplayText:', (Array.isArray(rawAzure) ? rawAzure[0] : rawAzure)?.DisplayText);
    
    const nBest = (Array.isArray(rawAzure) ? rawAzure[0] : rawAzure)?.NBest;
    if (nBest && nBest[0]) {
      const firstNBest = nBest[0];
      console.log('  - NBest[0] keys:', Object.keys(firstNBest));
      console.log('  - Has PronunciationAssessment?', !!firstNBest.PronunciationAssessment);
      console.log('  - Direct AccuracyScore?', firstNBest.AccuracyScore !== undefined);
      console.log('  - Nested AccuracyScore?', firstNBest.PronunciationAssessment?.AccuracyScore !== undefined);
      console.log('  - Words count:', firstNBest.Words?.length ?? 0);
      if (firstNBest.Words && firstNBest.Words[0]) {
        const firstWord = firstNBest.Words[0];
        console.log('  - First word:', firstWord.Word);
        console.log('  - First word has PronunciationAssessment?', !!firstWord.PronunciationAssessment);
        console.log('  - First word direct AccuracyScore?', firstWord.AccuracyScore !== undefined);
      }
    }
    
    // Save full response to file for detailed inspection
    const fs = await import('fs/promises');
    const path = await import('path');
    const debugDir = path.join(process.cwd(), 'data', 'debug');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `azure_pronunciation_live_sample_${timestamp}.json`;
    const filepath = path.join(debugDir, filename);
    try {
      await fs.mkdir(debugDir, { recursive: true });
      await fs.writeFile(filepath, JSON.stringify(rawAzure, null, 2));
      console.log(`[Pronunciation Assessment] Saved full response to: ${filepath}`);
    } catch (err) {
      console.warn('[Pronunciation Assessment] Failed to save response:', err);
    }
    
    console.log('[Pronunciation Assessment] ===========================');
  }

  // Map to AttemptScore
  const attemptId = randomUUID();
  let attemptScore: AttemptScore;
  try {
    attemptScore = mapAzurePronunciationResultToAttemptScore(
      rawAzure,
      sentenceId,
      attemptId,
      undefined // audioUrl - client will attach the blob URL
    );
  } catch (mappingError) {
    console.error('[Pronunciation Assessment] Error mapping Azure response:', mappingError);
    console.error('[Pronunciation Assessment] Raw Azure response:', JSON.stringify(rawAzure, null, 2));
    throw new Error(`Failed to map Azure response: ${mappingError instanceof Error ? mappingError.message : 'Unknown mapping error'}`);
  }

  return {
    rawAzure,
    attemptScore,
  };
}

/**
 * Handles pronunciation assessment requests (Web API Request/Response format)
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
  request: WebRequest
): Promise<WebResponse> {
  try {
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

    // Process assessment
    const result = await processPronunciationAssessment({
      audioBuffer,
      sentenceId,
      referenceText,
      language,
    });

    // Return both raw and mapped response
    return new Response(
      JSON.stringify(result),
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
    const statusCode = errorMessage.includes('Azure Speech API request failed') ? 502 : 500;
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: errorMessage,
      }),
      {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Configure multer for in-memory file storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export const pronunciationUploadMiddleware = upload.single('audio');

export async function handlePronunciationAssessmentExpress(req: ExpressRequest, res: ExpressResponse): Promise<void> {
  try {
    // Validate required fields
    if (!req.file) {
      res.status(400).json({ error: 'Missing audio file' });
      return;
    }

    const sentenceId = req.body.sentenceId;
    const referenceText = req.body.referenceText;
    const language = req.body.language;

    if (!sentenceId || typeof sentenceId !== 'string') {
      res.status(400).json({ error: 'Missing or invalid sentenceId' });
      return;
    }

    if (!referenceText || typeof referenceText !== 'string') {
      res.status(400).json({ error: 'Missing or invalid referenceText' });
      return;
    }

    if (!language || typeof language !== 'string') {
      res.status(400).json({ error: 'Missing or invalid language' });
      return;
    }

    // Process assessment
    const result = await processPronunciationAssessment({
      audioBuffer: req.file.buffer,
      sentenceId,
      referenceText,
      language,
    });

    res.json(result);
  } catch (error) {
    console.error('Pronunciation assessment error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = errorMessage.includes('Azure Speech API request failed') ? 502 : 500;
    res.status(statusCode).json({
      error: 'Internal server error',
      message: errorMessage,
    });
  }
}

/**
 * Canonical pronunciation route.
 * POST /api/pronunciation/assessment
 */
const router = Router();
router.post('/assessment', pronunciationUploadMiddleware, handlePronunciationAssessmentExpress);

/**
 * Temporary legacy alias route.
 * POST /api/pronunciation-assessment
 */
export const legacyPronunciationAssessmentRouter = Router();
legacyPronunciationAssessmentRouter.post('/', pronunciationUploadMiddleware, handlePronunciationAssessmentExpress);

export default router;
