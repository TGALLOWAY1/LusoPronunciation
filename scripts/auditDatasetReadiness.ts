#!/usr/bin/env node

import { promises as fs } from 'fs';
import * as path from 'path';
import generationPipelineConfig from '../config/generationPipeline.config';
import type { AudioIndex, SentencesData, WordsData, RawSentence, RawWord } from '../src/lib/types';
import type { EnrichedSentence, EnrichedWord } from '../src/types/contentGeneration';
import { getPhonemeById } from '../src/lib/phonemeMetadata';
import { COVERAGE_RAW_WORDS } from '../src/pipeline/coverageWords';

const DIFFICULTIES = [1, 2, 3, 4, 5] as const;

type DifficultyValue = (typeof DIFFICULTIES)[number];

type BucketRow = {
  count: number;
  byDifficulty: Record<DifficultyValue, number>;
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadJson<T>(relativePath: string): Promise<T> {
  const fullPath = path.join(process.cwd(), relativePath);
  const content = await fs.readFile(fullPath, 'utf-8');
  return JSON.parse(content) as T;
}

function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectWordTokens(
  word: ({ text?: string; forms?: string[] } | { pt?: string; forms?: string[] })
): string[] {
  const variants = new Set<string>();
  const baseText = 'text' in word ? word.text : word.pt;

  for (const variant of [baseText, ...(word.forms || [])]) {
    if (!variant) {
      continue;
    }

    for (const token of normalizeToken(variant).split(' ').filter(Boolean)) {
      variants.add(token);
    }
  }

  return [...variants];
}

function toBucketRows<T extends { category?: string; difficulty: number }>(
  items: T[]
): Map<string, BucketRow> {
  const rows = new Map<string, BucketRow>();

  for (const item of items) {
    const categoryId = item.category || 'uncategorized';
    const row = rows.get(categoryId) ?? {
      count: 0,
      byDifficulty: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };

    row.count += 1;

    if (DIFFICULTIES.includes(item.difficulty as DifficultyValue)) {
      row.byDifficulty[item.difficulty as DifficultyValue] += 1;
    }

    rows.set(categoryId, row);
  }

  return rows;
}

function collectEmptyBuckets(rows: Map<string, BucketRow>): Array<{ category: string; difficulty: DifficultyValue }> {
  const emptyBuckets: Array<{ category: string; difficulty: DifficultyValue }> = [];

  for (const [category, row] of rows.entries()) {
    for (const difficulty of DIFFICULTIES) {
      if (row.byDifficulty[difficulty] === 0) {
        emptyBuckets.push({ category, difficulty });
      }
    }
  }

  return emptyBuckets;
}

function extractRawWords(data: WordsData): RawWord[] {
  const words = data.categories.flatMap(category =>
    (category.words || []).map(word => ({
      ...word,
      category: category.id,
    }))
  );

  return [...words, ...COVERAGE_RAW_WORDS];
}

function extractRawSentences(data: SentencesData): RawSentence[] {
  return data.categories.flatMap(category =>
    (category.sentences || []).map(sentence => ({
      ...sentence,
      category: category.id,
    }))
  );
}

function findBlankTranslations<T extends { id: string; en?: string }>(items: T[]): string[] {
  return items
    .filter(item => !item.en || item.en.trim().length === 0)
    .map(item => item.id);
}

function findSentenceDuplicates(sentences: RawSentence[]): Array<{ text: string; count: number; categories: string[]; ids: string[] }> {
  const grouped = new Map<string, RawSentence[]>();

  for (const sentence of sentences) {
    const key = normalizeToken(sentence.pt);
    const existing = grouped.get(key) ?? [];
    existing.push(sentence);
    grouped.set(key, existing);
  }

  return [...grouped.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([text, items]) => ({
      text,
      count: items.length,
      categories: [...new Set(items.map(item => item.category || 'uncategorized'))],
      ids: items.map(item => item.id),
    }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
}

function analyzeTokenCoverage(
  sentences: RawSentence[],
  words: Array<(Pick<EnrichedWord, 'text'> & { forms?: string[] }) | (Pick<RawWord, 'pt'> & { forms?: string[] })>
) {
  const wordSet = new Set<string>();

  for (const word of words) {
    for (const token of collectWordTokens(word)) {
      wordSet.add(token);
    }
  }

  let totalTokens = 0;
  let coveredTokens = 0;
  const missingTokenFrequency = new Map<string, number>();
  let fullyCoveredSentences = 0;
  let underHalfCoveredSentences = 0;

  for (const sentence of sentences) {
    const tokens = normalizeToken(sentence.pt).split(' ').filter(Boolean);
    totalTokens += tokens.length;

    let coveredInSentence = 0;
    for (const token of tokens) {
      if (wordSet.has(token)) {
        coveredTokens += 1;
        coveredInSentence += 1;
      } else {
        missingTokenFrequency.set(token, (missingTokenFrequency.get(token) || 0) + 1);
      }
    }

    const coverage = tokens.length === 0 ? 1 : coveredInSentence / tokens.length;
    if (coverage === 1) {
      fullyCoveredSentences += 1;
    }
    if (coverage < 0.5) {
      underHalfCoveredSentences += 1;
    }
  }

  return {
    coverage: totalTokens === 0 ? 1 : coveredTokens / totalTokens,
    totalTokens,
    coveredTokens,
    fullyCoveredSentences,
    underHalfCoveredSentences,
    topMissingTokens: [...missingTokenFrequency.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 20),
  };
}

async function analyzeAudioCoverage(
  items: Array<Pick<EnrichedWord, 'id'> | Pick<EnrichedSentence, 'id'>>,
  itemType: 'word' | 'sentence',
  audioIndex: AudioIndex
) {
  const missingIndexEntries: string[] = [];
  const missingAudioVariants: Array<{ id: string; voiceId: string }> = [];
  const totalVariants = items.length * generationPipelineConfig.voices.length;

  for (const item of items) {
    const audioEntry = audioIndex[item.id];
    if (!audioEntry) {
      missingIndexEntries.push(item.id);
    }

    for (const voice of generationPipelineConfig.voices) {
      const filePath = path.join(
        process.cwd(),
        generationPipelineConfig.paths.audioBaseDir,
        `${itemType}s`,
        voice.id,
        `${item.id}.wav`
      );

      const hasIndexedVoice = Boolean(audioEntry?.voices?.[voice.id] || audioEntry?.ptbr?.[voice.gender]);
      const hasPhysicalFile = await fileExists(filePath);

      if (!hasIndexedVoice || !hasPhysicalFile) {
        missingAudioVariants.push({
          id: item.id,
          voiceId: voice.id,
        });
      }
    }
  }

  return {
    totalVariants,
    readyVariants: totalVariants - missingAudioVariants.length,
    missingIndexEntries,
    missingAudioVariants,
  };
}

function analyzePhonemeCoverage(words: EnrichedWord[]) {
  const missingMetadataIds = new Set<string>();
  const wordsMissingPhonemes: string[] = [];

  for (const word of words) {
    if (!word.phonemes || word.phonemes.length === 0) {
      wordsMissingPhonemes.push(word.id);
      continue;
    }

    for (const phonemeId of word.phonemes) {
      if (!getPhonemeById(phonemeId)) {
        missingMetadataIds.add(phonemeId);
      }
    }
  }

  return {
    wordsMissingPhonemes,
    missingMetadataIds: [...missingMetadataIds].sort(),
  };
}

function analyzeWordRefs(sentences: EnrichedSentence[], words: EnrichedWord[]) {
  const wordIds = new Set(words.map(word => word.id));
  const zeroRefSentences: string[] = [];
  const invalidRefSentences: string[] = [];

  for (const sentence of sentences) {
    if (!sentence.wordRefs || sentence.wordRefs.length === 0) {
      zeroRefSentences.push(sentence.id);
      continue;
    }

    const hasInvalidRef = sentence.wordRefs.some(ref => !wordIds.has(ref.wordId));
    if (hasInvalidRef) {
      invalidRefSentences.push(sentence.id);
    }
  }

  return {
    zeroRefSentences,
    invalidRefSentences,
  };
}

async function main() {
  const rawWordsData = await loadJson<WordsData>(generationPipelineConfig.paths.rawWordsJsonPath);
  const rawSentencesData = await loadJson<SentencesData>(generationPipelineConfig.paths.rawSentencesJsonPath);
  const masterWords = await loadJson<EnrichedWord[]>(generationPipelineConfig.paths.masterWordsPath);
  const masterSentences = await loadJson<EnrichedSentence[]>(generationPipelineConfig.paths.masterSentencesPath);
  const audioIndex = await loadJson<AudioIndex>(generationPipelineConfig.paths.audioIndexPath);

  const rawWords = extractRawWords(rawWordsData);
  const rawSentences = extractRawSentences(rawSentencesData);

  const rawSentenceBuckets = toBucketRows(rawSentences);
  const masterSentenceBuckets = toBucketRows(masterSentences);
  const masterWordBuckets = toBucketRows(masterWords);

  const rawSentenceEmptyBuckets = collectEmptyBuckets(rawSentenceBuckets);
  const masterSentenceEmptyBuckets = collectEmptyBuckets(masterSentenceBuckets);
  const masterWordEmptyBuckets = collectEmptyBuckets(masterWordBuckets);

  const rawSentenceDuplicates = findSentenceDuplicates(rawSentences);
  const tokenCoverage = analyzeTokenCoverage(rawSentences, masterWords.length > 0 ? masterWords : rawWords);
  const phonemeCoverage = analyzePhonemeCoverage(masterWords);
  const wordRefCoverage = analyzeWordRefs(masterSentences, masterWords);
  const wordAudioCoverage = await analyzeAudioCoverage(masterWords, 'word', audioIndex);
  const sentenceAudioCoverage = await analyzeAudioCoverage(masterSentences, 'sentence', audioIndex);

  const rawSentenceCategories = [...new Set(rawSentences.map(sentence => sentence.category || 'uncategorized'))];
  const masterSentenceCategories = [...new Set(masterSentences.map(sentence => sentence.category || 'uncategorized'))];
  const masterWordCategories = [...new Set(masterWords.map(word => word.category || 'uncategorized'))];

  const blockers: string[] = [];

  if (masterSentenceEmptyBuckets.length > 0) {
    blockers.push(`Master sentences still have ${masterSentenceEmptyBuckets.length} empty category/difficulty buckets.`);
  }
  if (!masterSentences.some(sentence => sentence.difficulty === 5)) {
    blockers.push('Master sentences have no difficulty-5 content.');
  }
  if (wordAudioCoverage.missingAudioVariants.length > 0 || sentenceAudioCoverage.missingAudioVariants.length > 0) {
    blockers.push('Audio is incomplete for the current master dataset.');
  }
  if (phonemeCoverage.wordsMissingPhonemes.length > 0 || phonemeCoverage.missingMetadataIds.length > 0) {
    blockers.push('Phoneme coverage is incomplete for the current master word set.');
  }
  if (tokenCoverage.coverage < 0.9) {
    blockers.push(`Sentence token coverage is ${(tokenCoverage.coverage * 100).toFixed(1)}%, below the 90% target.`);
  }
  if (wordRefCoverage.zeroRefSentences.length > 0 || wordRefCoverage.invalidRefSentences.length > 0) {
    blockers.push('Sentence-to-word linking is incomplete.');
  }
  if (findBlankTranslations(rawWords).length > 0 || findBlankTranslations(rawSentences).length > 0) {
    blockers.push('Raw source data has blank translations.');
  }
  if (findBlankTranslations(masterWords).length > 0 || findBlankTranslations(masterSentences).length > 0) {
    blockers.push('Master data has blank translations.');
  }

  console.log('\nDataset Readiness Audit');
  console.log('='.repeat(60));
  console.log(`Raw words: ${rawWords.length}`);
  console.log(`Raw sentences: ${rawSentences.length}`);
  console.log(`Master words: ${masterWords.length}`);
  console.log(`Master sentences: ${masterSentences.length}`);
  console.log('');

  console.log('Category sets');
  console.log(`  Raw sentences: ${rawSentenceCategories.join(', ')}`);
  console.log(`  Master sentences: ${masterSentenceCategories.join(', ')}`);
  console.log(`  Master words: ${masterWordCategories.join(', ')}`);
  console.log('');

  console.log('Sentence bucket coverage');
  console.log(`  Raw empty buckets: ${rawSentenceEmptyBuckets.length}`);
  console.log(`  Master empty buckets: ${masterSentenceEmptyBuckets.length}`);
  console.log(`  Master empty bucket sample: ${masterSentenceEmptyBuckets.slice(0, 10).map(bucket => `${bucket.category}:${bucket.difficulty}`).join(', ') || 'none'}`);
  console.log('');

  console.log('Word bucket coverage');
  console.log(`  Master empty buckets: ${masterWordEmptyBuckets.length}`);
  console.log(`  Master empty bucket sample: ${masterWordEmptyBuckets.slice(0, 10).map(bucket => `${bucket.category}:${bucket.difficulty}`).join(', ') || 'none'}`);
  console.log('');

  console.log('Translations');
  console.log(`  Raw words missing EN: ${findBlankTranslations(rawWords).length}`);
  console.log(`  Raw sentences missing EN: ${findBlankTranslations(rawSentences).length}`);
  console.log(`  Master words missing EN: ${findBlankTranslations(masterWords).length}`);
  console.log(`  Master sentences missing EN: ${findBlankTranslations(masterSentences).length}`);
  console.log('');

  console.log('Token coverage');
  console.log(`  Covered sentence tokens: ${tokenCoverage.coveredTokens}/${tokenCoverage.totalTokens} (${(tokenCoverage.coverage * 100).toFixed(1)}%)`);
  console.log(`  Fully covered sentences: ${tokenCoverage.fullyCoveredSentences}/${rawSentences.length}`);
  console.log(`  Under 50% covered sentences: ${tokenCoverage.underHalfCoveredSentences}/${rawSentences.length}`);
  console.log(`  Top missing tokens: ${tokenCoverage.topMissingTokens.map(([token, count]) => `${token} (${count})`).join(', ')}`);
  console.log('');

  console.log('Word references');
  console.log(`  Sentences with zero refs: ${wordRefCoverage.zeroRefSentences.length}`);
  console.log(`  Sentences with invalid refs: ${wordRefCoverage.invalidRefSentences.length}`);
  console.log('');

  console.log('Phoneme readiness');
  console.log(`  Words missing phonemes: ${phonemeCoverage.wordsMissingPhonemes.length}`);
  console.log(`  Missing phoneme metadata IDs: ${phonemeCoverage.missingMetadataIds.join(', ') || 'none'}`);
  console.log('');

  console.log('Audio readiness');
  console.log(`  Word audio variants ready: ${wordAudioCoverage.readyVariants}/${wordAudioCoverage.totalVariants}`);
  console.log(`  Sentence audio variants ready: ${sentenceAudioCoverage.readyVariants}/${sentenceAudioCoverage.totalVariants}`);
  console.log(`  Missing word audio variants sample: ${wordAudioCoverage.missingAudioVariants.slice(0, 10).map(item => `${item.id}:${item.voiceId}`).join(', ') || 'none'}`);
  console.log(`  Missing sentence audio variants sample: ${sentenceAudioCoverage.missingAudioVariants.slice(0, 10).map(item => `${item.id}:${item.voiceId}`).join(', ') || 'none'}`);
  console.log('');

  console.log('Duplicate source sentences');
  console.log(`  Cross-category duplicates: ${rawSentenceDuplicates.length}`);
  console.log(`  Duplicate sample: ${rawSentenceDuplicates.slice(0, 5).map(item => `${item.text} [${item.categories.join(', ')}]`).join(' | ') || 'none'}`);
  console.log('');

  if (blockers.length > 0) {
    console.log('Portfolio blockers');
    for (const blocker of blockers) {
      console.log(`  - ${blocker}`);
    }
    process.exitCode = 1;
  } else {
    console.log('Portfolio blockers');
    console.log('  none');
  }

  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('Dataset audit failed:', error);
  process.exit(1);
});
