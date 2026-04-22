import { describe, expect, it } from 'vitest';
import { candidateLemmas, normalizeToLemma } from './lemmaNormalizer';

describe('candidateLemmas', () => {
  it('returns empty for blank input', () => {
    expect(candidateLemmas('')).toEqual([]);
    expect(candidateLemmas('   ')).toEqual([]);
  });

  it('handles the -oes plural', () => {
    expect(candidateLemmas('nacoes')).toContain('nacao');
  });

  it('handles the -aes plural', () => {
    expect(candidateLemmas('paes')).toContain('pao');
    expect(candidateLemmas('caes')).toContain('cao');
  });

  it('handles common regular plurals', () => {
    expect(candidateLemmas('animais')).toContain('animal');
    expect(candidateLemmas('papeis')).toContain('papel');
    expect(candidateLemmas('sois')).toContain('sol');
    expect(candidateLemmas('azuis')).toContain('azul');
    expect(candidateLemmas('homens')).toContain('homem');
    expect(candidateLemmas('mulheres')).toContain('mulher');
    expect(candidateLemmas('vozes')).toContain('voz');
    expect(candidateLemmas('casas')).toContain('casa');
  });

  it('does not over-strip short words', () => {
    expect(candidateLemmas('as')).toEqual([]);
    expect(candidateLemmas('os')).toEqual([]);
  });

  it('does not mangle words ending in double-s', () => {
    expect(candidateLemmas('paiss')).not.toContain('pais');
  });

  it('handles -ando / -endo / -indo participles', () => {
    expect(candidateLemmas('falando')).toContain('falar');
    expect(candidateLemmas('comendo')).toContain('comer');
    expect(candidateLemmas('partindo')).toContain('partir');
  });

  it('returns multiple candidates in priority order', () => {
    const out = candidateLemmas('cantores');
    expect(out[0]).toBe('cantor');
    expect(out).toContain('cantore');
  });
});

describe('normalizeToLemma', () => {
  it('returns the first candidate when one exists', () => {
    expect(normalizeToLemma('casas')).toBe('casa');
  });

  it('returns the input when no candidate applies', () => {
    expect(normalizeToLemma('abacaxi')).toBe('abacaxi');
  });
});
