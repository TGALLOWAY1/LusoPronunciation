import {
  DEMO_ITEMS,
  getDemoAttemptAudioUrl,
  getDemoNativeAudioUrl,
} from './demoData';

/**
 * Guardrails for the public /demo experience. The demo regressed once to
 * showing a single word instead of the full sentence — these invariants keep
 * the demo data sentence-shaped and the three audio examples coherent.
 */
describe('demoData', () => {
  it('uses full sentences (multiple words, word feedback aligned to tokens)', () => {
    for (const item of DEMO_ITEMS) {
      const tokens = item.text.trim().split(/\s+/);
      expect(tokens.length).toBeGreaterThan(1);
      // Word feedback must cover every token so the interactive sentence
      // display colors the whole sentence, not a single word.
      expect(item.words.map((w) => w.text)).toEqual(tokens);
      for (const example of item.examples) {
        expect(example.words.map((w) => w.text)).toEqual(tokens);
        expect(example.attempt.wordScores.map((w) => w.word)).toEqual(tokens);
      }
    }
  });

  it('provides native, bad, and best examples for every sentence', () => {
    for (const item of DEMO_ITEMS) {
      expect(item.examples.map((e) => e.kind)).toEqual(['native', 'bad', 'best']);
    }
  });

  it('does not carry learner-facing IPA transcriptions', () => {
    for (const item of DEMO_ITEMS) {
      expect(item).not.toHaveProperty('ipa');
      for (const word of item.words) {
        expect(word.respelling).toBeTruthy();
        expect(word.respelling).not.toMatch(/[ɐɲʎʒẽĩõũ]/);
      }
    }
  });

  it('scores the native example near-perfect (95–100)', () => {
    for (const item of DEMO_ITEMS) {
      const native = item.examples.find((e) => e.kind === 'native')!;
      expect(native.attempt.overallAccuracy).toBeGreaterThanOrEqual(95);
      expect(native.attempt.overallAccuracy).toBeLessThanOrEqual(100);
      for (const word of native.words) {
        expect(word.score).toBeGreaterThanOrEqual(95);
        expect(word.score).toBeLessThanOrEqual(100);
        expect(word.errorType).toBeUndefined();
      }
    }
  });

  it('orders example scores native > best > bad', () => {
    for (const item of DEMO_ITEMS) {
      const [native, bad, best] = item.examples;
      expect(native.attempt.overallAccuracy).toBeGreaterThan(best.attempt.overallAccuracy);
      expect(best.attempt.overallAccuracy).toBeGreaterThan(bad.attempt.overallAccuracy);
    }
  });

  it('points every example at the expected static audio path', () => {
    for (const item of DEMO_ITEMS) {
      const [native, bad, best] = item.examples;
      expect(native.audioUrl).toBe(getDemoNativeAudioUrl(item.id));
      expect(native.audioBundled).toBe(true);
      expect(bad.audioUrl).toBe(getDemoAttemptAudioUrl(item.id, 'bad'));
      expect(best.audioUrl).toBe(getDemoAttemptAudioUrl(item.id, 'best'));
    }
  });
});
