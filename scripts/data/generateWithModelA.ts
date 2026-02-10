#!/usr/bin/env node

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

function hash(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  const cwd = process.cwd();
  const wordsRaw = await readJson<any>(path.join(cwd, 'STATIC DATA', 'words.json'));
  const sentencesRaw = await readJson<any>(path.join(cwd, 'data', 'sentences.json'));

  const words = (wordsRaw.categories ?? []).flatMap((category: any) =>
    (category.words ?? []).map((word: any) => ({
      id: word.id,
      text: word.pt,
      en: word.en,
      category: category.id,
      difficulty: word.difficulty,
      partOfSpeech: word.pos,
      pronunciationNotes: word.pronunciation_notes,
    }))
  );

  const sentences = (sentencesRaw.categories ?? []).flatMap((category: any) =>
    (category.sentences ?? []).map((sentence: any) => ({
      id: sentence.id,
      text: sentence.pt,
      en: sentence.en,
      category: category.id,
      difficulty: sentence.difficulty,
      pronunciationNotes: sentence.pronunciation_notes,
    }))
  );

  const sourceFingerprint = hash(JSON.stringify({ words, sentences }));
  const runId = `run_${sourceFingerprint.slice(0, 12)}`;
  const runDir = path.join(cwd, 'data', 'raw', 'llm_runs', runId);
  await ensureDir(runDir);

  const payload = {
    runId,
    model: 'google-ai-studio',
    mode: 'seed_from_existing_data',
    sourceFingerprint,
    generatedAt: new Date().toISOString(),
    words,
    sentences,
  };

  await fs.writeFile(path.join(runDir, 'model_a_output.json'), JSON.stringify(payload, null, 2), 'utf-8');
  await fs.writeFile(
    path.join(cwd, 'data', 'raw', 'llm_runs', 'latest-run.json'),
    JSON.stringify({ runId }, null, 2),
    'utf-8'
  );

  console.log(`[generateWithModelA] Generated ${words.length} words and ${sentences.length} sentences in ${runDir}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[generateWithModelA] ${message}`);
  process.exit(1);
});

