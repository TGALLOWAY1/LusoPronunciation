import type { AttemptScore } from '@/types/pronunciation';
import type { ConfusionTag } from './minimalPairs.ptbr';

const WEAK_WORD_THRESHOLD = 85;
const MAX_WEAK_WORDS = 5;

const TAG_PRIORITY: ConfusionTag[] = [
  'nasalization',
  'r_rr',
  'r_initial',
  'lh_nh',
  'tch_ti',
  'dji_di',
  'vowel_open_close',
  'final_l_u',
  's_z',
  'b_p',
  'f_v',
  't_d',
  'k_g',
];

function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/[.,!?;:'"()¿¡«»]/g, '')
    .trim();
}

function tokenizeSentence(sentenceText: string | undefined): string[] {
  if (!sentenceText) {
    return [];
  }

  return sentenceText
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);
}

function getCandidateTokens(attempt: AttemptScore, sentenceText?: string): string[] {
  const sentenceTokens = tokenizeSentence(sentenceText);
  const weakWords = [...(attempt.wordScores ?? [])]
    .map((wordScore, index) => ({
      index,
      score: wordScore.accuracy,
      word: normalizeToken(wordScore.word),
      sentenceToken: normalizeToken(sentenceTokens[index] ?? ''),
    }))
    .filter((item) => typeof item.score === 'number' && item.score < WEAK_WORD_THRESHOLD)
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_WEAK_WORDS);

  const tokens = weakWords
    .map((item) => item.sentenceToken || item.word)
    .filter(Boolean);

  if (tokens.length > 0) {
    return tokens;
  }

  if (sentenceTokens.length > 0) {
    return sentenceTokens.slice(0, MAX_WEAK_WORDS);
  }

  return (attempt.wordScores ?? [])
    .map((wordScore) => normalizeToken(wordScore.word))
    .filter(Boolean)
    .slice(0, MAX_WEAK_WORDS);
}

function incrementTagScore(tagScores: Map<ConfusionTag, number>, tag: ConfusionTag): void {
  tagScores.set(tag, (tagScores.get(tag) ?? 0) + 1);
}

function scoreTokenTagSignals(token: string, tagScores: Map<ConfusionTag, number>): void {
  if (!token) {
    return;
  }

  if (/nh|lh/.test(token)) {
    incrementTagScore(tagScores, 'lh_nh');
  }

  if (/rr/.test(token)) {
    incrementTagScore(tagScores, 'r_rr');
  } else if (/^r/.test(token)) {
    incrementTagScore(tagScores, 'r_initial');
  }

  if (
    /[ãõ]/.test(token) ||
    /(ão|õe|ãe|ães|ãos|em|en|am|an|im|in|om|on|um|un)$/.test(token)
  ) {
    incrementTagScore(tagScores, 'nasalization');
  }

  if (/ti[aeiouáéíóúâêôãõ]/.test(token)) {
    incrementTagScore(tagScores, 'tch_ti');
  }

  if (/di[aeiouáéíóúâêôãõ]/.test(token)) {
    incrementTagScore(tagScores, 'dji_di');
  }

  if (/[éêóô]/.test(token)) {
    incrementTagScore(tagScores, 'vowel_open_close');
  }

  if (/l$/.test(token)) {
    incrementTagScore(tagScores, 'final_l_u');
  }

  if (
    /[aeiouáéíóúâêôãõ]s[aeiouáéíóúâêôãõ]/.test(token) ||
    /z|ç/.test(token)
  ) {
    incrementTagScore(tagScores, 's_z');
  }

  if (/[bp]/.test(token)) {
    incrementTagScore(tagScores, 'b_p');
  }

  if (/[fv]/.test(token)) {
    incrementTagScore(tagScores, 'f_v');
  }

  if (/^t|^d/.test(token) || /[td][aeiouáéíóúâêôãõ]/.test(token)) {
    incrementTagScore(tagScores, 't_d');
  }

  if (
    /^c[aeiouáéíóúâêôãõ]/.test(token) ||
    /^qu/.test(token) ||
    /^k/.test(token) ||
    /^g[aeiouáéíóúâêôãõ]/.test(token)
  ) {
    incrementTagScore(tagScores, 'k_g');
  }
}

export function detectConfusionTags(
  attempt: AttemptScore,
  sentenceText?: string
): ConfusionTag[] {
  const candidates = getCandidateTokens(attempt, sentenceText);
  if (candidates.length === 0) {
    return [];
  }

  const tagScores = new Map<ConfusionTag, number>();
  candidates.forEach((token) => scoreTokenTagSignals(token, tagScores));

  return [...tagScores.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return TAG_PRIORITY.indexOf(a[0]) - TAG_PRIORITY.indexOf(b[0]);
    })
    .map(([tag]) => tag);
}
