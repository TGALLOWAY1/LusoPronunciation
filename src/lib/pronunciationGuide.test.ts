import { describe, expect, it } from 'vitest';
import { buildPronunciationGuide } from './pronunciationGuide';

describe('buildPronunciationGuide', () => {
  it('turns an initial Portuguese R into the requested English H respelling', () => {
    const guide = buildPronunciationGuide({
      word: 'Rio',
      phonemes: ['R_TAP', 'IY', 'OW'],
    });

    expect(guide.respelling).toBe('Hee-oh');
    expect(guide.references).toEqual([
      { sound: 'H', word: 'hat' },
      { sound: 'ee', word: 'see' },
      { sound: 'oh', word: 'go' },
    ]);
    expect(guide.spellingRules[0]).toEqual({
      spelling: 'R at the start',
      sound: '"H" sound',
      referenceWord: 'hat',
    });
  });

  it('prefers a curated eye-dialect respelling in the pronunciation note', () => {
    const guide = buildPronunciationGuide({
      word: 'frio',
      phonemes: ['F', 'R_TAP', 'IY', 'OW'],
      pronunciationNote: 'FREE-o.',
    });

    expect(guide.respelling).toBe('FREE-o');
  });

  it('describes distinctive Portuguese letter patterns without IPA', () => {
    const guide = buildPronunciationGuide({
      word: 'caminho',
      phonemes: ['K', 'AA', 'M', 'IY', 'NH', 'OW'],
    });

    expect(guide.spellingRules).toContainEqual({
      spelling: 'NH',
      sound: '"NY" sound',
      referenceWord: 'canyon',
    });
    expect(guide.respelling).not.toMatch(/[ɐɲʎʒ]/);
  });
});
