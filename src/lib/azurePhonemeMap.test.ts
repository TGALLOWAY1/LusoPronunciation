import { describe, expect, it } from 'vitest';
import {
  AZURE_PTBR_PHONEME_TO_INTERNAL,
  mapAzurePhonemeToInternalId,
  resolveAzurePhonemeDisplaySymbol,
  PHONEME_PROBLEM_THRESHOLD,
} from './azurePhonemeMap';
import { getPhonemeById } from './phonemeMetadata';

// The full documented Azure pt-BR IPA inventory (Microsoft SSML phonetic
// alphabet, pt-BR). Every symbol must resolve to a valid internal metadata ID.
const DOCUMENTED_AZURE_PTBR_LABELS = [
  // Vowels
  'i', 'ĩ', 'a', 'ɔ', 'u', 'ũ', 'o', 'e', 'ɐ̃', 'ə', 'ɛ', 'ẽ', 'õ',
  // Consonants / glides
  'w̃', 'w', 'j̃', 'j', 'p', 'b', 't', 'd', 'g', 'k', 'm', 'n', 'ɲ',
  'f', 'v', 'ɾ', 'x', 's', 'z', 'ʃ', 'ʒ', 'tʃ', 'dʒ', 'l', 'ʎ',
];

describe('azurePhonemeMap', () => {
  it('maps every documented Azure pt-BR label to a valid metadata ID', () => {
    for (const label of DOCUMENTED_AZURE_PTBR_LABELS) {
      const internalId = mapAzurePhonemeToInternalId(label);
      expect(internalId, `label "${label}" should map`).toBeTruthy();
      expect(
        getPhonemeById(internalId as string),
        `mapped ID "${internalId}" for "${label}" should exist in metadata`
      ).toBeDefined();
    }
  });

  it('every entry in the table points at a real metadata ID', () => {
    for (const [label, internalId] of Object.entries(AZURE_PTBR_PHONEME_TO_INTERNAL)) {
      expect(
        getPhonemeById(internalId),
        `table entry ${label} -> ${internalId} must resolve in metadata`
      ).toBeDefined();
    }
  });

  it('applies the documented design decisions for key symbols', () => {
    expect(mapAzurePhonemeToInternalId('x')).toBe('HH'); // strong/guttural R
    expect(mapAzurePhonemeToInternalId('ɾ')).toBe('R_TAP');
    expect(mapAzurePhonemeToInternalId('tʃ')).toBe('CH');
    expect(mapAzurePhonemeToInternalId('dʒ')).toBe('JH');
    expect(mapAzurePhonemeToInternalId('ʃ')).toBe('SH');
    expect(mapAzurePhonemeToInternalId('ʒ')).toBe('ZH');
    expect(mapAzurePhonemeToInternalId('ɲ')).toBe('NH');
    expect(mapAzurePhonemeToInternalId('ʎ')).toBe('LH');
    expect(mapAzurePhonemeToInternalId('ɐ̃')).toBe('AN_NASAL');
    expect(mapAzurePhonemeToInternalId('ẽ')).toBe('EN_NASAL');
    expect(mapAzurePhonemeToInternalId('ĩ')).toBe('IN_NASAL');
    expect(mapAzurePhonemeToInternalId('õ')).toBe('ON_NASAL');
    expect(mapAzurePhonemeToInternalId('ũ')).toBe('UN_NASAL');
  });

  it('returns null for null, empty, or unlabeled input', () => {
    expect(mapAzurePhonemeToInternalId(null)).toBeNull();
    expect(mapAzurePhonemeToInternalId(undefined)).toBeNull();
    expect(mapAzurePhonemeToInternalId('')).toBeNull();
    expect(mapAzurePhonemeToInternalId('   ')).toBeNull();
  });

  it('returns null for unknown labels (caller displays raw label instead)', () => {
    expect(mapAzurePhonemeToInternalId('ʔ')).toBeNull();
    expect(mapAzurePhonemeToInternalId('zzz')).toBeNull();
  });

  it('normalizes NFD combining diacritics to match table keys', () => {
    // 'ɐ' + combining tilde in decomposed (NFD) form.
    const decomposed = 'ɐ̃'.normalize('NFD');
    expect(mapAzurePhonemeToInternalId(decomposed)).toBe('AN_NASAL');
  });

  describe('resolveAzurePhonemeDisplaySymbol', () => {
    it('returns the internal ID for mapped labels', () => {
      expect(resolveAzurePhonemeDisplaySymbol('ʃ')).toBe('SH');
    });

    it('passes through the raw label for unmapped labels', () => {
      expect(resolveAzurePhonemeDisplaySymbol('ʔ')).toBe('ʔ');
    });

    it('returns null when there is no label', () => {
      expect(resolveAzurePhonemeDisplaySymbol(null)).toBeNull();
      expect(resolveAzurePhonemeDisplaySymbol('')).toBeNull();
    });
  });

  it('exposes the shared mispronunciation threshold constant', () => {
    expect(PHONEME_PROBLEM_THRESHOLD).toBe(60);
  });
});
