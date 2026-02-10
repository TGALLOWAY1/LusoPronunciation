#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { runDatasetValidation } from '../../src/pipeline/validators/runDatasetValidation';

type Args = {
  version: string;
  force: boolean;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const versionArg = args.find((arg) => arg.startsWith('--version='));
  const rawVersion = versionArg?.split('=')[1]?.trim();
  if (!rawVersion) {
    throw new Error('Missing required --version=x.y.z argument.');
  }
  return {
    version: rawVersion.replace(/^v/, ''),
    force: args.includes('--force'),
  };
}

function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

function normalizeForDedupe(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function readJson<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

function buildCategoryLookups(wordsRaw: any, sentencesRaw: any) {
  const wordCategoryById = new Map<string, string>();
  const sentenceCategoryById = new Map<string, string>();
  const categoryDefinitions = new Map<string, { labelEn: string; labelPt: string }>();

  for (const category of wordsRaw.categories ?? []) {
    categoryDefinitions.set(category.id, {
      labelEn: category.label_en ?? category.id,
      labelPt: category.label_pt ?? category.id,
    });
    for (const word of category.words ?? []) {
      wordCategoryById.set(word.id, category.id);
    }
  }

  for (const category of sentencesRaw.categories ?? []) {
    categoryDefinitions.set(category.id, {
      labelEn: category.label_en ?? category.id,
      labelPt: category.label_pt ?? category.id,
    });
    for (const sentence of category.sentences ?? []) {
      sentenceCategoryById.set(sentence.id, category.id);
    }
  }

  return { wordCategoryById, sentenceCategoryById, categoryDefinitions };
}

function difficultyBand(difficulty: number): 'beginner' | 'intermediate' | 'advanced' {
  if (difficulty <= 2) return 'beginner';
  if (difficulty <= 4) return 'intermediate';
  return 'advanced';
}

async function main() {
  const { version, force } = parseArgs();
  const cwd = process.cwd();
  const releaseDir = path.join(cwd, 'data', 'releases', `v${version}`);

  try {
    await fs.access(releaseDir);
    if (!force) {
      throw new Error(`Release directory already exists: ${releaseDir}. Use --force to overwrite.`);
    }
    await fs.rm(releaseDir, { recursive: true, force: true });
  } catch {
    // Directory missing is expected.
  }

  await ensureDir(releaseDir);

  const masterWordsPath = path.join(cwd, 'data', 'masterWords.json');
  const masterSentencesPath = path.join(cwd, 'data', 'masterSentences.json');
  const audioIndexPath = path.join(cwd, 'data', 'audio_index.json');
  const phonemePath = path.join(cwd, 'data', 'phoneme_metadata.json');
  const wordsRawPath = path.join(cwd, 'STATIC DATA', 'words.json');
  const sentencesRawPath = path.join(cwd, 'data', 'sentences.json');

  const scoredWordsPath = path.join(cwd, 'data', 'intermediate', 'scored', 'words.scored.json');
  const scoredSentencesPath = path.join(cwd, 'data', 'intermediate', 'scored', 'sentences.scored.json');

  let baseWordsPath = masterWordsPath;
  let baseSentencesPath = masterSentencesPath;

  try {
    await fs.access(scoredWordsPath);
    await fs.access(scoredSentencesPath);
    baseWordsPath = scoredWordsPath;
    baseSentencesPath = scoredSentencesPath;
    console.log('[buildDatasetRelease] Using scored Option B intermediate data.');
  } catch {
    console.log('[buildDatasetRelease] Scored intermediate data not found; using master datasets.');
  }

  const [masterWords, masterSentences, audioIndex, phonemesRaw, wordsRaw, sentencesRaw] = await Promise.all([
    readJson<any[]>(baseWordsPath),
    readJson<any[]>(baseSentencesPath),
    readJson<Record<string, any>>(audioIndexPath),
    readJson<any[]>(phonemePath),
    readJson<any>(wordsRawPath),
    readJson<any>(sentencesRawPath),
  ]);

  const { wordCategoryById, sentenceCategoryById, categoryDefinitions } = buildCategoryLookups(wordsRaw, sentencesRaw);

  const words = masterWords.map((word) => ({
    ...word,
    locale: 'pt-BR',
    normalizedText: word.normalizedText ?? normalizeText(word.text ?? ''),
    category: wordCategoryById.get(word.id) ?? word.category,
    phonemes: Array.isArray(word.phonemes) ? word.phonemes : [],
    azureAssessmentConfigId: word.azureAssessmentConfigId ?? 'ptbr_word_default',
  }));

  const dedupedWords: any[] = [];
  const seenWordText = new Set<string>();
  for (const word of words) {
    const key = normalizeForDedupe(word.text ?? '');
    if (seenWordText.has(key)) continue;
    seenWordText.add(key);
    dedupedWords.push(word);
  }

  const sentences = masterSentences.map((sentence) => ({
    ...sentence,
    locale: 'pt-BR',
    normalizedText: sentence.normalizedText ?? normalizeText(sentence.text ?? ''),
    category: sentenceCategoryById.get(sentence.id) ?? sentence.category,
    wordRefs: Array.isArray(sentence.wordRefs) ? sentence.wordRefs : [],
    azureAssessmentConfigId: sentence.azureAssessmentConfigId ?? 'ptbr_sentence_default',
  }));

  const dedupedSentences: any[] = [];
  const seenSentenceText = new Set<string>();
  for (const sentence of sentences) {
    const key = normalizeForDedupe(sentence.text ?? '');
    if (seenSentenceText.has(key)) continue;
    seenSentenceText.add(key);
    dedupedSentences.push(sentence);
  }

  const categories = [...categoryDefinitions.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, labels], index) => ({
      id,
      locale: 'pt-BR',
      labelEn: labels.labelEn,
      labelPt: labels.labelPt,
      sortOrder: index,
    }));

  const phonemes = phonemesRaw.map((phoneme) => ({
    ...phoneme,
    locale: 'pt-BR',
  }));

  const pronunciationTips = phonemes.flatMap((phoneme) => {
    const tips = Array.isArray(phoneme.teachingTips) ? phoneme.teachingTips : [];
    if (tips.length === 0) {
      return [{
        id: `${phoneme.id}_tip_001`,
        locale: 'pt-BR',
        phonemeId: phoneme.id,
        title: `Tip for ${phoneme.id}`,
        instruction: `Practice "${phoneme.id}" in short words before full sentences.`,
        commonErrors: Array.isArray(phoneme.commonMistakes) ? phoneme.commonMistakes : [],
        drillTextIds: [],
        priority: 2,
      }];
    }
    return tips.map((tip: string, index: number) => ({
      id: `${phoneme.id}_tip_${String(index + 1).padStart(3, '0')}`,
      locale: 'pt-BR',
      phonemeId: phoneme.id,
      title: `Tip ${index + 1} for ${phoneme.id}`,
      instruction: tip,
      commonErrors: Array.isArray(phoneme.commonMistakes) ? phoneme.commonMistakes : [],
      drillTextIds: dedupedWords.filter((word) => (word.phonemes ?? []).includes(phoneme.id)).slice(0, 5).map((word) => word.id),
      priority: index === 0 ? 1 : 2,
    }));
  });

  const lessons = categories.flatMap((category, categoryIndex) => {
    const categorySentences = dedupedSentences.filter((sentence) => sentence.category === category.id);
    const categoryWords = dedupedWords.filter((word) => word.category === category.id);
    const prompts = [...categorySentences.map((sentence) => sentence.id), ...categoryWords.map((word) => word.id)];
    return ['beginner', 'intermediate', 'advanced'].map((band, bandIndex) => ({
      id: `${category.id}_${band}`,
      locale: 'pt-BR',
      categoryId: category.id,
      title: `${category.labelEn} ${band}`,
      difficultyBand: band,
      targetPhonemeIds: [],
      promptIds: prompts.filter((promptId) => {
        const sentence = categorySentences.find((item) => item.id === promptId);
        const word = categoryWords.find((item) => item.id === promptId);
        const difficulty = sentence?.difficulty ?? word?.difficulty ?? 3;
        return difficultyBand(difficulty) === band;
      }),
      progressionOrder: categoryIndex * 10 + bandIndex,
    }));
  });

  const azureAssessmentConfigs = [
    {
      id: 'ptbr_word_default',
      locale: 'pt-BR',
      gradingSystem: 'HundredMark',
      granularity: 'Phoneme',
      dimension: 'Comprehensive',
      enableMiscue: true,
      maxReferenceChars: 40,
      textNormalizationProfile: 'ptbr_v1',
    },
    {
      id: 'ptbr_sentence_default',
      locale: 'pt-BR',
      gradingSystem: 'HundredMark',
      granularity: 'Word',
      dimension: 'Comprehensive',
      enableMiscue: true,
      maxReferenceChars: 180,
      textNormalizationProfile: 'ptbr_v1',
    },
  ];

  const augmentedAudioIndex: Record<string, any> = { ...audioIndex };
  const ensureAudioEntry = (item: any, type: 'word' | 'sentence') => {
    if (augmentedAudioIndex[item.id]) return;
    augmentedAudioIndex[item.id] = {
      type,
      sourceId: item.id,
      textPt: item.text,
      textEn: item.en ?? '',
      ptbr: {
        male: `audio/ptbr/male/${item.id}.wav`,
        female: `audio/ptbr/female/${item.id}.wav`,
      },
      voices: {
        ptbr_male: `/audio/${type}s/ptbr_male/${item.id}.wav`,
        ptbr_female: `/audio/${type}s/ptbr_female/${item.id}.wav`,
      },
    };
  };
  for (const word of dedupedWords) ensureAudioEntry(word, 'word');
  for (const sentence of dedupedSentences) ensureAudioEntry(sentence, 'sentence');

  const scoredConfidencePath = path.join(cwd, 'data', 'intermediate', 'scored', 'confidence-report.json');
  let confidenceReport: any = {
    generatedAt: new Date().toISOString(),
    mode: 'bootstrap_from_master',
    accepted: dedupedWords.length + dedupedSentences.length,
    review: 0,
    rejected: 0,
    thresholds: {
      accept: 0.85,
      review: 0.7,
    },
  };
  try {
    confidenceReport = await readJson<any>(scoredConfidencePath);
  } catch {
    // Keep default bootstrap report.
  }

  await Promise.all([
    writeJson(path.join(releaseDir, 'words.json'), dedupedWords),
    writeJson(path.join(releaseDir, 'sentences.json'), dedupedSentences),
    writeJson(path.join(releaseDir, 'categories.json'), categories),
    writeJson(path.join(releaseDir, 'phonemes.json'), phonemes),
    writeJson(path.join(releaseDir, 'pronunciationTips.json'), pronunciationTips),
    writeJson(path.join(releaseDir, 'lessons.json'), lessons),
    writeJson(path.join(releaseDir, 'audio_index.json'), augmentedAudioIndex),
    writeJson(path.join(releaseDir, 'azureAssessmentConfigs.json'), azureAssessmentConfigs),
    writeJson(path.join(releaseDir, 'confidence-report.json'), confidenceReport),
  ]);

  const validationReport = runDatasetValidation(version, {
    words,
    words: dedupedWords,
    sentences: dedupedSentences,
    categories,
    phonemes,
    pronunciationTips,
    azureAssessmentConfigs,
    audioIndex: augmentedAudioIndex,
  });

  await writeJson(path.join(releaseDir, 'validation-report.json'), validationReport);

  if (validationReport.summary.errors > 0) {
    throw new Error(
      `Release validation failed with ${validationReport.summary.errors} errors (${validationReport.summary.warnings} warnings).`
    );
  }

  console.log(`Release v${version} built at ${releaseDir}`);
  console.log(
    `Words: ${dedupedWords.length}, Sentences: ${dedupedSentences.length}, Categories: ${categories.length}, Validation warnings: ${validationReport.summary.warnings}`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[buildDatasetRelease] ${message}`);
  process.exit(1);
});
