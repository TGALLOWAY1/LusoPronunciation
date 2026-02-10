#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import dataQualityConfig from '../../config/dataQuality.config';

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function scoreItem(text: string, translation: string): number {
  const textScore = Math.min(text.length / 30, 1) * 0.4;
  const translationScore = Math.min((translation?.length ?? 0) / 20, 1) * 0.3;
  const punctuationScore = /[.!?]$/.test(text) ? 0.3 : 0.2;
  return Math.max(0, Math.min(1, textScore + translationScore + punctuationScore));
}

async function main() {
  const cwd = process.cwd();
  const normalizedDir = path.join(cwd, 'data', 'intermediate', 'normalized');
  const scoredDir = path.join(cwd, 'data', 'intermediate', 'scored');
  await ensureDir(scoredDir);

  const words = await readJson<any[]>(path.join(normalizedDir, 'words.normalized.json'));
  const sentences = await readJson<any[]>(path.join(normalizedDir, 'sentences.normalized.json'));

  const scoredWords = words.map((word) => {
    const confidenceScore = scoreItem(word.text, word.en);
    const lowConfidence = confidenceScore < dataQualityConfig.thresholds.acceptConfidence;
    return { ...word, confidenceScore, lowConfidence };
  });

  const scoredSentences = sentences.map((sentence) => {
    const confidenceScore = scoreItem(sentence.text, sentence.en);
    const lowConfidence = confidenceScore < dataQualityConfig.thresholds.acceptConfidence;
    return { ...sentence, confidenceScore, lowConfidence };
  });

  const accepted = [...scoredWords, ...scoredSentences]
    .filter((item) => item.confidenceScore >= dataQualityConfig.thresholds.acceptConfidence)
    .length;
  const review = [...scoredWords, ...scoredSentences]
    .filter(
      (item) =>
        item.confidenceScore >= dataQualityConfig.thresholds.reviewConfidence &&
        item.confidenceScore < dataQualityConfig.thresholds.acceptConfidence
    )
    .length;
  const rejected = [...scoredWords, ...scoredSentences]
    .filter((item) => item.confidenceScore < dataQualityConfig.thresholds.reviewConfidence)
    .length;

  await fs.writeFile(path.join(scoredDir, 'words.scored.json'), JSON.stringify(scoredWords, null, 2), 'utf-8');
  await fs.writeFile(path.join(scoredDir, 'sentences.scored.json'), JSON.stringify(scoredSentences, null, 2), 'utf-8');
  await fs.writeFile(
    path.join(scoredDir, 'confidence-report.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        accepted,
        review,
        rejected,
        thresholds: dataQualityConfig.thresholds,
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log(`[scoreAndFilter] Accepted=${accepted} Review=${review} Rejected=${rejected}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[scoreAndFilter] ${message}`);
  process.exit(1);
});

