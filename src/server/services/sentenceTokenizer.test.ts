import { describe, expect, it } from 'vitest';
import {
  normalizeTokenForm,
  tokenizeSentence,
} from './sentenceTokenizer';

describe('normalizeTokenForm', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalizeTokenForm('Água')).toBe('agua');
    expect(normalizeTokenForm('João')).toBe('joao');
    expect(normalizeTokenForm('não')).toBe('nao');
  });

  it('strips trailing punctuation', () => {
    expect(normalizeTokenForm('olá,')).toBe('ola');
    expect(normalizeTokenForm('"tudo"')).toBe('tudo');
  });

  it('keeps hyphenated forms intact', () => {
    expect(normalizeTokenForm('guarda-chuva')).toBe('guarda-chuva');
  });
});

describe('tokenizeSentence', () => {
  it('returns an empty array for blank input', () => {
    expect(tokenizeSentence('')).toEqual([]);
    expect(tokenizeSentence('   ')).toEqual([]);
  });

  it('produces one token per word with sequential positions', () => {
    const tokens = tokenizeSentence('Eu preciso comprar pão.');
    expect(tokens).toHaveLength(4);
    expect(tokens.map((t) => t.surfaceForm)).toEqual([
      'Eu',
      'preciso',
      'comprar',
      'pão',
    ]);
    expect(tokens.map((t) => t.normalizedForm)).toEqual([
      'eu',
      'preciso',
      'comprar',
      'pao',
    ]);
    expect(tokens.map((t) => t.position)).toEqual([0, 1, 2, 3]);
  });

  it('keeps hyphenated compounds and verb+clitic as one token', () => {
    const tokens = tokenizeSentence('Guarda-chuva é útil.');
    expect(tokens[0]).toMatchObject({ surfaceForm: 'Guarda-chuva', position: 0 });

    const clitic = tokenizeSentence('Fale-me agora.');
    expect(clitic[0].surfaceForm).toBe('Fale-me');
  });

  it('records character offsets for each token', () => {
    const tokens = tokenizeSentence('Bom dia.');
    expect(tokens[0]).toMatchObject({ surfaceForm: 'Bom', startChar: 0, endChar: 3 });
    expect(tokens[1]).toMatchObject({ surfaceForm: 'dia', startChar: 4, endChar: 7 });
  });
});
