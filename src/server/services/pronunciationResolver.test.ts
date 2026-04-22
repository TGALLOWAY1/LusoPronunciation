import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const generatePronunciationMock = vi.hoisted(() => vi.fn());

vi.mock('./generatedPronunciationService', () => ({
  generatePronunciation: generatePronunciationMock,
  estimateSyllables: vi.fn(),
}));

import { resetMasterWordIndex } from '../lib/masterWordIndex';
import { tokenizeSentence } from './sentenceTokenizer';
import {
  resolvePronunciationCoverage,
  resolveTokenPronunciation,
} from './pronunciationResolver';

describe('resolvePronunciationCoverage', () => {
  let tempDir: string;
  const originalPath = process.env.MASTER_WORDS_PATH;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'master-words-'));
    const fixturePath = path.join(tempDir, 'masterWords.json');
    writeFileSync(
      fixturePath,
      JSON.stringify([
        { id: 'w_eu', text: 'eu', normalizedText: 'eu' },
        { id: 'w_preciso', text: 'preciso', normalizedText: 'preciso' },
        { id: 'w_comprar', text: 'comprar', normalizedText: 'comprar' },
        { id: 'w_pao', text: 'pão', normalizedText: 'pão' },
        { id: 'w_casa', text: 'casa', normalizedText: 'casa' },
        { id: 'w_falar', text: 'falar', normalizedText: 'falar' },
      ])
    );
    process.env.MASTER_WORDS_PATH = fixturePath;
    resetMasterWordIndex();
    generatePronunciationMock.mockReset();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalPath === undefined) {
      delete process.env.MASTER_WORDS_PATH;
    } else {
      process.env.MASTER_WORDS_PATH = originalPath;
    }
    resetMasterWordIndex();
  });

  it('marks every curated-matched token as high confidence with exact_match', async () => {
    const tokens = tokenizeSentence('Eu preciso comprar pão.');
    const coverage = await resolvePronunciationCoverage(tokens);

    expect(coverage.tokens.map((t) => t.resolutionType)).toEqual([
      'exact_match',
      'exact_match',
      'exact_match',
      'exact_match',
    ]);
    expect(coverage.tokens.map((t) => t.confidence)).toEqual([
      'high',
      'high',
      'high',
      'high',
    ]);
    expect(coverage.counts.exact_match).toBe(4);
    expect(generatePronunciationMock).not.toHaveBeenCalled();
  });

  it('resolves plurals via lemma_match when the curated dict has the singular', async () => {
    const tokens = tokenizeSentence('Casas');
    const coverage = await resolvePronunciationCoverage(tokens);

    expect(coverage.tokens[0].resolutionType).toBe('lemma_match');
    expect(coverage.tokens[0].wordEntryId).toBe('w_casa');
    expect(coverage.tokens[0].confidence).toBe('high');
    expect(coverage.counts.lemma_match).toBe(1);
    expect(generatePronunciationMock).not.toHaveBeenCalled();
  });

  it('resolves participles via lemma_match (falando → falar)', async () => {
    const tokens = tokenizeSentence('Falando');
    const coverage = await resolvePronunciationCoverage(tokens);

    expect(coverage.tokens[0].resolutionType).toBe('lemma_match');
    expect(coverage.tokens[0].wordEntryId).toBe('w_falar');
  });

  it('falls back to generated with medium confidence when the mapper produces phonemes', async () => {
    generatePronunciationMock.mockResolvedValueOnce({
      id: 'gen-1',
      resolutionType: 'generated',
      surfaceForm: 'xilogravura',
      phonemes: ['SH', 'IY'],
      syllables: ['xi', 'lo'],
      tipText: 'tip',
      confidence: 0.6,
      needsReview: false,
    });

    const tokens = tokenizeSentence('xilogravura');
    const coverage = await resolvePronunciationCoverage(tokens);

    expect(coverage.tokens[0].resolutionType).toBe('generated');
    expect(coverage.tokens[0].confidence).toBe('medium');
    expect(coverage.tokens[0].generatedPronunciationId).toBe('gen-1');
    expect(coverage.tokens[0].wordEntryId).toBeUndefined();
    expect(coverage.counts.generated).toBe(1);
  });

  it('returns unresolved + low confidence when the mapper produces nothing', async () => {
    generatePronunciationMock.mockResolvedValueOnce({
      id: 'gen-2',
      resolutionType: 'unresolved',
      surfaceForm: '###',
      phonemes: [],
      syllables: [],
      tipText: 'tip',
      confidence: 0.3,
      needsReview: true,
    });

    const tokens = tokenizeSentence('abc123'); // unlikely to be in dict
    const coverage = await resolvePronunciationCoverage(tokens);

    expect(coverage.tokens[0].resolutionType).toBe('unresolved');
    expect(coverage.tokens[0].confidence).toBe('low');
    expect(coverage.tokens[0].generatedPronunciationId).toBe('gen-2');
    expect(coverage.counts.unresolved).toBe(1);
  });

  it('returns unresolved (no throw) when the generator itself errors', async () => {
    generatePronunciationMock.mockRejectedValueOnce(new Error('boom'));

    const [token] = tokenizeSentence('wowzers');
    const resolved = await resolveTokenPronunciation(token);

    expect(resolved.resolutionType).toBe('unresolved');
    expect(resolved.confidence).toBe('low');
    expect(resolved.wordEntryId).toBeUndefined();
    expect(resolved.generatedPronunciationId).toBeUndefined();
  });

  it('mixes resolution types across a sentence', async () => {
    // "Eu" → exact, "casas" → lemma, "xilogravura" → generated.
    generatePronunciationMock.mockResolvedValue({
      id: 'gen-99',
      resolutionType: 'generated',
      surfaceForm: 'xilogravura',
      phonemes: ['SH'],
      syllables: ['xi'],
      tipText: 'tip',
      confidence: 0.6,
      needsReview: false,
    });

    const tokens = tokenizeSentence('Eu casas xilogravura.');
    const coverage = await resolvePronunciationCoverage(tokens);

    expect(coverage.tokens.map((t) => t.resolutionType)).toEqual([
      'exact_match',
      'lemma_match',
      'generated',
    ]);
    expect(coverage.counts).toMatchObject({
      exact_match: 1,
      lemma_match: 1,
      generated: 1,
    });
  });
});
