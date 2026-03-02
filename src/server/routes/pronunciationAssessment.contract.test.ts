import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import type { NextFunction, Request as ExpressRequest, Response as ExpressResponse } from 'express';
import multer from 'multer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ERROR_CLASS } from '../../lib/errorTaxonomy';
import { pronunciationRateLimitMiddleware } from '../middleware/pronunciationSecurity';

const convertToWavMock = vi.hoisted(() => vi.fn());
const createWorkspaceMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/audioConversion', async () => {
  const actual = await vi.importActual<typeof import('../lib/audioConversion')>(
    '../lib/audioConversion'
  );
  return {
    ...actual,
    convertToWav: convertToWavMock,
  };
});

vi.mock('../lib/tempWorkspace', async () => {
  const actual = await vi.importActual<typeof import('../lib/tempWorkspace')>(
    '../lib/tempWorkspace'
  );
  return {
    ...actual,
    createWorkspace: createWorkspaceMock,
  };
});

import { ConvertFailedError, ConvertTimeoutError } from '../lib/audioConversion';
import pronunciationRouter, {
  handlePronunciationAssessmentExpress,
  legacyPronunciationAssessmentRouter,
  pronunciationUploadErrorHandler,
} from './pronunciationAssessment';

const mockAzureResponse = {
  RecognitionStatus: 'Success',
  NBest: [
    {
      PronunciationAssessment: {
        AccuracyScore: 88,
        FluencyScore: 84,
        CompletenessScore: 90,
        PronScore: 86,
      },
      Words: [
        {
          Word: 'ola',
          PronunciationAssessment: {
            AccuracyScore: 88,
            ErrorType: 'None',
          },
        },
      ],
    },
  ],
};

const FIXTURES_DIR = path.resolve(process.cwd(), 'src/server/__fixtures__/audio');

const AUDIO_FIXTURES = {
  short: readFileSync(path.join(FIXTURES_DIR, 'speech-short.wav')),
  valid: readFileSync(path.join(FIXTURES_DIR, 'speech-valid.wav')),
  invalid: readFileSync(path.join(FIXTURES_DIR, 'speech-invalid.bin')),
};

type RequestListenerEvent = 'aborted' | 'close';

type MockRequest = ExpressRequest & {
  emit: (eventName: RequestListenerEvent) => void;
};

type MockResponse = ExpressResponse & {
  body: unknown;
  statusCode: number;
  headers: Record<string, string>;
  writableEnded: boolean;
};

function createRequest(
  overrides: {
    audioBuffer?: Buffer;
    audioMimeType?: string;
    sentenceId?: string;
    referenceText?: string;
    language?: string;
    requestId?: string;
    userId?: string;
  } = {}
): MockRequest {
  const listeners = new Map<RequestListenerEvent, Set<() => void>>();

  const on = vi.fn((eventName: RequestListenerEvent, callback: () => void) => {
    const current = listeners.get(eventName) ?? new Set<() => void>();
    current.add(callback);
    listeners.set(eventName, current);
  });

  const off = vi.fn((eventName: RequestListenerEvent, callback: () => void) => {
    listeners.get(eventName)?.delete(callback);
  });

  const req = {
    file: {
      buffer: overrides.audioBuffer ?? AUDIO_FIXTURES.valid,
      mimetype: overrides.audioMimeType ?? 'audio/wav',
    },
    body: {
      sentenceId: overrides.sentenceId ?? 'sentence-1',
      referenceText: overrides.referenceText ?? 'ola mundo',
      language: overrides.language ?? 'pt-BR',
    },
    user: overrides.userId ? { id: overrides.userId } : undefined,
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    header: vi.fn((name: string) => {
      if (name.toLowerCase() === 'x-request-id') {
        return overrides.requestId ?? 'req-contract';
      }
      return undefined;
    }),
    on,
    off,
    emit: (eventName: RequestListenerEvent) => {
      for (const callback of listeners.get(eventName) ?? []) {
        callback();
      }
    },
  };

  return req as unknown as MockRequest;
}

function createHealthRequest(): ExpressRequest {
  return {
    header: vi.fn().mockReturnValue(undefined),
  } as unknown as ExpressRequest;
}

function createResponse(): MockResponse {
  const headers: Record<string, string> = {};
  const response: Partial<MockResponse> = {
    body: null,
    statusCode: 200,
    headers,
    writableEnded: false,
  };

  response.setHeader = vi.fn((name: string, value: string) => {
    headers[name.toLowerCase()] = String(value);
    return response as MockResponse;
  });
  response.status = vi.fn((code: number) => {
    response.statusCode = code;
    return response as MockResponse;
  });
  response.json = vi.fn((payload: unknown) => {
    response.body = payload;
    response.writableEnded = true;
    return response as MockResponse;
  });

  return response as MockResponse;
}

