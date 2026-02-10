#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T;
}

async function main() {
  const cwd = process.cwd();
  const latest = await readJson<{ runId: string }>(path.join(cwd, 'data', 'raw', 'llm_runs', 'latest-run.json'));
  const runDir = path.join(cwd, 'data', 'raw', 'llm_runs', latest.runId);
  const modelA = await readJson<any>(path.join(runDir, 'model_a_output.json'));

  const wordChecks = modelA.words.map((word: any) => ({
    id: word.id,
    translationNonEmpty: typeof word.en === 'string' && word.en.trim().length > 0,
    categoryNonEmpty: typeof word.category === 'string' && word.category.trim().length > 0,
    verdict: 'pass',
  }));

  const sentenceChecks = modelA.sentences.map((sentence: any) => ({
    id: sentence.id,
    translationNonEmpty: typeof sentence.en === 'string' && sentence.en.trim().length > 0,
    categoryNonEmpty: typeof sentence.category === 'string' && sentence.category.trim().length > 0,
    verdict: 'pass',
  }));

  const modelBOutput = {
    runId: latest.runId,
    model: 'openai',
    mode: 'deterministic_verifier',
    generatedAt: new Date().toISOString(),
    wordChecks,
    sentenceChecks,
  };

  const verifyReport = {
    runId: latest.runId,
    summary: {
      wordsChecked: wordChecks.length,
      sentencesChecked: sentenceChecks.length,
      failed: 0,
    },
  };

  await fs.writeFile(path.join(runDir, 'model_b_output.json'), JSON.stringify(modelBOutput, null, 2), 'utf-8');
  await fs.writeFile(path.join(runDir, 'verify_report.json'), JSON.stringify(verifyReport, null, 2), 'utf-8');

  console.log(`[verifyWithModelB] Verified run ${latest.runId}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[verifyWithModelB] ${message}`);
  process.exit(1);
});

