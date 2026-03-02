import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLivePronunciationPractice } from './useLivePronunciationPractice';
import { analyzeAudioBlob } from '@/lib/audioQuality';
import { ATTEMPT_METRICS_STORAGE_KEY } from '@/lib/attemptMetrics';

const mockLogSentenceAttempt = vi.fn();
const mockAudioBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/ogg' });
const mockRecorderState = {
  isRecording: false,
  audioBlob: mockAudioBlob,
  audioUrl: 'blob://recording',
  startRecording: vi.fn().mockResolvedValue(undefined),
  stopRecording: vi.fn(),
  reset: vi.fn(),
  error: null as string | null,
};

vi.mock('./useMicrophoneRecorder', () => ({
  useMicrophoneRecorder: () => mockRecorderState,
}));

vi.mock('@/state/practiceLogStore', () => ({
  usePracticeLogStore: () => ({
    logSentenceAttempt: mockLogSentenceAttempt,
  }),
}));

vi.mock('@/lib/audioQuality', async () => {
  const actual = await vi.importActual<typeof import('@/lib/audioQuality')>('@/lib/audioQuality');
  return {
    ...actual,
    analyzeAudioBlob: vi.fn(),
  };
});

function buildAssessmentResponse(): Response {
  return new Response(
    JSON.stringify({
      rawAzure: {
        RecognitionStatus: 'Success',
        NBest: [{ Words: [] }],
      },
      attemptScore: {
        attemptId: 'attempt_server_1',
        sentenceId: 'sentence-1',
        overallAccuracy: 88,
        fluency: 80,
        completeness: 86,
        wordScores: [],
        createdAt: new Date().toISOString(),
      },
      telemetry: {
        requestId: 'req-server-1',
        fallbackUsed: false,
        serverTimingsMs: {
          convertMs: 12,
          azureMs: 180,
          normalizeMs: 6,
        },
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'req-server-1' },
    }
  );
}

describe('useLivePronunciationPractice telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(analyzeAudioBlob).mockResolvedValue({
      durationMs: 1200,
      rms: 0.2,
      isTooShort: false,
      isSilent: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('persists telemetry after a successful submission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildAssessmentResponse()));
    const { result } = renderHook(() => useLivePronunciationPractice());

    await act(async () => {
      await result.current.submitAttempt('sentence-1', 'ola mundo');
    });

    await waitFor(() => {
      expect(result.current.attemptState).toBe('scored');
    });

    const storedRaw = window.localStorage.getItem(ATTEMPT_METRICS_STORAGE_KEY);
    expect(storedRaw).toBeTruthy();
    const stored = JSON.parse(storedRaw || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual(
      expect.objectContaining({
        requestId: 'req-server-1',
        timeToFeedbackMs: expect.any(Number),
        clientTimingsMs: expect.objectContaining({
          submitToResponseMs: expect.any(Number),
          responseToRenderMs: expect.any(Number),
        }),
        serverTimingsMs: expect.objectContaining({
          convertMs: 12,
          azureMs: 180,
          normalizeMs: 6,
        }),
      })
    );
  });

  it('persists telemetry with client_abort when canceled', async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useLivePronunciationPractice());

    act(() => {
      void result.current.submitAttempt('sentence-1', 'ola mundo');
    });

    await waitFor(() => {
      expect(result.current.attemptState).toBe('submitting');
    });

    act(() => {
      result.current.cancelAnalysis();
    });

    await waitFor(() => {
      expect(result.current.attemptState).toBe('canceled');
    });

    await waitFor(() => {
      const storedRaw = window.localStorage.getItem(ATTEMPT_METRICS_STORAGE_KEY);
      const stored = JSON.parse(storedRaw || '[]');
      expect(stored[0]?.error?.errorClass).toBe('client_abort');
      expect(stored[0]?.flags?.canceled).toBe(true);
    });
  });
});
