import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pronunciationRouter, {
  handlePronunciationAssessmentExpress,
  legacyPronunciationAssessmentRouter,
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

type MockResponse = ExpressResponse & {
  body: unknown;
  statusCode: number;
  headers: Record<string, string>;
};

function createRequest(): ExpressRequest {
  return {
    file: {
      buffer: Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF
      mimetype: 'audio/wav',
    },
    body: {
      sentenceId: 'sentence-1',
      referenceText: 'ola mundo',
      language: 'pt-BR',
    },
    header: vi.fn().mockReturnValue(undefined),
  } as unknown as ExpressRequest;
}

function createResponse(): MockResponse {
  const headers: Record<string, string> = {};
  const response: Partial<MockResponse> = {
    body: null,
    statusCode: 200,
    headers,
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
    return response as MockResponse;
  });

  return response as MockResponse;
}

describe('pronunciation assessment endpoint contract', () => {
  beforeEach(() => {
    process.env.AZURE_SPEECH_KEY = 'test-key';
    process.env.AZURE_SPEECH_REGION = 'eastus';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockAzureResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/pronunciation/assessment returns expected shape', async () => {
    const req = createRequest();
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
      })
    );
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
});
