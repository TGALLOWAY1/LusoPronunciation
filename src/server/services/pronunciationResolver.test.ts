import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetMasterWordIndex } from '../lib/masterWordIndex';
import { tokenizeSentence } from './sentenceTokenizer';
import { resolvePronunciationCoverage } from './pronunciationResolver';

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
      ])
    );
    process.env.MASTER_WORDS_PATH = fixturePath;
    resetMasterWordIndex();
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

  it('marks every curated-matched token as high confidence', async () => {
    const tokens = tokenizeSentence('Eu preciso comprar pão.');
    const coverage = await resolvePronunciationCoverage(tokens);

    expect(coverage.tokens).toHaveLength(4);
    expect(coverage.tokens.map((t) => t.confidence)).toEqual([
      'high',
      'high',
      'high',
      'high',
    ]);
    expect(coverage.tokens.map((t) => t.wordEntryId)).toEqual([
      'w_eu',
      'w_preciso',
      'w_comprar',
      'w_pao',
    ]);
    expect(coverage.curatedHits).toBe(4);
    expect(coverage.unresolved).toBe(0);
  });

  it('marks unknown tokens as low confidence with no wordEntryId', async () => {
    const tokens = tokenizeSentence('Eu xilogravura agora.');
    const coverage = await resolvePronunciationCoverage(tokens);

    expect(coverage.tokens).toHaveLength(3);
    expect(coverage.tokens[0]).toMatchObject({ confidence: 'high', wordEntryId: 'w_eu' });
    expect(coverage.tokens[1]).toMatchObject({ confidence: 'low', wordEntryId: undefined });
    expect(coverage.tokens[2]).toMatchObject({ confidence: 'low', wordEntryId: undefined });
    expect(coverage.curatedHits).toBe(1);
    expect(coverage.unresolved).toBe(2);
  });
});
