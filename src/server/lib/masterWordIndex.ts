/**
 * Lazy in-memory index over the curated `data/masterWords.json` dataset.
 *
 * Exposes a `Map<normalizedText, MasterWordEntry>` lookup used by the
 * Custom Sentence Builder's pronunciation resolver. The index is loaded
 * once per process and cached. Call `resetMasterWordIndex()` between tests
 * that mutate the underlying file.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { normalizeTokenForm } from '../services/sentenceTokenizer';

const LOG_TAG = '[MasterWordIndex]';

export interface MasterWordEntry {
  id: string;
  text: string;
  normalizedText: string;
  en?: string;
  partOfSpeech?: string;
  phonemes?: string[];
  pronunciationNotes?: string;
  [key: string]: unknown;
}

interface LoadedIndex {
  entries: MasterWordEntry[];
  byNormalizedText: Map<string, MasterWordEntry>;
}

let cachedPromise: Promise<LoadedIndex> | null = null;

function resolveMasterWordsPath(): string {
  if (process.env.MASTER_WORDS_PATH && process.env.MASTER_WORDS_PATH.trim().length > 0) {
    return path.resolve(process.env.MASTER_WORDS_PATH);
  }
  return path.resolve(process.cwd(), 'data', 'masterWords.json');
}

async function loadIndex(): Promise<LoadedIndex> {
  const filePath = resolveMasterWordsPath();
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as MasterWordEntry[];

  const byNormalizedText = new Map<string, MasterWordEntry>();
  for (const entry of parsed) {
    const primary = normalizeTokenForm(entry.normalizedText ?? entry.text);
    if (primary && !byNormalizedText.has(primary)) {
      byNormalizedText.set(primary, entry);
    }
  }

  console.log(`${LOG_TAG} loaded ${parsed.length} curated words (${byNormalizedText.size} lookup keys)`);
  return { entries: parsed, byNormalizedText };
}

export function getMasterWordIndex(): Promise<LoadedIndex> {
  if (!cachedPromise) {
    cachedPromise = loadIndex().catch((err) => {
      cachedPromise = null;
      throw err;
    });
  }
  return cachedPromise;
}

/**
 * Clears the cached promise. Test-only helper — call between tests that
 * stub `MASTER_WORDS_PATH` to point at fixture data.
 */
export function resetMasterWordIndex(): void {
  cachedPromise = null;
}

export async function findMasterWordByNormalized(
  normalizedForm: string
): Promise<MasterWordEntry | undefined> {
  const { byNormalizedText } = await getMasterWordIndex();
  return byNormalizedText.get(normalizedForm);
}
