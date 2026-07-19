/**
 * One-off maintenance script: regenerate the `phonemes` array of every entry in
 * data/masterWords.json using the fixed pt-BR grapheme-to-phoneme mapper
 * (src/pipeline/phonemeMapper.ts).
 *
 * Only the `phonemes` field is rewritten; every other field and the overall field
 * order / formatting (2-space indent, trailing newline) is preserved exactly.
 *
 * This script performs NO external API calls (no Gemini / Azure) — it is pure G2P.
 *
 * Usage:
 *   npx tsx scripts/remapWordPhonemes.ts          # write changes
 *   npx tsx scripts/remapWordPhonemes.ts --dry     # report only, no write
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { mapWordToPhonemes } from '../src/pipeline/phonemeMapper';

interface WordEntry {
  id: string;
  text: string;
  phonemes: string[];
  [key: string]: unknown;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry');
  const filePath = path.join(process.cwd(), 'data', 'masterWords.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  const words = JSON.parse(raw) as WordEntry[];

  let changed = 0;
  const samples: string[] = [];

  for (const word of words) {
    const before = word.phonemes ?? [];
    const after = mapWordToPhonemes(word.text).phonemes;
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changed++;
      if (samples.length < 20) {
        samples.push(`  ${word.id} "${word.text}": ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
      }
    }
    word.phonemes = after; // mutate in place — field order preserved
  }

  console.log(`Words processed: ${words.length}`);
  console.log(`Words with changed phonemes: ${changed}`);
  console.log('Sample changes:');
  console.log(samples.join('\n'));

  if (dryRun) {
    console.log('\n[--dry] No file written.');
    return;
  }

  const serialized = JSON.stringify(words, null, 2) + '\n';
  await fs.writeFile(filePath, serialized, 'utf-8');
  console.log(`\nWrote ${filePath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
