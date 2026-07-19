/**
 * Shared adapter functions for converting pronunciation data to normalized formats.
 *
 * These adapters are used by both:
 * - Dev pronunciation fixtures page
 * - Practice Sentences page
 */

import type { WordFeedback } from '@/types/pronunciationFixtures';
import type { WordScore, PhonemeScore } from '@/types/pronunciation';
import type { Sentence, Word } from '@/lib/types';
import type { NormalizedWordFeedback, NormalizedWordAudioVariant } from './types';
import { getAudioUrlForWordSync } from '@/utils/audioRouting';
import {
  resolveAzurePhonemeDisplaySymbol,
  PHONEME_PROBLEM_THRESHOLD,
} from '@/lib/azurePhonemeMap';

/**
 * Normalizes word text for matching (removes punctuation, lowercase).
 */
function normalizeWordToken(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"()¿¡«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Builds normalized phoneme entries from Azure's real per-phoneme scores.
 *
 * Azure is the source of truth: the score shown is always Azure's. When Azure
 * supplies a phoneme name we resolve it to the internal metadata ID (falling
 * back to the raw label so no phoneme is ever dropped). When Azure omits the
 * name (common for pt-BR), the entry is marked with azureLabel=null and shown as
 * "Sound N" until canonical positional alignment can borrow a display label
 * (see enrichWordsWithCanonicalData). There is NO fabrication path here — this
 * returns undefined when Azure returned no phoneme scores for the word.
 */
function buildPhonemesFromAzureScores(
  phonemeScores: PhonemeScore[] | undefined
): NormalizedWordFeedback['phonemes'] | undefined {
  if (!phonemeScores || phonemeScores.length === 0) {
    return undefined;
  }

  return phonemeScores.map((ps, i) => {
    const hasLabel = typeof ps.label === 'string' && ps.label.trim() !== '';
    const symbol = hasLabel
      ? resolveAzurePhonemeDisplaySymbol(ps.label) ?? `Sound ${i + 1}`
      : `Sound ${i + 1}`;

    return {
      symbol,
      score: Math.round(ps.accuracyScore),
      isProblem: ps.accuracyScore < PHONEME_PROBLEM_THRESHOLD,
      azureLabel: hasLabel ? ps.label!.trim() : null,
    };
  });
}

/**
 * Converts WordFeedback (from pronunciationFixtures) to NormalizedWordFeedback.
 *
 * Used only by the dev/demo fixtures page. Demo fixtures are hand-authored
 * sample data and may carry authored phoneme scores; they are passed through
 * unchanged.
 */
export function adaptFixtureWordsToNormalized(word: WordFeedback): NormalizedWordFeedback {
  return {
    id: word.wordId || `word_${word.index}`,
    text: word.text,
    accuracyScore: word.score,
    errorType: word.errorType || null,
    phonemes: word.phonemes,
    wordId: word.wordId,
    index: word.index,
    level: word.level,
    score: word.score,
  };
}

/**
 * Converts an array of WordScores to NormalizedWordFeedback array.
 *
 * Phoneme data comes exclusively from Azure's real per-phoneme scores
 * (WordScore.phonemeScores), parsed once by the normalizer. When a word has no
 * Azure phoneme scores its `phonemes` is left undefined so downstream can render
 * word-level-only feedback (or a reference-only phoneme panel via
 * enrichWordsWithCanonicalData). No per-phoneme scores are ever fabricated.
 *
 * @param wordScores - Array of WordScore from pronunciation assessment
 * @param _rawAzure - Deprecated/unused. Retained for call-site compatibility;
 *   phoneme data now flows through WordScore.phonemeScores rather than a
 *   second parse of the raw Azure response.
 * @param startIndex - Starting index for word numbering (default: 0)
 * @returns Array of NormalizedWordFeedback
 */
export function adaptWordScoresToNormalized(
  wordScores: WordScore[] | undefined,
  _rawAzure?: unknown,
  startIndex: number = 0
): NormalizedWordFeedback[] {
  if (!wordScores || wordScores.length === 0) {
    return [];
  }

  return wordScores.map((wordScore, idx) => {
    const index = startIndex + idx;
    const score = wordScore.accuracy;
    const level: NormalizedWordFeedback['level'] =
      score >= 90 ? 'excellent' :
      score >= 80 ? 'good' :
      score >= 70 ? 'ok' : 'practice';

    return {
      id: `word_${index}`,
      text: wordScore.word,
      accuracyScore: score,
      errorType: wordScore.errorType || null,
      phonemes: buildPhonemesFromAzureScores(wordScore.phonemeScores),
      index,
      level,
      score,
    };
  });
}

/**
 * Builds normalized word audio variants for a sentence.
 * Uses sentence.wordRefs to find word IDs and builds audio URLs.
 *
 * For now, only supports native word audio (no user variants).
 *
 * @param sentence - The sentence with wordRefs
 * @param voice - Voice type to use ('male' or 'female', default: 'male')
 * @returns Array of NormalizedWordAudioVariant, or empty array if no wordRefs
 */
export function buildWordAudioVariantsForSentence(
  sentence: Sentence,
  voice: 'male' | 'female' = 'male'
): NormalizedWordAudioVariant[] {
  if (!sentence.wordRefs || sentence.wordRefs.length === 0) {
    return [];
  }

  const variants: NormalizedWordAudioVariant[] = [];

  for (const wordRef of sentence.wordRefs) {
    const audioUrl = getAudioUrlForWordSync(wordRef.wordId, voice);
    if (audioUrl) {
      variants.push({
        type: 'native' as const,
        url: audioUrl,
        wordIndex: wordRef.tokenIndex,
        // startTimeMs and endTimeMs not available from sentence data
        // Could be added if sentence audio has word-level timing data
      });
    }
  }

  return variants;
}

/**
 * Augments normalized words with canonical metadata from masterWords.
 *
 * Two distinct roles, neither of which fabricates a score:
 *
 * 1. Words WITH real Azure phoneme scores: attach the canonical wordId, and —
 *    only for phonemes Azure left unlabeled (azureLabel === null) and only when
 *    the canonical phoneme count matches Azure's exactly — borrow the canonical
 *    phoneme as the display label. The Azure score is always kept unchanged.
 *
 * 2. Words WITHOUT Azure phoneme scores (reference-only mode: old cached
 *    attempts, or Azure omitted Phonemes): populate `phonemes` from the curated
 *    canonical phoneme list with NO score and NO problem flag, so the panel can
 *    show the reference sounds without implying any assessment.
 */
export function enrichWordsWithCanonicalData(
  sentence: Sentence | undefined,
  words: NormalizedWordFeedback[],
  canonicalWordMap?: Map<string, Word> | null
): NormalizedWordFeedback[] {
  if (!canonicalWordMap || words.length === 0) {
    return words;
  }

  const wordRefsByIndex = new Map<number, Word>();
  sentence?.wordRefs?.forEach(ref => {
    const canonicalWord = canonicalWordMap.get(ref.wordId);
    if (canonicalWord) {
      wordRefsByIndex.set(ref.tokenIndex, canonicalWord);
    }
  });

  const canonicalByNormalizedText = new Map<string, Word>();
  canonicalWordMap.forEach(word => {
    const normalized = normalizeWordToken(word.textPt);
    if (!canonicalByNormalizedText.has(normalized)) {
      canonicalByNormalizedText.set(normalized, word);
    }
  });

  return words.map(word => {
    let canonicalWord: Word | undefined;
    if (word.wordId) {
      canonicalWord = canonicalWordMap.get(word.wordId);
    }
    if (!canonicalWord && word.index !== undefined) {
      canonicalWord = wordRefsByIndex.get(word.index);
    }
    if (!canonicalWord) {
      canonicalWord = canonicalByNormalizedText.get(normalizeWordToken(word.text));
    }

    const wordId = canonicalWord?.id ?? word.wordId;
    const canonicalPhonemes = canonicalWord?.phonemes;

    // Case 1: real Azure phoneme scores present.
    if (word.phonemes && word.phonemes.length > 0) {
      let phonemes = word.phonemes;
      const hasUnlabeled = phonemes.some(p => p.azureLabel === null);
      if (
        hasUnlabeled &&
        canonicalPhonemes &&
        canonicalPhonemes.length === phonemes.length
      ) {
        phonemes = phonemes.map((p, i) =>
          p.azureLabel === null ? { ...p, symbol: canonicalPhonemes[i] } : p
        );
      }
      return { ...word, wordId, phonemes };
    }

    // Case 2: reference-only — no Azure phoneme scores for this word.
    if (!canonicalPhonemes || canonicalPhonemes.length === 0) {
      return { ...word, wordId };
    }
    return {
      ...word,
      wordId,
      // No score / no isProblem: reference display only.
      phonemes: canonicalPhonemes.map(symbol => ({ symbol })),
    };
  });
}
