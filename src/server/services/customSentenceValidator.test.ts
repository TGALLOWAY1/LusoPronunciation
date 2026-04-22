import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CustomSentenceTokenDto } from '../../shared/types/customSentence';
import {
  CustomSentenceValidationError,
  summarizeCoverage,
  validateConfidenceInvariants,
  validateTokenCoverage,
  validateTtsOutput,
} from './customSentenceValidator';

function token(
  overrides: Partial<CustomSentenceTokenDto> = {}
): CustomSentenceTokenDto {
  return {
    position: 0,
    surfaceForm: 'casa',
    normalizedForm: 'casa',
    resolutionType: 'exact_match',
    confidence: 'high',
    wordEntryId: 'w_casa',
    ...overrides,
  };
}

describe('validateTokenCoverage', () => {
  it('passes when every token has a curated id', () => {
    expect(() =>
      validateTokenCoverage([token(), token({ position: 1, surfaceForm: 'bom' })])
    ).not.toThrow();
  });

  it('passes when unresolved tokens carry a generatedPronunciationId', () => {
    expect(() =>
      validateTokenCoverage([
        token({
          resolutionType: 'unresolved',
          confidence: 'low',
          wordEntryId: undefined,
          generatedPronunciationId: 'gen-xyz',
        }),
      ])
    ).not.toThrow();
  });

  it('throws when a token has neither reference', () => {
    expect(() =>
      validateTokenCoverage([
        token({ wordEntryId: undefined, generatedPronunciationId: undefined }),
      ])
    ).toThrowError(CustomSentenceValidationError);
  });
});

describe('validateConfidenceInvariants', () => {
  it('accepts consistent exact/lemma/generated/unresolved tokens', () => {
    expect(() =>
      validateConfidenceInvariants([
        token(),
        token({ resolutionType: 'lemma_match', confidence: 'high' }),
        token({
          resolutionType: 'generated',
          confidence: 'medium',
          wordEntryId: undefined,
          generatedPronunciationId: 'gen-a',
        }),
        token({
          resolutionType: 'unresolved',
          confidence: 'low',
          wordEntryId: undefined,
          generatedPronunciationId: 'gen-b',
        }),
      ])
    ).not.toThrow();
  });

  it('rejects mismatched confidence/resolutionType', () => {
    expect(() =>
      validateConfidenceInvariants([token({ confidence: 'medium' })])
    ).toThrowError(/does not match resolutionType/);
  });

  it('rejects high-confidence tokens without a wordEntryId', () => {
    expect(() =>
      validateConfidenceInvariants([
        token({
          resolutionType: 'exact_match',
          confidence: 'high',
          wordEntryId: undefined,
          generatedPronunciationId: 'gen-spoofed',
        }),
      ])
    ).toThrowError(CustomSentenceValidationError);
  });

  it('rejects generated tokens missing a generatedPronunciationId', () => {
    expect(() =>
      validateConfidenceInvariants([
        token({
          resolutionType: 'generated',
          confidence: 'medium',
          wordEntryId: undefined,
          generatedPronunciationId: undefined,
        }),
      ])
    ).toThrowError(/requires a generatedPronunciationId/);
  });
});

describe('validateTtsOutput', () => {
  let dir: string;
  let audioPath: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'tts-validator-'));
    audioPath = path.join(dir, 'sentence.wav');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('passes when text matches and the file is large enough', async () => {
    writeFileSync(audioPath, Buffer.alloc(1024));
    await expect(
      validateTtsOutput({
        ttsText: 'Eu preciso comprar pão.',
        persistedText: 'Eu preciso comprar pão.',
        audioAbsolutePath: audioPath,
      })
    ).resolves.toBeUndefined();
  });

  it('throws when ttsText differs from persistedText', async () => {
    writeFileSync(audioPath, Buffer.alloc(1024));
    await expect(
      validateTtsOutput({
        ttsText: 'A',
        persistedText: 'B',
        audioAbsolutePath: audioPath,
      })
    ).rejects.toThrowError(/does not match/);
  });

  it('throws when the audio file is missing', async () => {
    await expect(
      validateTtsOutput({
        ttsText: 'x',
        persistedText: 'x',
        audioAbsolutePath: path.join(dir, 'missing.wav'),
      })
    ).rejects.toThrowError(/missing/);
  });

  it('throws when the audio file is too small', async () => {
    writeFileSync(audioPath, Buffer.alloc(10));
    await expect(
      validateTtsOutput({
        ttsText: 'x',
        persistedText: 'x',
        audioAbsolutePath: audioPath,
      })
    ).rejects.toThrowError(/too small/);
  });
});

describe('summarizeCoverage', () => {
  it('counts tokens by resolution type', () => {
    const summary = summarizeCoverage([
      token(),
      token({ resolutionType: 'lemma_match' }),
      token({
        resolutionType: 'generated',
        confidence: 'medium',
        wordEntryId: undefined,
        generatedPronunciationId: 'g',
      }),
    ]);
    expect(summary).toEqual({
      exact_match: 1,
      lemma_match: 1,
      generated: 1,
      unresolved: 0,
      total: 3,
    });
  });
});
