import { describe, expect, it } from 'vitest';
import { analyzeAudioBlob, MIN_DURATION_MS, MIN_RMS } from './audioQuality';

const dummyBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });

describe('analyzeAudioBlob', () => {
  it('flags recordings shorter than minimum duration', async () => {
    const result = await analyzeAudioBlob(dummyBlob, {
      decodeAudioData: async () => ({
        durationSeconds: (MIN_DURATION_MS - 200) / 1000,
        channels: [new Float32Array([0.2, -0.2, 0.2, -0.2])],
      }),
    });

    expect(result.isTooShort).toBe(true);
    expect(result.isSilent).toBe(false);
    expect(result.durationMs).toBeLessThan(MIN_DURATION_MS);
  });

  it('flags effectively silent recordings', async () => {
    const result = await analyzeAudioBlob(dummyBlob, {
      decodeAudioData: async () => ({
        durationSeconds: 1.4,
        channels: [new Float32Array([0.0002, -0.0001, 0.0001, -0.0002])],
      }),
    });

    expect(result.isTooShort).toBe(false);
    expect(result.isSilent).toBe(true);
    expect(result.rms).toBeLessThan(MIN_RMS);
  });
});
