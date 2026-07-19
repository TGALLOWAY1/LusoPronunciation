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

describe('phonemeMapper pt-BR grapheme-to-phoneme rules', () => {
  it('nasalises vowel + coda m/n into the matching nasal vowel', () => {
    // word-final coda
    expect(mapWordToPhonemes('sim').phonemes).toEqual(['S', 'IN_NASAL']);
    expect(mapWordToPhonemes('bom').phonemes).toEqual(['B', 'ON_NASAL']);
    expect(mapWordToPhonemes('um').phonemes).toEqual(['UN_NASAL']);
    expect(mapWordToPhonemes('bem').phonemes).toEqual(['B', 'EN_NASAL']);
    // pre-consonant coda
    expect(mapWordToPhonemes('quinze').phonemes).toEqual(['K', 'IN_NASAL', 'Z', 'IY']);
    expect(mapWordToPhonemes('laranja').phonemes).toEqual(['L', 'AA', 'R_TAP', 'AN_NASAL', 'ZH', 'AH']);
    // final "de" affricates to JH before the reduced /i/ (see t/d affrication tests)
    expect(mapWordToPhonemes('grande').phonemes).toEqual(['G', 'R_TAP', 'AN_NASAL', 'JH', 'IY']);
  });

  it('keeps intervocalic m/n as a plain onset consonant (vowel stays oral)', () => {
    expect(mapWordToPhonemes('cama').phonemes).toEqual(['K', 'AA', 'M', 'AH']);
  });

  it('handles nasal diphthongs within the inventory (ão / final -am / ãe / õe)', () => {
    expect(mapWordToPhonemes('pão').phonemes).toEqual(['P', 'AN_NASAL', 'W']);
    expect(mapWordToPhonemes('mãe').phonemes).toEqual(['M', 'AN_NASAL', 'Y']);
    expect(mapWordToPhonemes('põe').phonemes).toEqual(['P', 'ON_NASAL', 'Y']);
  });

  it('maps two-nasal words correctly (também)', () => {
    expect(mapWordToPhonemes('também').phonemes).toEqual(['T', 'AN_NASAL', 'B', 'EN_NASAL']);
  });

  it('maps "ch" to SH and "j" to ZH (fricatives, not affricates)', () => {
    expect(mapWordToPhonemes('chá').phonemes).toEqual(['SH', 'AA']);
    expect(mapWordToPhonemes('hoje').phonemes).toEqual(['OW', 'ZH', 'IY']);
  });

  it('maps "g" before e/i to ZH', () => {
    expect(mapWordToPhonemes('viagem').phonemes).toEqual(['V', 'IY', 'AA', 'ZH', 'EN_NASAL']);
  });

  it('maps soft c (ce/ci) and ç to S', () => {
    expect(mapWordToPhonemes('cerveja').phonemes).toEqual(['S', 'EH', 'R_TAP', 'V', 'EH', 'ZH', 'AH']);
    expect(mapWordToPhonemes('serviço').phonemes).toEqual(['S', 'EH', 'R_TAP', 'V', 'IY', 'S', 'UW']);
  });

  it('treats the u in "qu"/"gu" as silent before e/i (keeps the K/G)', () => {
    expect(mapWordToPhonemes('quinze').phonemes).toEqual(['K', 'IN_NASAL', 'Z', 'IY']);
    expect(mapWordToPhonemes('aquele').phonemes).toEqual(['AA', 'K', 'EH', 'L', 'IY']);
  });

  it('renders "qu"/"gu" before a/o as K/G + W glide', () => {
    expect(mapWordToPhonemes('quando').phonemes).toEqual(['K', 'W', 'AN_NASAL', 'D', 'UW']);
    expect(mapWordToPhonemes('água').phonemes).toEqual(['AA', 'G', 'W', 'AH']);
  });

  it('reduces word-final unstressed vowels (e → IY, o → UW, a → AH)', () => {
    expect(mapWordToPhonemes('hoje').phonemes).toEqual(['OW', 'ZH', 'IY']);
    expect(mapWordToPhonemes('serviço').phonemes).toEqual(['S', 'EH', 'R_TAP', 'V', 'IY', 'S', 'UW']);
    expect(mapWordToPhonemes('cama').phonemes).toEqual(['K', 'AA', 'M', 'AH']);
  });

  it('affricates t/d before /i/ (orthographic ti/di) → CH/JH', () => {
    expect(mapWordToPhonemes('tia').phonemes).toEqual(['CH', 'IY', 'AH']);
    expect(mapWordToPhonemes('dia').phonemes).toEqual(['JH', 'IY', 'AH']);
    expect(mapWordToPhonemes('cidade').phonemes).toEqual(['S', 'IY', 'D', 'AA', 'JH', 'IY']);
    // nasal "tin-" still affricates
    expect(mapWordToPhonemes('tinta').phonemes).toEqual(['CH', 'IN_NASAL', 'T', 'AH']);
  });

  it('affricates t/d before a word-final reduced "e" (te/de → CH/JH)', () => {
    expect(mapWordToPhonemes('noite').phonemes).toEqual(['N', 'OW', 'IY', 'CH', 'IY']);
    expect(mapWordToPhonemes('tarde').phonemes).toEqual(['T', 'AA', 'R_TAP', 'JH', 'IY']);
    expect(mapWordToPhonemes('grande').phonemes).toEqual(['G', 'R_TAP', 'AN_NASAL', 'JH', 'IY']);
  });

  it('does NOT affricate t/d before a non-final "e"', () => {
    expect(mapWordToPhonemes('dedo').phonemes).toEqual(['D', 'EH', 'D', 'UW']);
  });

  it('maps "rr" and word-initial "r" to HH (strong guttural rhotic)', () => {
    expect(mapWordToPhonemes('carro').phonemes).toEqual(['K', 'AA', 'HH', 'UW']);
    expect(mapWordToPhonemes('rio').phonemes).toEqual(['HH', 'IY', 'UW']);
  });

  it('keeps intervocalic, cluster, and coda single "r" as R_TAP', () => {
    expect(mapWordToPhonemes('caro').phonemes).toEqual(['K', 'AA', 'R_TAP', 'UW']); // intervocalic
    expect(mapWordToPhonemes('prato').phonemes).toEqual(['P', 'R_TAP', 'AA', 'T', 'UW']); // cluster
    expect(mapWordToPhonemes('porta').phonemes).toEqual(['P', 'OW', 'R_TAP', 'T', 'AH']); // coda
  });
});
