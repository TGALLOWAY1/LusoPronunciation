/**
 * Azure pt-BR phoneme → internal metadata ID mapping.
 *
 * Azure Speech Service returns phoneme-level pronunciation scores when the
 * assessment is requested with `Granularity: 'Phoneme'`. When Azure includes a
 * phoneme NAME, pt-BR uses the IPA symbols from Microsoft's SSML phonetic
 * alphabet for Brazilian Portuguese. This module maps those documented IPA
 * symbols to the app's internal phoneme IDs used in
 * `data/phoneme_metadata.json`, so the UI can enrich a scored phoneme with its
 * curated IPA, tips, and example words.
 *
 * IMPORTANT: Azure is the source of truth for the SCORE. This map only affects
 * how a scored phoneme is *labelled/enriched* for display and how it is bucketed
 * for analytics. Microsoft documents that phoneme names are only guaranteed for
 * en-US / zh-CN; pt-BR frequently returns scores with NO name at all — in that
 * case there is nothing to map here and the caller keeps the raw score with a
 * null label (see the normalizer / adapter positional-alignment path).
 *
 * Unmapped/unknown labels are NOT in this table: callers pass them through and
 * display the raw label so no returned score is ever discarded.
 *
 * Documented Azure pt-BR IPA inventory (source: Microsoft SSML phonetic
 * alphabet, pt-BR):
 *   Vowels:            i ĩ a ɔ u ũ o e ɐ̃ ə ɛ ẽ õ
 *   Consonants/glides: w̃ w j̃ j p b t d g k m n ɲ f v ɾ x s z ʃ ʒ tʃ dʒ l ʎ
 */

/**
 * Exact-match table: Azure pt-BR IPA symbol → internal metadata ID.
 *
 * Most entries are 1:1 with a metadata entry sharing the same IPA. A handful are
 * nearest-match approximations (the internal inventory has no exact equivalent);
 * each is annotated below so the lead can review the judgment call.
 */
export const AZURE_PTBR_PHONEME_TO_INTERNAL: Record<string, string> = {
  // ── Oral vowels (exact IPA matches in metadata) ──
  i: 'IY', // close front
  a: 'AA', // open
  ɔ: 'AO', // open-mid back
  u: 'UW', // close back
  o: 'OW', // close-mid back
  e: 'EY', // close-mid front
  ɛ: 'EH', // open-mid front

  // ── Nasal vowels (exact IPA matches) ──
  'ɐ̃': 'AN_NASAL', // ɐ + U+0303
  ẽ: 'EN_NASAL',
  ĩ: 'IN_NASAL',
  õ: 'ON_NASAL',
  ũ: 'UN_NASAL',

  // ── Reduced vowel (nearest match) ──
  // ə (schwa) has no dedicated metadata entry; AH is the near-open central
  // vowel (ɐ), the closest reduced/central vowel we model. NEAREST-MATCH.
  ə: 'AH',

  // ── Glides ──
  w: 'W', // labio-velar approximant
  j: 'Y', // palatal approximant
  // Nasalized glides have no dedicated metadata entry; map to their oral glide.
  // NEAREST-MATCH (score preserved; nasality not separately modelled).
  'w̃': 'W', // w + U+0303
  'j̃': 'Y', // j + U+0303

  // ── Plosives (exact) ──
  p: 'P',
  b: 'B',
  t: 'T',
  d: 'D',
  g: 'G',
  k: 'K',

  // ── Nasals ──
  m: 'M',
  n: 'N',
  ɲ: 'NH', // palatal nasal → "nh" (minha, vinho)

  // ── Fricatives ──
  f: 'F',
  v: 'V',
  s: 'S',
  z: 'Z',
  ʃ: 'SH', // "ch" (chave)
  ʒ: 'ZH', // "j" (já, gente)
  // x = guttural/strong R (rr, carro). Internal HH carries the guttural-R
  // grapheme label. Per design, x → HH. NEAREST-MATCH (metadata IPA is "h").
  x: 'HH',

  // ── Affricates ──
  tʃ: 'CH', // "ti" (tipo, noite)
  dʒ: 'JH', // "di" (dia, cidade)

  // ── Liquids / tap ──
  l: 'L',
  ʎ: 'LH', // palatal lateral → "lh" (filho, mulher)
  ɾ: 'R_TAP', // alveolar tap (caro, para)
};

/**
 * Maps an Azure phoneme label to an internal metadata ID.
 *
 * Normalizes Unicode (NFC) so combining diacritics (e.g. ɐ̃, ẽ) match the table
 * keys regardless of the composition form Azure emits.
 *
 * @param label - Raw Azure phoneme name (IPA), or null/undefined when Azure
 *   omitted the name (common for pt-BR).
 * @returns The internal metadata ID when the label is a documented Azure pt-BR
 *   symbol; otherwise `null` (unmapped or unlabeled). Callers that display the
 *   phoneme should fall back to the raw label; callers that aggregate by phoneme
 *   identity (analytics) should skip null results.
 */
export function mapAzurePhonemeToInternalId(
  label: string | null | undefined
): string | null {
  if (typeof label !== 'string') {
    return null;
  }
  const trimmed = label.trim();
  if (trimmed === '') {
    return null;
  }
  const normalized = trimmed.normalize('NFC');
  return (
    AZURE_PTBR_PHONEME_TO_INTERNAL[normalized] ??
    AZURE_PTBR_PHONEME_TO_INTERNAL[trimmed] ??
    null
  );
}

/**
 * Resolves the best display/enrichment symbol for an Azure phoneme label:
 * the internal metadata ID when mapped, otherwise the raw label passed through
 * (never discarded). Returns null only when there is no label at all.
 */
export function resolveAzurePhonemeDisplaySymbol(
  label: string | null | undefined
): string | null {
  const internalId = mapAzurePhonemeToInternalId(label);
  if (internalId) {
    return internalId;
  }
  if (typeof label === 'string' && label.trim() !== '') {
    return label.trim();
  }
  return null;
}

/**
 * Shared threshold: Azure's documented mispronunciation cutoff. A phoneme (or
 * word) accuracy score below this is flagged as a problem in the UI and coaching.
 */
export const PHONEME_PROBLEM_THRESHOLD = 60;
