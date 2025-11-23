import { describe, it, expect } from 'vitest';
import { getPhonemeById, getAllPhonemes, getPhonemeMetadata } from '@/lib/phonemeMetadata';

describe('PhonemeMetadata', () => {
  describe('getPhonemeById', () => {
    it('should load metadata for valid phoneme IDs', () => {
      const metadata = getPhonemeById('AA');
      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe('AA');
      expect(metadata?.ipa).toBe('a');
      expect(metadata?.type).toBeTruthy();
      expect(metadata?.articulation).toBeTruthy();
      expect(metadata?.exampleWords).toBeInstanceOf(Array);
    });

    it('should normalize ID case (lowercase)', () => {
      const metadata = getPhonemeById('aa');
      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe('AA');
      expect(metadata?.ipa).toBe('a');
    });

    it('should normalize ID case (uppercase)', () => {
      const metadata = getPhonemeById('AA');
      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe('AA');
    });

    it('should normalize ID case (mixed case)', () => {
      const metadata = getPhonemeById('Aa');
      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe('AA');
    });

    it('should handle IDs with whitespace', () => {
      const metadata = getPhonemeById('  AA  ');
      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe('AA');
    });

    it('should return undefined for unknown IDs', () => {
      const metadata = getPhonemeById('XYZ123');
      expect(metadata).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const metadata = getPhonemeById('');
      expect(metadata).toBeUndefined();
    });

    it('should return correct IPA for common Portuguese phonemes', () => {
      // Test with phonemes that are known to exist in the metadata
      const testCases = [
        { id: 'AA', expectedIpa: 'a' },
        { id: 'AH', expectedIpa: 'ɐ' },
        { id: 'EY', expectedIpa: 'e' },
        { id: 'EH', expectedIpa: 'ɛ' },
        { id: 'IY', expectedIpa: 'i' },
      ];

      testCases.forEach(({ id, expectedIpa }) => {
        const metadata = getPhonemeById(id);
        expect(metadata).toBeDefined();
        expect(metadata?.ipa).toBe(expectedIpa);
      });
    });

    it('should include all required fields for valid IDs', () => {
      const metadata = getPhonemeById('AA');
      expect(metadata).toBeDefined();
      expect(metadata?.id).toBeTruthy();
      expect(metadata?.ipa).toBeTruthy();
      expect(metadata?.type).toBeTruthy();
      expect(metadata?.category).toBeTruthy();
      expect(typeof metadata?.difficulty).toBe('number');
      expect(metadata?.englishApprox).toBeTruthy();
      expect(metadata?.articulation).toBeTruthy();
      expect(metadata?.acousticDescription).toBeTruthy();
      expect(metadata?.commonMistakes).toBeInstanceOf(Array);
      expect(metadata?.teachingTips).toBeInstanceOf(Array);
      expect(metadata?.minimalPairs).toBeInstanceOf(Array);
      expect(metadata?.exampleWords).toBeInstanceOf(Array);
    });
  });

  describe('getPhonemeMetadata (backward compatibility)', () => {
    it('should work as alias for getPhonemeById', () => {
      const byId = getPhonemeById('AA');
      const byMetadata = getPhonemeMetadata('AA');
      expect(byMetadata).toEqual(byId);
    });
  });

  describe('getAllPhonemes', () => {
    it('should return all phonemes as an array', () => {
      const allPhonemes = getAllPhonemes();
      expect(allPhonemes).toBeInstanceOf(Array);
      expect(allPhonemes.length).toBeGreaterThan(0);
    });

    it('should return phonemes sorted by ID', () => {
      const allPhonemes = getAllPhonemes();
      if (allPhonemes.length > 1) {
        for (let i = 1; i < allPhonemes.length; i++) {
          expect(allPhonemes[i].id.localeCompare(allPhonemes[i - 1].id)).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should return phonemes with all required fields', () => {
      const allPhonemes = getAllPhonemes();
      allPhonemes.forEach((entry) => {
        expect(entry).toHaveProperty('id');
        expect(entry).toHaveProperty('ipa');
        expect(entry).toHaveProperty('type');
        expect(entry).toHaveProperty('category');
        expect(entry).toHaveProperty('difficulty');
        expect(entry).toHaveProperty('englishApprox');
        expect(entry).toHaveProperty('articulation');
        expect(entry).toHaveProperty('acousticDescription');
        expect(entry).toHaveProperty('commonMistakes');
        expect(entry).toHaveProperty('teachingTips');
        expect(entry).toHaveProperty('minimalPairs');
        expect(entry).toHaveProperty('exampleWords');
      });
    });
  });
});
