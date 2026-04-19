import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GenerationPipelineConfig } from '../../config/generationPipeline.config';
import { loadRawSentences, loadRawWords } from './loadSourceLists';

const TEST_CONFIG: GenerationPipelineConfig = {
  voices: [],
  paths: {
    rawWordsJsonPath: 'data/static/words.json',
    rawSentencesJsonPath: 'data/sentences.json',
    masterWordsPath: 'data/masterWords.json',
    masterSentencesPath: 'data/masterSentences.json',
    audioBaseDir: 'public/audio',
    audioIndexPath: 'data/audio_index.json',
    testDataBaseDir: 'data/test_data',
  },
  limits: {},
  wordLimit: 0,
  sentenceLimit: 0,
  enableWords: true,
  enableSentences: true,
};

describe('loadSourceLists', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('appends coverage words and merges duplicate surface forms', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'load-source-lists-'));
    await fs.mkdir(path.join(tempDir, 'data/static'), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, 'data/static/words.json'),
      JSON.stringify({
        language_pair: 'pt-BR/en-US',
        version: 'test',
        categories: [
          {
            id: 'numbers',
            label_en: 'Numbers',
            label_pt: 'Numeros',
            words: [
              {
                id: 'numbers_001',
                pt: 'quinze',
                en: 'fifteen',
                forms: ['quinze'],
                pos: 'number',
                difficulty: 2,
                difficult_for_english: false,
              },
            ],
          },
        ],
      }),
      'utf-8'
    );

    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);

    const words = await loadRawWords(TEST_CONFIG);
    const quinze = words.find(word => word.pt === 'quinze');
    const wifi = words.find(word => word.pt === 'wi-fi');

    expect(quinze).toBeDefined();
    expect(quinze?.forms).toEqual(expect.arrayContaining(['quinze', '15']));
    expect(wifi).toBeDefined();
  });

  it('loads and deduplicates sentences across multiple source files', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'load-source-sentences-'));
    await fs.mkdir(path.join(tempDir, 'data/expansions'), { recursive: true });

    await fs.writeFile(
      path.join(tempDir, 'data/sentences.json'),
      JSON.stringify({
        language_pair: 'pt-BR/en-US',
        version: 'test',
        categories: [
          {
            id: 'food',
            label_en: 'Food',
            label_pt: 'Comida',
            sentences: [
              {
                id: 'food_001',
                pt: 'Quero cafe.',
                en: 'I want coffee.',
                difficulty: 2,
              },
            ],
          },
        ],
      }),
      'utf-8'
    );

    await fs.writeFile(
      path.join(tempDir, 'data/expansions/batch_01.json'),
      JSON.stringify({
        language_pair: 'pt-BR/en-US',
        version: 'test',
        categories: [
          {
            id: 'food',
            label_en: 'Food',
            label_pt: 'Comida',
            sentences: [
              {
                id: 'food_002',
                pt: 'A conta, por favor.',
                en: 'The check, please.',
                difficulty: 3,
              },
              {
                id: 'food_003',
                pt: 'Quero cafe.',
                en: 'I want coffee.',
                difficulty: 2,
              },
            ],
          },
        ],
      }),
      'utf-8'
    );

    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);

    const sentences = await loadRawSentences({
      ...TEST_CONFIG,
      paths: {
        ...TEST_CONFIG.paths,
        rawSentencesJsonPath: ['data/sentences.json', 'data/expansions/batch_01.json'],
      },
    });

    expect(sentences).toHaveLength(2);
    expect(sentences.map(sentence => sentence.id)).toEqual(['food_001', 'food_002']);
  });
});
