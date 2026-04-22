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
import mongoose from 'mongoose';
import { normalizeTokenForm } from '../services/sentenceTokenizer';
import { LexiconReviewItemModel } from '../models/LexiconReviewItemModel';

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

async function loadPromotedEntries(): Promise<MasterWordEntry[]> {
  // Skip if no Mongo connection is active — happens in unit tests that only
  // exercise the curated JSON path.
  if (mongoose.connection.readyState !== 1) {
    return [];
  }
  try {
    const docs = await LexiconReviewItemModel.find({ status: 'promoted' }).lean();
    return docs
      .filter((d) => d.promoted)
      .map((d) => ({
        id: `promoted_${d._id.toString()}`,
        text: d.promoted!.text,
        normalizedText: d.promoted!.normalizedText,
        en: d.promoted!.en,
        partOfSpeech: d.promoted!.partOfSpeech,
        phonemes: d.promoted!.phonemes,
        pronunciationNotes: d.promoted!.pronunciationNotes,
        ipa: d.promoted!.ipa,
        source: 'promoted' as const,
      }));
  } catch (err) {
    console.warn(`${LOG_TAG} failed to load promoted entries:`, err);
    return [];
  }
}

async function loadIndex(): Promise<LoadedIndex> {
  const filePath = resolveMasterWordsPath();
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as MasterWordEntry[];
  const promoted = await loadPromotedEntries();

  const byNormalizedText = new Map<string, MasterWordEntry>();
  for (const entry of parsed) {
    const primary = normalizeTokenForm(entry.normalizedText ?? entry.text);
    if (primary && !byNormalizedText.has(primary)) {
      byNormalizedText.set(primary, entry);
    }
  }
  // Promoted entries fill gaps; they don't override curated entries.
  for (const entry of promoted) {
    const primary = normalizeTokenForm(entry.normalizedText ?? entry.text);
    if (primary && !byNormalizedText.has(primary)) {
      byNormalizedText.set(primary, entry);
    }
  }

  console.log(
    `${LOG_TAG} loaded ${parsed.length} curated + ${promoted.length} promoted words (${byNormalizedText.size} lookup keys)`
  );
  return {
    entries: [...parsed, ...promoted],
    byNormalizedText,
  };
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
