import { beforeEach, describe, expect, it, vi } from 'vitest';
import { estimateSyllables } from './generatedPronunciationService';

// Tests for the pure syllable estimator (no DB needed). The MongoDB-backed
// cache path is covered by integration tests elsewhere.

describe('estimateSyllables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty for empty input', () => {
    expect(estimateSyllables('')).toEqual([]);
  });

  it('returns the word unchanged if it has one nucleus', () => {
    expect(estimateSyllables('mar')).toEqual(['mar']);
    expect(estimateSyllables('pau')).toEqual(['pau']);
  });

  it('splits common 2-syllable words at the consonant', () => {
    expect(estimateSyllables('casa')).toEqual(['ca', 'sa']);
    expect(estimateSyllables('pato')).toEqual(['pa', 'to']);
  });

  it('splits consonant clusters between syllables', () => {
    const parts = estimateSyllables('pontas');
    expect(parts.join('')).toBe('pontas');
    expect(parts.length).toBeGreaterThan(1);
  });

  it('handles words with accents', () => {
    const parts = estimateSyllables('água');
    expect(parts.join('')).toBe('água');
    expect(parts.length).toBeGreaterThan(0);
  });

  it('keeps diphthongs in the same nucleus', () => {
    expect(estimateSyllables('pai')).toEqual(['pai']);
    expect(estimateSyllables('outro')).toEqual(['ou', 'tro']);
  });
});

describe('generatePronunciation (shape)', () => {
  it('exports the expected payload shape', async () => {
    // Smoke-import to ensure the module loads without DB; the actual Mongo
    // path runs under integration tests where a connection is available.
    const mod = await import('./generatedPronunciationService');
    expect(typeof mod.generatePronunciation).toBe('function');
    expect(typeof mod.estimateSyllables).toBe('function');
  });
});
