import { describe, expect, it } from 'vitest';
import { mapWordToPhonemes } from './phonemeMapper';

describe('phonemeMapper accented short forms', () => {
  it('maps high-frequency accented function words to at least one phoneme', () => {
    expect(mapWordToPhonemes('há').phonemes.length).toBeGreaterThan(0);
    expect(mapWordToPhonemes('à').phonemes.length).toBeGreaterThan(0);
    expect(mapWordToPhonemes('é').phonemes.length).toBeGreaterThan(0);
  });

  it('treats leading h as silent', () => {
    expect(mapWordToPhonemes('há').phonemes[0]).toBe('AA');
  });
});
