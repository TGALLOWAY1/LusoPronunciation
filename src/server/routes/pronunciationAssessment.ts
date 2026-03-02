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
import {
  Router,
  Request as ExpressRequest,
  Response as ExpressResponse,
  NextFunction,
} from 'express';
import multer from 'multer';
import {
  isSpeechDebugEnabled,
  speechLog,
  writeSpeechDebugDump,
} from '../utils/speechDebug';

// Web API Request/Response types (available in Node.js 18+)
// Using global types - no import needed
type WebRequest = Request;
type WebResponse = Response;

const execAsync = promisify(exec);

const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function getMaxPronunciationUploadBytes(): number {
  const rawValue = process.env.SPEECH_MAX_UPLOAD_BYTES;
  if (!rawValue) {
    return DEFAULT_MAX_UPLOAD_BYTES;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_UPLOAD_BYTES;
  }

  return parsed;
}

const MAX_PRONUNCIATION_UPLOAD_BYTES = getMaxPronunciationUploadBytes();

function getStatusClass(statusCode: number): `${number}xx` {
  return `${Math.floor(statusCode / 100)}xx`;
}

function buildSafeErrorPayload(statusCode: number, requestId: string): {
  error: string;
  message: string;
  requestId: string;
} {
  if (statusCode === 502) {
    return {
      error: 'Speech service unavailable',
      message: 'Pronunciation assessment is temporarily unavailable. Please try again.',
      requestId,
    };
  }

  return {
    error: 'Internal server error',
    message: 'Failed to assess pronunciation. Please try again.',
    requestId,
  };
}

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
  } catch {
    // ffmpeg-static not installed, use system ffmpeg
    speechLog('warn', 'ffmpeg-static not found, using system ffmpeg');
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
      speechLog('warn', 'Failed to clean up audio conversion temp files', {
        error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
      });
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
  requestId: string;
  audioMimeType?: string;
}

interface AssessmentResult {
  rawAzure: any;
  attemptScore: AttemptScore;
}

