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
import { readFile, writeFile } from 'fs/promises';
import { ERROR_CLASS, type ErrorClass } from '../../lib/errorTaxonomy';
import { mapAzurePronunciationResultToAttemptScore } from '../../lib/pronunciationUtils';
import type { AttemptScore } from '../../types/pronunciation';
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
import {
  convertToWav,
  ConvertFailedError,
  ConvertTimeoutError,
} from '../lib/audioConversion';
import { createWorkspace, type TempWorkspace } from '../lib/tempWorkspace';
import { measureAsync } from '../lib/timing';

// Web API Request/Response types (available in Node.js 18+)
// Using global types - no import needed
type WebRequest = Request;
type WebResponse = Response;

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

function buildSafeErrorPayload(
  statusCode: number,
  requestId: string,
  errorClass: ErrorClass
): {
  error: string;
  message: string;
  requestId: string;
  errorClass: ErrorClass;
} {
  if (statusCode === 502) {
    return {
      error: 'Speech service unavailable',
      message: 'Pronunciation assessment is temporarily unavailable. Please try again.',
      requestId,
      errorClass,
    };
  }

  if (statusCode === 429) {
    return {
      error: 'Too many requests',
      message: 'You have reached the pronunciation request limit. Please wait and try again.',
      requestId,
      errorClass,
    };
  }

  if (statusCode === 413) {
    return {
      error: 'Audio file too large',
      message: `Maximum upload size is ${Math.round(MAX_PRONUNCIATION_UPLOAD_BYTES / (1024 * 1024))}MB.`,
      requestId,
      errorClass,
    };
  }

  return {
    error: 'Internal server error',
    message: 'Failed to assess pronunciation. Please try again.',
    requestId,
    errorClass,
  };
}

class PronunciationRouteError extends Error {
  readonly statusCode: number;
  readonly errorClass: ErrorClass;

  constructor(statusCode: number, errorClass: ErrorClass, message: string) {
    super(message);
    this.name = 'PronunciationRouteError';
    this.statusCode = statusCode;
    this.errorClass = errorClass;
  }
}

function mapAzureStatusToErrorClass(statusCode: number): ErrorClass {
  if (statusCode >= 400 && statusCode <= 499) {
    return ERROR_CLASS.azure4xx;
  }

  if (statusCode >= 500) {
    return ERROR_CLASS.azure5xx;
  }

  return ERROR_CLASS.serverUnknown;
}

function resolveErrorMetadata(error: unknown): { statusCode: number; errorClass: ErrorClass } {
  if (error instanceof PronunciationRouteError) {
    return {
      statusCode: error.statusCode,
      errorClass: error.errorClass,
    };
  }

  return {
    statusCode: 500,
    errorClass: ERROR_CLASS.serverUnknown,
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
    throw new PronunciationRouteError(
      503,
      ERROR_CLASS.azureServiceUnavailable,
      'Missing required environment variable: AZURE_SPEECH_KEY\n' +
      'Please set AZURE_SPEECH_KEY in your server environment.'
    );
  }

  if (!region || typeof region !== 'string' || region.trim() === '') {
    throw new PronunciationRouteError(
      503,
      ERROR_CLASS.azureServiceUnavailable,
      'Missing required environment variable: AZURE_SPEECH_REGION\n' +
      'Please set AZURE_SPEECH_REGION in your server environment.\n' +
      'Example values: "eastus", "westus2", "brazilsouth"'
    );
  }

  return { key, region };
}

const DEFAULT_AUDIO_CONVERT_TIMEOUT_MS = 10_000;
const DEFAULT_SPEECH_HEALTH_TIMEOUT_MS = 3_000;

function getAudioConvertTimeoutMs(): number {
  const rawValue = process.env.AUDIO_CONVERT_TIMEOUT_MS;
  if (!rawValue) {
    return DEFAULT_AUDIO_CONVERT_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_AUDIO_CONVERT_TIMEOUT_MS;
  }

  return parsed;
}

