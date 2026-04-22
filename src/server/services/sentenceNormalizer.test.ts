import { describe, expect, it } from 'vitest';
import { normalizePortugueseSentence } from './sentenceNormalizer';

describe('normalizePortugueseSentence', () => {
  it('collapses repeated whitespace', () => {
    expect(normalizePortugueseSentence('Eu   gosto   de  pão').text).toBe(
      'Eu gosto de pão.'
    );
  });

  it('tightens punctuation spacing', () => {
    expect(
      normalizePortugueseSentence('Ele disse , talvez  ; amanhã !').text
    ).toBe('Ele disse, talvez; amanhã!');
  });

  it('appends a terminal period when missing', () => {
    expect(normalizePortugueseSentence('Bom dia').text).toBe('Bom dia.');
  });

  it('keeps existing terminal punctuation untouched', () => {
    expect(normalizePortugueseSentence('Tudo bem?').text).toBe('Tudo bem?');
  });

  it('repairs spaced clitics', () => {
    expect(normalizePortugueseSentence('falar - me agora').text).toBe(
      'Falar-me agora.'
    );
  });

  it('capitalizes the first letter using pt-BR locale', () => {
    expect(normalizePortugueseSentence('água fresca').text).toBe('Água fresca.');
  });

  it('returns empty string unchanged', () => {
    expect(normalizePortugueseSentence('').text).toBe('');
  });

  it('reports changed=true when cleanup modifies the text', () => {
    expect(normalizePortugueseSentence('olá   mundo').changed).toBe(true);
  });

  it('reports changed=false when already clean', () => {
    expect(normalizePortugueseSentence('Olá mundo.').changed).toBe(false);
  });
});
