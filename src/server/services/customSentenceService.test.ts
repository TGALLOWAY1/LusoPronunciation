import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveStatus, translateWithTimeout } from './customSentenceService';
import type { CustomSentenceTokenDto } from '../../shared/types/customSentence';

function token(
  position: number,
  confidence: CustomSentenceTokenDto['confidence'],
  resolutionType: CustomSentenceTokenDto['resolutionType'] = 'exact_match'
): CustomSentenceTokenDto {
  return {
    position,
    surfaceForm: `t${position}`,
    normalizedForm: `t${position}`,
    resolutionType,
    confidence,
  };
}

describe('deriveStatus', () => {
  it('returns needs_review for empty tokens', () => {
    expect(deriveStatus([])).toBe('needs_review');
  });

  it('returns ready when every token is high confidence', () => {
    expect(
      deriveStatus([token(0, 'high'), token(1, 'high'), token(2, 'high')])
    ).toBe('ready');
  });

  it('returns needs_review when any token is low confidence', () => {
    expect(
      deriveStatus([token(0, 'high'), token(1, 'low')])
    ).toBe('needs_review');
  });

  it('returns partial_support when any token is medium and none are low', () => {
    expect(
      deriveStatus([token(0, 'high'), token(1, 'medium')])
    ).toBe('partial_support');
  });
});

describe('translateWithTimeout', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.AZURE_TRANSLATOR_KEY = 'test-key';
    process.env.AZURE_TRANSLATOR_REGION = 'eastus';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it('resolves normally when the translation call finishes before the timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([{ translations: [{ text: 'Olá mundo', to: 'pt-BR' }] }]),
          { status: 200 }
        )
      )
    );

    const result = await translateWithTimeout('hello world', 5_000);
    expect(result.textPt).toBe('Olá mundo');
  });

  it('aborts the underlying request once the timeout elapses', async () => {
    const fetchMock = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('This operation was aborted', 'AbortError'));
          });
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(translateWithTimeout('hello world', 10)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).signal?.aborted).toBe(true);
  });
});
