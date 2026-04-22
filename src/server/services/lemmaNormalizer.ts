/**
 * Heuristic lemma / root-form candidates for Brazilian Portuguese surface forms.
 *
 * Operates on the diacritic-stripped, lowercased key used by the curated-word
 * index (see `normalizeTokenForm`). Rules are intentionally conservative — the
 * resolver only picks a candidate if it matches an existing curated entry, so
 * false positives just fall through to the next resolution stage.
 *
 * Covered transformations:
 *   Plural → singular:
 *     ões → ão      (nações → nação,   nacoes → nacao)
 *     ães → ão      (cães → cão,       caes → cao)
 *     ais → al      (animais → animal)
 *     éis → el      (papéis → papel,   papeis → papel)
 *     óis → ol      (sóis → sol,       sois → sol)
 *     uis → ul      (azuis → azul)
 *     ens → em      (homens → homem)
 *     res → r       (mulheres → mulher)
 *     zes → z       (vozes → voz,      luzes → luz)
 *     s   → ''      (casas → casa,     livros → livro)
 *
 *   Present participle → infinitive:
 *     ando → ar     (falando → falar)
 *     endo → er     (comendo → comer)
 *     indo → ir     (partindo → partir)
 */

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

type Rule = {
  suffix: string;
  replacement: string;
  minLength: number;
};

const RULES: Rule[] = [
  { suffix: 'oes', replacement: 'ao', minLength: 4 },
  { suffix: 'aes', replacement: 'ao', minLength: 4 },
  { suffix: 'ais', replacement: 'al', minLength: 4 },
  { suffix: 'eis', replacement: 'el', minLength: 4 },
  { suffix: 'ois', replacement: 'ol', minLength: 4 },
  { suffix: 'uis', replacement: 'ul', minLength: 4 },
  { suffix: 'ens', replacement: 'em', minLength: 4 },
  { suffix: 'res', replacement: 'r', minLength: 4 },
  { suffix: 'zes', replacement: 'z', minLength: 4 },
  { suffix: 'ando', replacement: 'ar', minLength: 6 },
  { suffix: 'endo', replacement: 'er', minLength: 6 },
  { suffix: 'indo', replacement: 'ir', minLength: 6 },
];

/**
 * Generates ordered lemma candidates for a normalized surface form. The
 * caller should try each against the curated word index; first hit wins.
 */
export function candidateLemmas(normalizedForm: string): string[] {
  const word = normalizedForm?.trim() ?? '';
  if (!word) return [];

  const out: string[] = [];
  const seen = new Set<string>([word]);

  function push(candidate: string) {
    const trimmed = candidate.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }

  for (const rule of RULES) {
    if (word.length >= rule.minLength && word.endsWith(rule.suffix)) {
      push(word.slice(0, -rule.suffix.length) + rule.replacement);
    }
  }

  // Bare "s" stripping, only if that leaves a plausible root ending in a
  // letter that can actually host a singular ending. Kept last so it runs
  // after the richer -oes/-aes/-ais rules above (deduped via seen).
  if (word.length >= 4 && word.endsWith('s') && !word.endsWith('ss')) {
    push(word.slice(0, -1));
  }

  // Single-character "pure vowel" lemma as a last resort: rare in PT, skip.
  void VOWELS;

  return out;
}

/**
 * Convenience helper: returns the first candidate or the word itself.
 * Not used by the resolver (which iterates through every candidate), but
 * handy for debug logging and tests.
 */
export function normalizeToLemma(normalizedForm: string): string {
  const candidates = candidateLemmas(normalizedForm);
  return candidates[0] ?? normalizedForm;
}
