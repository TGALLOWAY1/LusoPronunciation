import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const textToSpeechToFileMock = vi.hoisted(() => vi.fn());
const ensureCustomAudioDirectoryMock = vi.hoisted(() => vi.fn());

vi.mock('../../pipeline/azureTTSClient', () => ({
  textToSpeechToFile: (...args: unknown[]) => textToSpeechToFileMock(...args),
}));

vi.mock('./customAudioStorage', async () => {
  const actual = await vi.importActual<typeof import('./customAudioStorage')>(
    './customAudioStorage'
  );
  return {
    ...actual,
    ensureCustomAudioDirectory: (...args: unknown[]) => ensureCustomAudioDirectoryMock(...args),
  };
});

import { generatePortugueseTTS, TtsTimeoutError } from './portugueseTTSService';

describe('generatePortugueseTTS timeout', () => {
  beforeEach(() => {
    textToSpeechToFileMock.mockReset();
    ensureCustomAudioDirectoryMock.mockReset().mockResolvedValue(undefined);
    delete process.env.CUSTOM_SENTENCE_TTS_TIMEOUT_MS;
  });

  afterEach(() => {
    delete process.env.CUSTOM_SENTENCE_TTS_TIMEOUT_MS;
  });

  it('resolves normally when synthesis finishes before the timeout', async () => {
    textToSpeechToFileMock.mockResolvedValue({ outputPath: '/tmp/out.wav', skipped: false });

    const result = await generatePortugueseTTS({
      text: 'Olá mundo',
      userId: 'user1',
      sentenceId: 'sentence1',
    });

    expect(result.skipped).toBe(false);
    expect(result.audioUrl).toContain('sentence1');
  });

  it('rejects with TtsTimeoutError when synthesis takes longer than the configured timeout', async () => {
    process.env.CUSTOM_SENTENCE_TTS_TIMEOUT_MS = '10';
    // Simulate a synthesis call that never resolves (a stalled Azure TTS
    // connection) — the Speech SDK gives us no way to cancel it, so the
    // timeout has to win the race instead.
    textToSpeechToFileMock.mockReturnValue(new Promise(() => {}));

    await expect(
      generatePortugueseTTS({ text: 'Olá mundo', userId: 'user1', sentenceId: 'sentence2' })
    ).rejects.toBeInstanceOf(TtsTimeoutError);
  });

  it('honors the CUSTOM_SENTENCE_TTS_TIMEOUT_MS override', async () => {
    process.env.CUSTOM_SENTENCE_TTS_TIMEOUT_MS = '5';
    let elapsedBeforeReject = 0;
    const start = Date.now();
    textToSpeechToFileMock.mockReturnValue(new Promise(() => {}));

    await expect(
      generatePortugueseTTS({ text: 'Olá mundo', userId: 'user1', sentenceId: 'sentence3' })
    ).rejects.toThrow(/timed out after 5ms/);
    elapsedBeforeReject = Date.now() - start;
    expect(elapsedBeforeReject).toBeLessThan(500);
  });
});
