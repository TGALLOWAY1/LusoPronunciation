import { describe, expect, it } from 'vitest';
import { getPhonemeResources, getWordResources } from './learningResources';

describe('getPhonemeResources', () => {
  it('returns curated resources first, then a generated YouTube search', () => {
    const resources = getPhonemeResources('AN_NASAL');
    expect(resources.length).toBeGreaterThanOrEqual(2);
    expect(resources[0].source).toBe('curated');
    const last = resources[resources.length - 1];
    expect(last.source).toBe('youtube-search');
    expect(last.url.startsWith('https://www.youtube.com/results?search_query=')).toBe(true);
    expect(decodeURIComponent(last.url)).toContain('Brazilian Portuguese');
  });

  it('falls back to only a generated search for unknown phonemes', () => {
    const resources = getPhonemeResources('NOT_A_PHONEME');
    expect(resources).toHaveLength(1);
    expect(resources[0].source).toBe('youtube-search');
    expect(resources[0].url).toContain('NOT_A_PHONEME');
  });

  it('is deterministic', () => {
    expect(getPhonemeResources('LH')).toEqual(getPhonemeResources('LH'));
  });
});

describe('getWordResources', () => {
  it('returns a YouTube search and a Forvo link with escaped text', () => {
    const resources = getWordResources({ textPt: 'pão' });
    expect(resources.map((r) => r.source)).toEqual(['youtube-search', 'forvo']);
    expect(resources[0].url).toContain(encodeURIComponent('"pão"'));
    expect(resources[1].url).toContain(encodeURIComponent('pão'));
    expect(resources[1].url).toContain('forvo.com/word/');
  });
});
