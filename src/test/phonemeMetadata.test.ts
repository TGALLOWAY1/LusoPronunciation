import { describe, it, expect } from 'vitest';
import { getPhonemeMetadata, getAllPhonemes } from '@/lib/phonemeMetadata';

describe('PhonemeMetadata', () => {
  describe('getPhonemeMetadata', () => {
    it('should load metadata for valid ARPABET symbols', () => {
      const metadata = getPhonemeMetadata('aa');
      expect(metadata).toBeDefined();
      expect(metadata?.ipa).toBe('ɑ');
      expect(metadata?.description).toBeTruthy();
      expect(metadata?.englishExamples).toBeInstanceOf(Array);
      expect(metadata?.portugueseExamples).toBeInstanceOf(Array);
    });

    it('should normalize symbol case (uppercase)', () => {
      const metadata = getPhonemeMetadata('AA');
      expect(metadata).toBeDefined();
      expect(metadata?.ipa).toBe('ɑ');
    });

    it('should normalize symbol case (mixed case)', () => {
      const metadata = getPhonemeMetadata('Aa');
      expect(metadata).toBeDefined();
      expect(metadata?.ipa).toBe('ɑ');
    });

    it('should handle symbols with whitespace', () => {
      const metadata = getPhonemeMetadata('  aa  ');
      expect(metadata).toBeDefined();
      expect(metadata?.ipa).toBe('ɑ');
    });

    it('should return undefined for unknown symbols', () => {
      const metadata = getPhonemeMetadata('xyz123');
      expect(metadata).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const metadata = getPhonemeMetadata('');
      expect(metadata).toBeUndefined();
    });

    it('should return correct IPA for common Portuguese phonemes', () => {
      // Test with phonemes that are known to exist in the metadata
      const testCases = [
        { symbol: 'aa', expectedIpa: 'ɑ' },
        { symbol: 'ae', expectedIpa: 'æ' },
        { symbol: 'ah', expectedIpa: 'ʌ' },
        { symbol: 'ao', expectedIpa: 'ɔ' },
        { symbol: 'aw', expectedIpa: 'aʊ' },
      ];

      testCases.forEach(({ symbol, expectedIpa }) => {
        const metadata = getPhonemeMetadata(symbol);
        expect(metadata).toBeDefined();
        expect(metadata?.ipa).toBe(expectedIpa);
      });
    });

    it('should include description and examples for valid symbols', () => {
      const metadata = getPhonemeMetadata('aa');
      expect(metadata).toBeDefined();
      expect(metadata?.description).toBeTruthy();
      expect(typeof metadata?.description).toBe('string');
      expect(metadata?.englishExamples).toBeInstanceOf(Array);
      expect(metadata?.portugueseExamples).toBeInstanceOf(Array);
    });
  });

  describe('getAllPhonemes', () => {
    it('should return all phonemes as an array', () => {
      const allPhonemes = getAllPhonemes();
      expect(allPhonemes).toBeInstanceOf(Array);
      expect(allPhonemes.length).toBeGreaterThan(0);
    });

    it('should return phonemes sorted by symbol', () => {
      const allPhonemes = getAllPhonemes();
      if (allPhonemes.length > 1) {
        for (let i = 1; i < allPhonemes.length; i++) {
          expect(allPhonemes[i].symbol.localeCompare(allPhonemes[i - 1].symbol)).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should return phonemes with symbol and metadata', () => {
      const allPhonemes = getAllPhonemes();
      allPhonemes.forEach((entry) => {
        expect(entry).toHaveProperty('symbol');
        expect(entry).toHaveProperty('metadata');
        expect(entry.metadata).toHaveProperty('ipa');
        expect(entry.metadata).toHaveProperty('description');
        expect(entry.metadata).toHaveProperty('englishExamples');
        expect(entry.metadata).toHaveProperty('portugueseExamples');
      });
    });
  });
});

