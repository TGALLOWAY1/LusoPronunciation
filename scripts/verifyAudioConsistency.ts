/**
 * Prebuild gate: verifies voice-tagged audio paths in data/audio_index.json
 * match the voice key they are listed under. Catches generation drift where
 * e.g. a "male" entry got regenerated with a female voice and ended up on a
 * path still tagged "female", or where a sentence's male/female variants were
 * produced by different voices across generation runs.
 *
 * Runs as part of `npm run prebuild`. Exits non-zero on mismatch so CI fails
 * fast rather than shipping inconsistent audio to users.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

type VoiceFamily = 'male' | 'female';

type AudioIndexEntry = {
  type?: string;
  sourceId?: string;
  textPt?: string;
  ptbr?: Partial<Record<VoiceFamily, string>>;
  voices?: Record<string, string>;
};

type Mismatch = {
  id: string;
  key: string;
  url: string;
  expected: VoiceFamily;
  found: VoiceFamily | null;
};

function getVoiceTagFromUrl(url: string): VoiceFamily | null {
  const lower = url.toLowerCase();
  if (
    /(^|\/)ptbr_male(\/|$)/.test(lower) ||
    /(^|\/)male(\/|$)/.test(lower) ||
    /_male\.[a-z0-9]+$/.test(lower)
  ) {
    return 'male';
  }
  if (
    /(^|\/)ptbr_female(\/|$)/.test(lower) ||
    /(^|\/)female(\/|$)/.test(lower) ||
    /_female\.[a-z0-9]+$/.test(lower)
  ) {
    return 'female';
  }
  return null;
}

function expectedVoiceForKey(key: string): VoiceFamily | null {
  if (key === 'male' || key === 'ptbr_male') return 'male';
  if (key === 'female' || key === 'ptbr_female') return 'female';
  return null;
}

function collectMismatches(index: Record<string, AudioIndexEntry>): Mismatch[] {
  const mismatches: Mismatch[] = [];

  for (const [id, entry] of Object.entries(index)) {
    const groups: Array<[string, Record<string, string> | undefined]> = [
      ['ptbr', entry.ptbr as Record<string, string> | undefined],
      ['voices', entry.voices],
    ];

    for (const [, group] of groups) {
      if (!group) continue;
      for (const [key, url] of Object.entries(group)) {
        const expected = expectedVoiceForKey(key);
        if (!expected || typeof url !== 'string' || url.length === 0) continue;
        const found = getVoiceTagFromUrl(url);
        if (found && found !== expected) {
          mismatches.push({ id, key, url, expected, found });
        }
      }
    }
  }

  return mismatches;
}

function main(): void {
  const indexPath = resolve(process.cwd(), 'data', 'audio_index.json');
  const raw = readFileSync(indexPath, 'utf8');
  const index = JSON.parse(raw) as Record<string, AudioIndexEntry>;

  const mismatches = collectMismatches(index);

  if (mismatches.length === 0) {
    const entryCount = Object.keys(index).length;
    console.log(`verifyAudioConsistency: OK (${entryCount} entries checked)`);
    return;
  }

  console.error(
    `verifyAudioConsistency: FAIL (${mismatches.length} voice-tag mismatches in data/audio_index.json):`
  );
  for (const m of mismatches.slice(0, 20)) {
    console.error(
      `  ${m.id}.${m.key}: expected ${m.expected}, url tag = ${m.found} (${m.url})`
    );
  }
  if (mismatches.length > 20) {
    console.error(`  ... and ${mismatches.length - 20} more`);
  }
  process.exit(1);
}

main();