function assertSafeErrorResponse(body: unknown, expectedErrorClass: string): void {
  expect(body).toEqual(
    expect.objectContaining({
      error: expect.any(String),
      message: expect.any(String),
      requestId: expect.any(String),
      errorClass: expectedErrorClass,
    })
  );

  const payload = body as Record<string, unknown>;
  const forbiddenKeys = ['stack', 'cause', 'stderr', 'token', 'subscriptionKey', 'rawAzure'];
  for (const key of forbiddenKeys) {
    expect(payload).not.toHaveProperty(key);
  }
}

describe('pronunciation assessment endpoint contract', () => {
  let cleanupSpies: Array<ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    cleanupSpies = [];

    process.env.AZURE_SPEECH_KEY = 'test-key';
    process.env.AZURE_SPEECH_REGION = 'eastus';
    process.env.SPEECH_RATE_LIMIT_WINDOW_MS = '60000';
    process.env.SPEECH_RATE_LIMIT_MAX_REQUESTS = '20';

    convertToWavMock.mockReset();
    createWorkspaceMock.mockReset();
    createWorkspaceMock.mockImplementation(async () => {
      const workspaceDir = mkdtempSync(path.join(tmpdir(), 'pronunciation-contract-'));
      const cleanup = vi.fn().mockImplementation(async () => {
        rmSync(workspaceDir, { recursive: true, force: true });
      });
      cleanupSpies.push(cleanup);
      return {
        dir: workspaceDir,
        inputPath: path.join(workspaceDir, 'input.webm'),
        outputPath: path.join(workspaceDir, 'output.wav'),
        cleanup,
      };
    });

    convertToWavMock.mockResolvedValue({ ok: true });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockAzureResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  afterEach(() => {
    delete process.env.SPEECH_RATE_LIMIT_WINDOW_MS;
    delete process.env.SPEECH_RATE_LIMIT_MAX_REQUESTS;
    vi.restoreAllMocks();
  });

  it('POST /api/pronunciation/assessment returns success shape + telemetry timings', async () => {
    const req = createRequest({
      audioBuffer: AUDIO_FIXTURES.valid,
      audioMimeType: 'audio/wav',
    });
    const res = createResponse();

    await handlePronunciationAssessmentExpress(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        rawAzure: expect.any(Object),
        attemptScore: expect.objectContaining({
          sentenceId: 'sentence-1',
          wordScores: expect.any(Array),
        }),
        telemetry: expect.objectContaining({
          requestId: expect.any(String),
          fallbackUsed: false,
          serverTimingsMs: expect.objectContaining({
            convertMs: expect.any(Number),
            azureMs: expect.any(Number),
            normalizeMs: expect.any(Number),
          }),
        }),
        fallbackUsed: false,
      })
    );
    expect(cleanupSpies).toHaveLength(1);
    expect(cleanupSpies[0]).toHaveBeenCalledTimes(1);
  });

  it('returns 413 with server_payload_too_large when upload exceeds the max size', () => {
    const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024 + 1, 1);
    expect(oversizedBuffer.length).toBeGreaterThan(10 * 1024 * 1024);

    const req = createRequest({ requestId: 'req-limit-handler' });
    const res = createResponse();
    const next = vi.fn();
    const multerError = new multer.MulterError('LIMIT_FILE_SIZE');

    pronunciationUploadErrorHandler(
      multerError,
      req,
      res,
      next as unknown as NextFunction
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(413);
    assertSafeErrorResponse(res.body, ERROR_CLASS.serverPayloadTooLarge);
  });

  it('returns 429 with server_rate_limited on N+1 requests in the limiter window', () => {
    process.env.SPEECH_RATE_LIMIT_WINDOW_MS = '1000';
    process.env.SPEECH_RATE_LIMIT_MAX_REQUESTS = '1';

    const firstReq = createRequest({ userId: 'rate-user-contract' });
    const firstRes = createResponse();
    let firstNextCalled = false;
    pronunciationRateLimitMiddleware(firstReq, firstRes, () => {
      firstNextCalled = true;
    });
    expect(firstNextCalled).toBe(true);
    expect(firstRes.statusCode).toBe(200);

    const secondReq = createRequest({ userId: 'rate-user-contract' });
    const secondRes = createResponse();
    let secondNextCalled = false;
    pronunciationRateLimitMiddleware(secondReq, secondRes, () => {
      secondNextCalled = true;
    });

    expect(secondNextCalled).toBe(false);
    expect(secondRes.statusCode).toBe(429);
    assertSafeErrorResponse(secondRes.body, ERROR_CLASS.serverRateLimited);
  });

  it('conversion failure falls back and still succeeds with fallbackUsed=true', async () => {
    convertToWavMock.mockRejectedValueOnce(new ConvertFailedError('ffmpeg exited with code 1'));
    const req = createRequest({
      audioBuffer: AUDIO_FIXTURES.invalid,
      audioMimeType: 'audio/webm; codecs=opus',
    });
    const res = createResponse();

    await handlePronunciationAssessmentExpress(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        fallbackUsed: true,
        telemetry: expect.objectContaining({
          fallbackUsed: true,
        }),
      })
    );
    expect(cleanupSpies).toHaveLength(1);
    expect(cleanupSpies[0]).toHaveBeenCalledTimes(1);
  });

  it('conversion timeout falls back and still succeeds with fallbackUsed=true', async () => {
    convertToWavMock.mockRejectedValueOnce(new ConvertTimeoutError(250));
    const req = createRequest({
      audioBuffer: AUDIO_FIXTURES.invalid,
      audioMimeType: 'audio/webm; codecs=opus',
    });
    const res = createResponse();

    await handlePronunciationAssessmentExpress(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        fallbackUsed: true,
        telemetry: expect.objectContaining({
          fallbackUsed: true,
        }),
      })
    );
    expect(cleanupSpies).toHaveLength(1);
    expect(cleanupSpies[0]).toHaveBeenCalledTimes(1);
  });

  it('maps Azure 4xx to azure_4xx with safe error payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('invalid azure request', { status: 401 })
    );
    const req = createRequest({
      audioBuffer: AUDIO_FIXTURES.valid,
      audioMimeType: 'audio/wav',
    });
    const res = createResponse();

    await handlePronunciationAssessmentExpress(req, res);

    expect(res.statusCode).toBe(502);
    assertSafeErrorResponse(res.body, ERROR_CLASS.azure4xx);
    expect(cleanupSpies).toHaveLength(1);
    expect(cleanupSpies[0]).toHaveBeenCalledTimes(1);
  });

  it('maps Azure 5xx to azure_5xx with safe error payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('azure down', { status: 503 })
    );
    const req = createRequest({
      audioBuffer: AUDIO_FIXTURES.valid,
      audioMimeType: 'audio/wav',
    });
    const res = createResponse();

    await handlePronunciationAssessmentExpress(req, res);

    expect(res.statusCode).toBe(502);
    assertSafeErrorResponse(res.body, ERROR_CLASS.azure5xx);
    expect(cleanupSpies).toHaveLength(1);
    expect(cleanupSpies[0]).toHaveBeenCalledTimes(1);
  });

  it('client abort stops in-flight conversion work and still performs temp cleanup', async () => {
    let conversionKillInvoked = false;
    let conversionStarted = false;
    convertToWavMock.mockImplementationOnce(
      ({ onKill }: { onKill?: (kill: () => void) => void }) =>
        new Promise((_resolve, reject) => {
          conversionStarted = true;
          onKill?.(() => {
            conversionKillInvoked = true;
            reject(new ConvertFailedError('killed due to aborted request'));
          });
        })
    );

    const req = createRequest({
      audioBuffer: AUDIO_FIXTURES.invalid,
      audioMimeType: 'audio/webm; codecs=opus',
    });
    const res = createResponse();
    const handlerPromise = handlePronunciationAssessmentExpress(req, res);

    await vi.waitFor(() => {
      expect(conversionStarted).toBe(true);
    });
    req.emit('aborted');
    await handlerPromise;

    expect(conversionKillInvoked).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(res.body).toBeNull();
    expect(cleanupSpies).toHaveLength(1);
    expect(cleanupSpies[0]).toHaveBeenCalledTimes(1);
  });

  it('legacy alias route points to the same POST handler as canonical', () => {
    const canonicalRouteLayer = (pronunciationRouter as any).stack.find(
      (layer: any) => layer.route?.path === '/assessment'
    );
    const aliasRouteLayer = (legacyPronunciationAssessmentRouter as any).stack.find(
      (layer: any) => layer.route?.path === '/'
    );

    expect(canonicalRouteLayer).toBeTruthy();
    expect(aliasRouteLayer).toBeTruthy();
    expect(canonicalRouteLayer.route.methods.post).toBe(true);
    expect(aliasRouteLayer.route.methods.post).toBe(true);

    const canonicalPostHandler = canonicalRouteLayer.route.stack[1].handle;
    const aliasPostHandler = aliasRouteLayer.route.stack[1].handle;
    expect(aliasPostHandler).toBe(canonicalPostHandler);
  });

  it('GET /api/pronunciation/speech-health returns ok when speech service is reachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('token', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    );

    const routeLayer = (pronunciationRouter as any).stack.find(
      (layer: any) => layer.route?.path === '/speech-health'
    );
    const handler = routeLayer.route.stack[0].handle as (
      req: ExpressRequest,
      res: ExpressResponse
    ) => Promise<void>;

    const req = createHealthRequest();
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: true,
        checkedAt: expect.any(String),
        requestId: expect.any(String),
      })
    );
  });

  it('GET /api/pronunciation/speech-health returns special error when speech service is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

    const routeLayer = (pronunciationRouter as any).stack.find(
      (layer: any) => layer.route?.path === '/speech-health'
    );
    const handler = routeLayer.route.stack[0].handle as (
      req: ExpressRequest,
      res: ExpressResponse
    ) => Promise<void>;

    const req = createHealthRequest();
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: false,
        errorClass: ERROR_CLASS.azureServiceUnavailable,
      })
    );
  });
});
