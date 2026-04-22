import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useLivePronunciationPractice } from './useLivePronunciationPractice';
import { analyzeAudioBlob } from '@/lib/audioQuality';

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

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function buildAssessmentResponse(attemptId: string): Response {
  return new Response(
    JSON.stringify({
      rawAzure: {
        RecognitionStatus: 'Success',
        NBest: [{ Words: [] }],
      },
      attemptScore: {
        attemptId,
        sentenceId: 'sentence-1',
        overallAccuracy: 85,
        fluency: 80,
        completeness: 90,
        wordScores: [],
        createdAt: new Date().toISOString(),
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

describe('useLivePronunciationPractice lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('luso_auth_token', 'test-token');
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(analyzeAudioBlob).mockResolvedValue({
      durationMs: 1400,
      rms: 0.12,
      isTooShort: false,
      isSilent: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('transitions submitting -> canceled when cancelAnalysis is triggered', async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener('abort', () => {
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
    expect(result.current.submitting).toBe(false);
    expect(result.current.audioUrl).toBe('blob://recording');
  });

  it('ignores stale responses from older submissions', async () => {
    const first = createDeferred<Response>();
    const second = createDeferred<Response>();

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useLivePronunciationPractice());

    act(() => {
      void result.current.submitAttempt('sentence-1', 'ola mundo');
    });
    await waitFor(() => {
      expect(result.current.attemptState).toBe('submitting');
    });

    act(() => {
      void result.current.submitAttempt('sentence-1', 'ola mundo');
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      second.resolve(buildAssessmentResponse('attempt_new'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.currentAttempt?.attemptId).toBe('attempt_new');
    });

    await act(async () => {
      first.resolve(buildAssessmentResponse('attempt_old'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.currentAttempt?.attemptId).toBe('attempt_new');
    });
  });

  it('clears attempts and raw azure mapping when assessment state is reset', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildAssessmentResponse('attempt_to_clear'));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useLivePronunciationPractice());

    await act(async () => {
      await result.current.submitAttempt('sentence-1', 'ola mundo');
    });

    await waitFor(() => {
      expect(result.current.currentAttempt?.attemptId).toBe('attempt_to_clear');
      expect(result.current.rawAzureResponse).toBeTruthy();
    });

    act(() => {
      result.current.clearAssessmentState();
    });

    expect(result.current.currentAttempt).toBeNull();
    expect(result.current.attempts).toHaveLength(0);
    expect(result.current.rawAzureResponse).toBeNull();
    expect(['idle', 'recorded']).toContain(result.current.attemptState);
  });
});
