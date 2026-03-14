import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GenerationPipelineConfig } from '../../config/generationPipeline.config';
import { loadRawWords } from './loadSourceLists';

const TEST_CONFIG: GenerationPipelineConfig = {
  voices: [],
  paths: {
    rawWordsJsonPath: 'STATIC DATA/words.json',
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
    await fs.mkdir(path.join(tempDir, 'STATIC DATA'), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, 'STATIC DATA/words.json'),
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
                difficulty: 1,
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
});
