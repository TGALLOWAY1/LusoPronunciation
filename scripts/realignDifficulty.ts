/**
 * One-off maintenance script: derive the coarse `difficulty` bucket (2/3/4)
 * deterministically from each entry's `difficultyScore`, for both
 * data/masterWords.json and data/masterSentences.json.
 *
 * Cutoffs were chosen to maximise agreement with CEFR grouping
 * (A1/A2 -> 2, B1 -> 3, B2+ -> 4) while keeping the score scales of the two
 * datasets separate (words max ~65, sentences max ~88):
 *
 *   WORDS:     difficulty = 2 if score < 12, 3 if 12 <= score < 38, else 4
 *   SENTENCES: difficulty = 2 if score < 27, 3 if 27 <= score < 39, else 4
 *
 * Only the `difficulty` field is rewritten; every other field and the file
 * formatting (2-space indent + trailing newline) is preserved. No API calls.
 *
 * Usage: npx tsx scripts/realignDifficulty.ts [--dry]
 */

import { promises as fs } from 'fs';
import * as path from 'path';

interface Entry {
  id: string;
  difficulty: 2 | 3 | 4;
  difficultyScore: number;
  cefr?: string;
  [key: string]: unknown;
}

const CUTOFFS = {
  words: { c1: 12, c2: 38 },
  sentences: { c1: 27, c2: 39 },
};

function bucket(score: number, c1: number, c2: number): 2 | 3 | 4 {
  if (score < c1) return 2;
  if (score < c2) return 3;
  return 4;
}

async function realign(fileName: string, c1: number, c2: number, dryRun: boolean): Promise<void> {
  const filePath = path.join(process.cwd(), 'data', fileName);
  const raw = await fs.readFile(filePath, 'utf-8');
  const entries = JSON.parse(raw) as Entry[];

  let changed = 0;
  for (const entry of entries) {
    const next = bucket(entry.difficultyScore, c1, c2);
    if (next !== entry.difficulty) changed++;
    entry.difficulty = next;
  }

  console.log(`${fileName}: ${entries.length} entries, cutoffs (<${c1} => 2, <${c2} => 3, else 4), ${changed} reassigned`);

  if (!dryRun) {
    await fs.writeFile(filePath, JSON.stringify(entries, null, 2) + '\n', 'utf-8');
    console.log(`  wrote ${filePath}`);
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry');
  await realign('masterWords.json', CUTOFFS.words.c1, CUTOFFS.words.c2, dryRun);
  await realign('masterSentences.json', CUTOFFS.sentences.c1, CUTOFFS.sentences.c2, dryRun);
  if (dryRun) console.log('\n[--dry] No files written.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