function getSpeechHealthTimeoutMs(): number {
  const rawValue = process.env.SPEECH_HEALTH_TIMEOUT_MS;
  if (!rawValue) {
    return DEFAULT_SPEECH_HEALTH_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SPEECH_HEALTH_TIMEOUT_MS;
  }

  return parsed;
}

async function pingAzureSpeechService(requestId: string): Promise<void> {
  const { key, region } = getAzureSpeechConfig();
  const endpoint = `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
  const timeoutMs = getSpeechHealthTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new PronunciationRouteError(
        503,
        ERROR_CLASS.azureServiceUnavailable,
        `Azure speech health probe failed with status ${response.status}.`
      );
    }
  } catch (error) {
    if (error instanceof PronunciationRouteError) {
      throw error;
    }

    const message =
      error instanceof Error && error.name === 'AbortError'
        ? `Azure speech health probe timed out after ${timeoutMs}ms.`
        : error instanceof Error
          ? error.message
          : 'Azure speech health probe failed.';

    speechLog('warn', 'Azure speech health probe failed', {
      requestId,
      statusClass: '5xx',
    });

    throw new PronunciationRouteError(503, ERROR_CLASS.azureServiceUnavailable, message);
  } finally {
    clearTimeout(timer);
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
  workspace: TempWorkspace;
  convertTimeoutMs: number;
  registerConversionKill?: (kill: (() => void) | null) => void;
  shouldAbort?: () => boolean;
}

interface AssessmentResult {
  rawAzure: any;
  attemptScore: AttemptScore;
  telemetry: {
    requestId: string;
    serverTimingsMs: {
      convertMs: number;
      azureMs: number;
      normalizeMs: number;
    };
    fallbackUsed: boolean;
  };
  fallbackUsed: boolean;
}

async function processPronunciationAssessment(
  params: AssessmentParams
): Promise<AssessmentResult> {
  const {
    audioBuffer,
    sentenceId,
    referenceText,
    language,
    requestId,
    audioMimeType,
    workspace,
    convertTimeoutMs,
    registerConversionKill,
    shouldAbort,
  } = params;

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
  let fallbackUsed = false;
  let conversionErrorClass: ErrorClass | null = null;
  const serverTimingsMs = {
    convertMs: 0,
    azureMs: 0,
    normalizeMs: 0,
  };

  if (!isWavInput) {
    const conversionStage = await measureAsync('convert', async () => {
      try {
        await writeFile(workspace.inputPath, audioBuffer);
        await convertToWav({
          inputPath: workspace.inputPath,
          outputPath: workspace.outputPath,
          timeoutMs: convertTimeoutMs,
          onKill: (kill) => registerConversionKill?.(kill),
        });
        wavBuffer = await readFile(workspace.outputPath);
        if (
          wavBuffer.length < 12 ||
          wavBuffer.toString('ascii', 0, 4) !== 'RIFF' ||
          wavBuffer.toString('ascii', 8, 12) !== 'WAVE'
        ) {
          throw new ConvertFailedError('Converted file does not appear to be a valid WAV file.');
        }
        contentType = 'audio/wav';
      } catch (conversionError) {
        // Fall back to original format (may not work, but better than failing completely)
        fallbackUsed = true;
        conversionErrorClass =
          conversionError instanceof ConvertTimeoutError
            ? ERROR_CLASS.serverConvertTimeout
            : ERROR_CLASS.serverConvertFailed;
        speechLog('warn', 'Audio conversion failed; using original upload format', {
          requestId,
          errorClass: conversionErrorClass,
        });
        if (isSpeechDebugEnabled()) {
          const errorMessage =
            conversionError instanceof ConvertTimeoutError
              ? `timeout after ${conversionError.timeoutMs}ms`
              : conversionError instanceof Error
                ? conversionError.message
                : String(conversionError);
          speechLog(
            'warn',
            'Audio conversion failure details',
            { requestId, error: errorMessage },
            { allowSensitive: true }
          );
        }
      } finally {
        registerConversionKill?.(null);
      }
    });
    serverTimingsMs.convertMs = conversionStage.durationMs;
  } else {
    contentType = 'audio/wav';
  }

  if (shouldAbort?.()) {
    throw new PronunciationRouteError(
      499,
      ERROR_CLASS.clientAbort,
      'Client disconnected before pronunciation assessment completed.'
    );
  }

  // Build Azure endpoint URL
  // NOTE: This endpoint supports pronunciation assessment when the Pronunciation-Assessment header is included
  const azureEndpoint = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(language)}&format=detailed`;

  // Build pronunciation assessment header
  const paHeader = buildPronunciationAssessmentHeader(referenceText);

  // Call Azure Speech API
  // Convert Buffer to Uint8Array for fetch compatibility
  const audioBody = new Uint8Array(wavBuffer);
  const azureStage = await measureAsync('azure', async () => {
    const azureResponse = await fetch(azureEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Ocp-Apim-Subscription-Key': key,
        'Pronunciation-Assessment': paHeader,
      },
      body: audioBody,
    });

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text();
      speechLog('error', 'Azure Speech API request failed', {
        requestId,
        statusClass: getStatusClass(azureResponse.status),
        azureStatus: azureResponse.status,
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
      throw new PronunciationRouteError(
        502,
        mapAzureStatusToErrorClass(azureResponse.status),
        `Azure Speech API request failed: ${azureResponse.status}`
      );
    }

    return azureResponse.json();
  });
  serverTimingsMs.azureMs = azureStage.durationMs;
  const rawAzure = azureStage.value;
  if (isSpeechDebugEnabled()) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await writeSpeechDebugDump(`azure_pronunciation_${requestId}_${timestamp}.json`, rawAzure);
  }

  // Map to AttemptScore
  const normalizeStage = await measureAsync('normalize', async () => {
    const attemptId = randomUUID();
    try {
      return mapAzurePronunciationResultToAttemptScore(
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
      throw new PronunciationRouteError(
        500,
        ERROR_CLASS.serverUnknown,
        'Failed to map Azure response'
      );
    }
  });
  serverTimingsMs.normalizeMs = normalizeStage.durationMs;
  const attemptScore = normalizeStage.value;

  return {
    rawAzure,
    attemptScore,
    telemetry: {
      requestId,
      serverTimingsMs,
      fallbackUsed,
    },
    fallbackUsed,
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
  const workspace = await createWorkspace('pronunciation', requestId);
  const convertTimeoutMs = getAudioConvertTimeoutMs();

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
        JSON.stringify({
          error: 'Missing audio file',
          message: 'Audio file is required.',
          requestId,
          errorClass: ERROR_CLASS.serverUnknown,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!sentenceId || typeof sentenceId !== 'string') {
      return new Response(
        JSON.stringify({
          error: 'Missing or invalid sentenceId',
          message: 'sentenceId is required.',
          requestId,
          errorClass: ERROR_CLASS.serverUnknown,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!referenceText || typeof referenceText !== 'string') {
      return new Response(
        JSON.stringify({
          error: 'Missing or invalid referenceText',
          message: 'referenceText is required.',
          requestId,
          errorClass: ERROR_CLASS.serverUnknown,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!language || typeof language !== 'string') {
      return new Response(
        JSON.stringify({
          error: 'Missing or invalid language',
          message: 'language is required.',
          requestId,
          errorClass: ERROR_CLASS.serverUnknown,
        }),
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
        JSON.stringify({
          error: 'Failed to process audio file',
          message: 'Could not process uploaded audio.',
          requestId,
          errorClass: ERROR_CLASS.serverUnknown,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (audioBuffer.length > MAX_PRONUNCIATION_UPLOAD_BYTES) {
      return new Response(
        JSON.stringify(
          buildSafeErrorPayload(413, requestId, ERROR_CLASS.serverPayloadTooLarge)
        ),
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
      workspace,
      convertTimeoutMs,
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
    const { statusCode, errorClass } = resolveErrorMetadata(error);
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
      JSON.stringify(buildSafeErrorPayload(statusCode, requestId, errorClass)),
      {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
        },
      }
    );
  } finally {
    await workspace.cleanup();
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

const ALLOWED_AUDIO_MIME_TYPES = new Set<string>([
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
  'audio/mpeg', // mp3
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'application/octet-stream', // some browsers ship MediaRecorder blobs this way
]);

/**
 * Magic-byte sniff. Prevents trivial "rename .exe to .wav" abuse and catches
 * payloads where the MIME header lies. We accept a short list of real audio
 * container signatures — anything else is rejected before we spawn ffmpeg or
 * call Azure.
 */
function looksLikeAudioBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  // RIFF....WAVE
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WAVE') {
    return true;
  }
  // WebM / Matroska: EBML header 0x1A 0x45 0xDF 0xA3
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return true;
  // Ogg
  if (buf.slice(0, 4).toString('ascii') === 'OggS') return true;
  // ID3 (mp3)
  if (buf.slice(0, 3).toString('ascii') === 'ID3') return true;
  // MP3 frame sync
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true;
  // ISO BMFF (mp4/m4a): "....ftyp"
  if (buf.slice(4, 8).toString('ascii') === 'ftyp') return true;
  // AAC ADTS sync: 0xFFF
  if (buf[0] === 0xff && (buf[1] & 0xf0) === 0xf0) return true;
  return false;
}

export async function handlePronunciationAssessmentExpress(req: ExpressRequest, res: ExpressResponse): Promise<void> {
  const requestId = (req.header('x-request-id') || randomUUID()).toString();
  const startedAt = Date.now();
  const workspace = await createWorkspace('pronunciation', requestId);
  const convertTimeoutMs = getAudioConvertTimeoutMs();
  let clientDisconnected = false;
  let killActiveConversion: (() => void) | null = null;

  // Pre-gate on content-length: reject obviously-oversized uploads before
  // multer buffers the whole thing into memory.
  const declaredLengthHeader = req.header('content-length');
  if (declaredLengthHeader) {
    const declaredLength = Number.parseInt(declaredLengthHeader, 10);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_PRONUNCIATION_UPLOAD_BYTES * 2) {
      speechLog('warn', 'Pronunciation upload rejected: content-length too large', {
        requestId,
        statusClass: '4xx',
      });
      res.setHeader('X-Request-Id', requestId);
      res.status(413).json(
        buildSafeErrorPayload(413, requestId, ERROR_CLASS.serverPayloadTooLarge)
      );
      return;
    }
  }

  const markClientDisconnected = (): void => {
    if (res.writableEnded) {
      return;
    }
    clientDisconnected = true;
    killActiveConversion?.();
  };

  req.on('aborted', markClientDisconnected);
  req.on('close', markClientDisconnected);

  try {
    // Validate required fields
    if (!req.file) {
      res.status(400).json({
        error: 'Missing audio file',
        message: 'Audio file is required.',
        requestId,
        errorClass: ERROR_CLASS.serverUnknown,
      });
      return;
    }

    const sentenceId = req.body.sentenceId;
    const referenceText = req.body.referenceText;
    const language = req.body.language;

    // Reject unknown/oversized text fields up front — these are echoed back to
    // Azure in a header and in the URL, so they have a real cost if abused.
    const MAX_SENTENCE_ID_LENGTH = 128;
    const MAX_REFERENCE_TEXT_LENGTH = 500;
    const MAX_LANGUAGE_LENGTH = 16;

    if (!sentenceId || typeof sentenceId !== 'string' || sentenceId.length > MAX_SENTENCE_ID_LENGTH) {
      res.status(400).json({
        error: 'Missing or invalid sentenceId',
        message: 'sentenceId is required.',
        requestId,
        errorClass: ERROR_CLASS.serverUnknown,
      });
      return;
    }

    if (
      !referenceText ||
      typeof referenceText !== 'string' ||
      referenceText.length > MAX_REFERENCE_TEXT_LENGTH
    ) {
      res.status(400).json({
        error: 'Missing or invalid referenceText',
        message: 'referenceText is required and must be under 500 characters.',
        requestId,
        errorClass: ERROR_CLASS.serverUnknown,
      });
      return;
    }

    if (
      !language ||
      typeof language !== 'string' ||
      language.length > MAX_LANGUAGE_LENGTH ||
      !/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?$/.test(language)
    ) {
      res.status(400).json({
        error: 'Missing or invalid language',
        message: 'language is required (BCP-47 tag, e.g. "pt-BR").',
        requestId,
        errorClass: ERROR_CLASS.serverUnknown,
      });
      return;
    }

    // MIME + magic-byte gate. Don't hand ffmpeg a file we can't verify as an
    // audio container of a known type.
    const uploadedMime = (req.file.mimetype || '').toLowerCase().split(';')[0].trim();
    if (uploadedMime && !ALLOWED_AUDIO_MIME_TYPES.has(uploadedMime)) {
      speechLog('warn', 'Pronunciation upload rejected: unsupported MIME type', {
        requestId,
        statusClass: '4xx',
      });
      res.setHeader('X-Request-Id', requestId);
      res.status(415).json({
        error: 'Unsupported audio type',
        message: 'Audio upload must be a supported audio format.',
        requestId,
        errorClass: ERROR_CLASS.serverUnknown,
      });
      return;
    }

    // Strict magic-byte check. Default-on in production; opt-in in dev so
    // unit tests can exercise the "synthesized bad bytes fall through to
    // Azure fallback" codepath without hitting this gate.
    const strictSignatureCheck =
      process.env.SPEECH_STRICT_AUDIO_SIGNATURE === 'true' ||
      (process.env.NODE_ENV === 'production' &&
        process.env.SPEECH_STRICT_AUDIO_SIGNATURE !== 'false');
    if (strictSignatureCheck && !looksLikeAudioBuffer(req.file.buffer)) {
      speechLog('warn', 'Pronunciation upload rejected: bytes do not match known audio signature', {
        requestId,
        statusClass: '4xx',
      });
      res.setHeader('X-Request-Id', requestId);
      res.status(415).json({
        error: 'Unsupported audio type',
        message: 'Uploaded file does not appear to be a valid audio recording.',
        requestId,
        errorClass: ERROR_CLASS.serverUnknown,
      });
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
      workspace,
      convertTimeoutMs,
      registerConversionKill: (kill) => {
        killActiveConversion = kill;
        if (kill && clientDisconnected) {
          kill();
        }
      },
      shouldAbort: () => clientDisconnected,
    });

    speechLog('info', 'Pronunciation request completed', {
      requestId,
      statusClass: '2xx',
      durationMs: Date.now() - startedAt,
    });

    if (clientDisconnected || res.writableEnded) {
      return;
    }

    res.setHeader('X-Request-Id', requestId);
    res.json(result);
  } catch (error) {
    if (clientDisconnected || res.writableEnded) {
      return;
    }

    const { statusCode, errorClass } = resolveErrorMetadata(error);
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
    res.status(statusCode).json(buildSafeErrorPayload(statusCode, requestId, errorClass));
  } finally {
    req.off('aborted', markClientDisconnected);
    req.off('close', markClientDisconnected);
    killActiveConversion = null;
    await workspace.cleanup();
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
    res
      .status(413)
      .json(buildSafeErrorPayload(413, requestId, ERROR_CLASS.serverPayloadTooLarge));
    return;
  }

  next(err);
}

/**
 * Canonical pronunciation route.
 * POST /api/pronunciation/assessment
 */
const router = Router();
router.get('/speech-health', async (req: ExpressRequest, res: ExpressResponse) => {
  const requestId = (req.header('x-request-id') || randomUUID()).toString();
  const checkedAt = new Date().toISOString();

  try {
    await pingAzureSpeechService(requestId);
    res.setHeader('X-Request-Id', requestId);
    res.json({
      ok: true,
      checkedAt,
      requestId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Speech service health check failed.';
    res.setHeader('X-Request-Id', requestId);
    res.status(503).json({
      ok: false,
      checkedAt,
      requestId,
      error: 'Speech service unavailable',
      message: errorMessage,
      errorClass: ERROR_CLASS.azureServiceUnavailable,
      httpStatus: 503,
    });
  }
});
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
