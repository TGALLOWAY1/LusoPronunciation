#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { mapWordToPhonemes } from '../../src/pipeline/phonemeMapper';

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

async function main() {
  const cwd = process.cwd();
  const latest = await readJson<{ runId: string }>(path.join(cwd, 'data', 'raw', 'llm_runs', 'latest-run.json'));
  const runDir = path.join(cwd, 'data', 'raw', 'llm_runs', latest.runId);
  const modelA = await readJson<any>(path.join(runDir, 'model_a_output.json'));

  const words = modelA.words.map((word: any) => {
    const { phonemes, ipa } = mapWordToPhonemes(word.text);
    return {
      id: word.id,
      locale: 'pt-BR',
      text: word.text,
      normalizedText: normalizeText(word.text),
      en: word.en,
      category: word.category,
      partOfSpeech: word.partOfSpeech ?? 'unknown',
      difficulty: word.difficulty ?? 3,
      difficultForEnglish: false,
      pronunciationNotes: word.pronunciationNotes,
      phonemes: phonemes ?? [],
      ipa,
      azureAssessmentConfigId: 'ptbr_word_default',
      sourceModel: 'google-ai-studio',
    };
  });

  const sentences = modelA.sentences.map((sentence: any) => ({
    id: sentence.id,
    locale: 'pt-BR',
    text: sentence.text,
    normalizedText: normalizeText(sentence.text),
    en: sentence.en,
    category: sentence.category,
    difficulty: sentence.difficulty ?? 3,
    pronunciationNotes: sentence.pronunciationNotes,
    wordRefs: [],
    azureAssessmentConfigId: 'ptbr_sentence_default',
    sourceModel: 'google-ai-studio',
  }));

  const normalizedDir = path.join(cwd, 'data', 'intermediate', 'normalized');
  await ensureDir(normalizedDir);
  await fs.writeFile(path.join(normalizedDir, 'words.normalized.json'), JSON.stringify(words, null, 2), 'utf-8');
  await fs.writeFile(path.join(normalizedDir, 'sentences.normalized.json'), JSON.stringify(sentences, null, 2), 'utf-8');

  console.log(`[normalizeGeneratedData] Normalized ${words.length} words and ${sentences.length} sentences`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[normalizeGeneratedData] ${message}`);
  process.exit(1);
});

