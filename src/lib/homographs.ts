import homographData from '../../data/static/homographs.ptbr.json';

export interface HomographReading {
  meaning: string;
  ipa: string;
}

export interface HomographEntry {
  form: string;
  readings: HomographReading[];
}

function normalize(word: string): string {
  return word
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

const index: Map<string, HomographEntry> = new Map(
  (homographData as HomographEntry[]).map((entry) => [normalize(entry.form), entry])
);

/**
 * Look up a Portuguese word in the curated homograph list.
 * Returns the canonical entry (with original casing/diacritics) if the word
 * has multiple context-dependent pronunciations; otherwise null.
 *
 * Lookup is case- and diacritic-insensitive so 'SEDE', 'sede', and 'sedé'
 * all match the same entry.
 */
export function findHomograph(word: string | null | undefined): HomographEntry | null {
  if (!word) return null;
  const key = normalize(word);
  if (!key) return null;
  return index.get(key) ?? null;
}