async function processPronunciationAssessment(
  params: AssessmentParams
): Promise<AssessmentResult> {
  const { audioBuffer, sentenceId, referenceText, language, requestId, audioMimeType } = params;

  // Get Azure config
  const { key, region } = getAzureSpeechConfig();

  // Convert webm/opus to WAV format required by Azure
  // Azure Pronunciation Assessment REQUIRES PCM/WAV (16kHz, 16-bit, mono)
  let wavBuffer: Buffer = audioBuffer;
  const normalizedMimeType = (audioMimeType || '').toLowerCase();
  const isWavInput =
    normalizedMimeType.includes('audio/wav') ||
    normalizedMimeType.includes('audio/x-wav') ||
    normalizedMimeType.includes('audio/wave');
  let contentType = isWavInput ? 'audio/wav' : 'audio/webm; codecs=opus';

  if (!isWavInput) {
    try {
      wavBuffer = await convertWebmOpusToWav(audioBuffer);
      contentType = 'audio/wav';
    } catch (conversionError) {
      // Fall back to original format (may not work, but better than failing completely)
      speechLog('warn', 'Audio conversion failed; using original upload format', { requestId });
      if (isSpeechDebugEnabled()) {
        speechLog(
          'warn',
          'Audio conversion failure details',
          { requestId, error: conversionError instanceof Error ? conversionError.message : String(conversionError) },
          { allowSensitive: true }
        );
      }
    }
  } else {
    contentType = 'audio/wav';
  }

  // Build Azure endpoint URL
  // NOTE: This endpoint supports pronunciation assessment when the Pronunciation-Assessment header is included
  const azureEndpoint = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(language)}&format=detailed`;

  // Build pronunciation assessment header
  const paHeader = buildPronunciationAssessmentHeader(referenceText);

  // Call Azure Speech API
  // Convert Buffer to Uint8Array for fetch compatibility
  const audioBody = new Uint8Array(wavBuffer);
  const azureStartedAt = Date.now();
  
  const azureResponse = await fetch(azureEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      'Ocp-Apim-Subscription-Key': key,
      'Pronunciation-Assessment': paHeader,
    },
    body: audioBody,
  });
  const azureLatencyMs = Date.now() - azureStartedAt;

  // Handle non-200 responses
  if (!azureResponse.ok) {
    const errorText = await azureResponse.text();
    speechLog('error', 'Azure Speech API request failed', {
      requestId,
      statusClass: getStatusClass(azureResponse.status),
      azureStatus: azureResponse.status,
      azureLatencyMs,
    });
    if (isSpeechDebugEnabled()) {
      speechLog(
        'error',
        'Azure Speech API failure details',
        {
          requestId,
          azureStatusText: azureResponse.statusText,
          errorBody: errorText,
        },
        { allowSensitive: true }
      );
    }
    throw new Error(`Azure Speech API request failed: ${azureResponse.status}`);
  }

  // Parse Azure response
  const rawAzure = await azureResponse.json();
  if (isSpeechDebugEnabled()) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await writeSpeechDebugDump(`azure_pronunciation_${requestId}_${timestamp}.json`, rawAzure);
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
    speechLog('error', 'Failed to map Azure pronunciation response', {
      requestId,
      statusClass: '5xx',
    });
    if (isSpeechDebugEnabled()) {
      speechLog(
        'error',
        'Azure pronunciation payload (mapping failure)',
        {
          requestId,
          error: mappingError instanceof Error ? mappingError.message : String(mappingError),
          rawAzure,
        },
        { allowSensitive: true }
      );
    }
    throw new Error('Failed to map Azure response');
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
  const requestId = request.headers.get('x-request-id') || randomUUID();
  const startedAt = Date.now();

  try {
    // Parse multipart form data
    const formData = await request.formData();
    
    const audioFile = formData.get('audio');
    const sentenceId = formData.get('sentenceId');
    const referenceText = formData.get('referenceText');
    const language = formData.get('language');
    const audioMimeType =
      typeof audioFile === 'object' &&
      audioFile !== null &&
      'type' in audioFile &&
      typeof (audioFile as { type?: unknown }).type === 'string'
        ? (audioFile as { type: string }).type
        : undefined;

    // Validate required fields
    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: 'Missing audio file', requestId }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!sentenceId || typeof sentenceId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid sentenceId', requestId }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!referenceText || typeof referenceText !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid referenceText', requestId }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!language || typeof language !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid language', requestId }),
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
        JSON.stringify({ error: 'Failed to process audio file', requestId }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (audioBuffer.length > MAX_PRONUNCIATION_UPLOAD_BYTES) {
      return new Response(
        JSON.stringify({
          error: 'Audio file too large',
          message: `Maximum upload size is ${Math.round(MAX_PRONUNCIATION_UPLOAD_BYTES / (1024 * 1024))}MB.`,
          requestId,
        }),
        { status: 413, headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId } }
      );
    }

    // Process assessment
    const result = await processPronunciationAssessment({
      audioBuffer,
      sentenceId,
      referenceText,
      language,
      requestId,
      audioMimeType,
    });

    speechLog('info', 'Pronunciation request completed', {
      requestId,
      statusClass: '2xx',
      durationMs: Date.now() - startedAt,
    });

    // Return both raw and mapped response
    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = errorMessage.includes('Azure Speech API request failed') ? 502 : 500;
    speechLog('error', 'Pronunciation request failed', {
      requestId,
      statusClass: getStatusClass(statusCode),
      durationMs: Date.now() - startedAt,
    });
    if (isSpeechDebugEnabled()) {
      speechLog(
        'error',
        'Pronunciation request failure details',
        { requestId, stack: error instanceof Error ? error.stack : undefined },
        { allowSensitive: true }
      );
    }

    return new Response(
      JSON.stringify(buildSafeErrorPayload(statusCode, requestId)),
      {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
        },
      }
    );
  }
}

// Configure multer for in-memory file storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PRONUNCIATION_UPLOAD_BYTES,
  },
});

export const pronunciationUploadMiddleware = upload.single('audio');

export async function handlePronunciationAssessmentExpress(req: ExpressRequest, res: ExpressResponse): Promise<void> {
  const requestId = (req.header('x-request-id') || randomUUID()).toString();
  const startedAt = Date.now();

  try {
    // Validate required fields
    if (!req.file) {
      res.status(400).json({ error: 'Missing audio file', requestId });
      return;
    }

    const sentenceId = req.body.sentenceId;
    const referenceText = req.body.referenceText;
    const language = req.body.language;

    if (!sentenceId || typeof sentenceId !== 'string') {
      res.status(400).json({ error: 'Missing or invalid sentenceId', requestId });
      return;
    }

    if (!referenceText || typeof referenceText !== 'string') {
      res.status(400).json({ error: 'Missing or invalid referenceText', requestId });
      return;
    }

    if (!language || typeof language !== 'string') {
      res.status(400).json({ error: 'Missing or invalid language', requestId });
      return;
    }

    // Process assessment
    const result = await processPronunciationAssessment({
      audioBuffer: req.file.buffer,
      sentenceId,
      referenceText,
      language,
      requestId,
      audioMimeType: req.file.mimetype,
    });

    speechLog('info', 'Pronunciation request completed', {
      requestId,
      statusClass: '2xx',
      durationMs: Date.now() - startedAt,
    });

    res.setHeader('X-Request-Id', requestId);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = errorMessage.includes('Azure Speech API request failed') ? 502 : 500;
    speechLog('error', 'Pronunciation request failed', {
      requestId,
      statusClass: getStatusClass(statusCode),
      durationMs: Date.now() - startedAt,
    });
    if (isSpeechDebugEnabled()) {
      speechLog(
        'error',
        'Pronunciation request failure details',
        { requestId, stack: error instanceof Error ? error.stack : undefined },
        { allowSensitive: true }
      );
    }

    res.setHeader('X-Request-Id', requestId);
    res.status(statusCode).json(buildSafeErrorPayload(statusCode, requestId));
  }
}

export function pronunciationUploadErrorHandler(
  err: unknown,
  req: ExpressRequest,
  res: ExpressResponse,
  next: NextFunction
): void {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    const requestId = (req.header('x-request-id') || randomUUID()).toString();
    speechLog('warn', 'Pronunciation upload rejected: payload too large', {
      requestId,
      statusClass: '4xx',
    });
    res.setHeader('X-Request-Id', requestId);
    res.status(413).json({
      error: 'Audio file too large',
      message: `Maximum upload size is ${Math.round(MAX_PRONUNCIATION_UPLOAD_BYTES / (1024 * 1024))}MB.`,
      requestId,
    });
    return;
  }

  next(err);
}

/**
 * Canonical pronunciation route.
 * POST /api/pronunciation/assessment
 */
const router = Router();
router.post('/assessment', pronunciationUploadMiddleware, handlePronunciationAssessmentExpress);
router.use(pronunciationUploadErrorHandler);

/**
 * Temporary legacy alias route.
 * POST /api/pronunciation-assessment
 */
export const legacyPronunciationAssessmentRouter = Router();
legacyPronunciationAssessmentRouter.post('/', pronunciationUploadMiddleware, handlePronunciationAssessmentExpress);
legacyPronunciationAssessmentRouter.use(pronunciationUploadErrorHandler);

export default router;
