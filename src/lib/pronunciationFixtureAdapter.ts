/**
 * Pronunciation Fixture Adapter
 * 
 * Converts PronunciationFixture data into practice-ready format for UI components.
 * This adapter provides a convenient bridge between test fixtures and the practice UI.
 */

import { PRONUNCIATION_FIXTURES, getFixtureById, getFixturesByDifficulty } from '@/mock/pronunciationFixtures';
import type { PronunciationFixture, WordFeedback } from '@/types/pronunciationFixtures';
import type { AttemptScore } from '@/types/pronunciation';

/**
 * Practice-ready phrase data derived from a pronunciation fixture.
 * This format is optimized for use in practice UI components.
 */
export type PracticePhraseFromFixture = {
  id: string;              // e.g. "phrase_1"
  text: string;            // Portuguese phrase text
  difficulty: number;
  audioUrl: string;        // URL to use in <audio src=...>
  attempt: AttemptScore;   // single "fixture attempt" containing overall scores
  words?: WordFeedback[];  // word-level feedback for UI display
};

/**
 * Maps a numeric score to a word feedback level.
 * 
 * @param score - The score (0-100)
 * @returns The corresponding level
 */
function mapScoreToLevel(score: number): WordFeedback['level'] {
  if (score >= 90) return 'excellent';
  if (score >= 80) return 'good';
  if (score >= 70) return 'ok';
  return 'practice';
}

/**
 * Generates synthetic word-level feedback from phrase text and overall score.
 * This is a fallback when real per-word data is not available.
 * 
 * @param text - The phrase text
 * @param overallScore - The overall pronunciation score
 * @returns Array of word feedback objects
 */
function generateSyntheticWordFeedback(text: string, overallScore: number): WordFeedback[] {
  // Split text into words, removing punctuation
  const words = text.split(/\s+/).map(w => w.replace(/[.,!?;:]/g, '')).filter(w => w.length > 0);
  
  return words.map((word, index) => {
    // Generate score around overall score with small random jitter (±10 points)
    const jitter = (Math.random() - 0.5) * 20;
    const wordScore = Math.max(0, Math.min(100, overallScore + jitter));
    const level = mapScoreToLevel(wordScore);
    
    // Occasionally add error types for lower scores
    let errorType: string | undefined;
    if (wordScore < 70 && Math.random() < 0.3) {
      const errorTypes = ['mispronounced', 'omitted', 'extra'];
      errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
    }
    
    return {
      index,
      text: word,
      score: Math.round(wordScore),
      level,
      errorType,
    };
  });
}

/**
 * Converts a PronunciationFixture to a PracticePhraseFromFixture.
 * 
 * @param fixture - The pronunciation fixture to convert
 * @returns A practice-ready phrase object
 */
export function fixtureToPracticePhrase(fixture: PronunciationFixture): PracticePhraseFromFixture {
  // Build audioUrl by ensuring it's a browser-usable path
  let audioUrl = fixture.audioFile;
  if (audioUrl.startsWith('data/')) {
    audioUrl = '/' + audioUrl;
  }

  // Create AttemptScore object from fixture scores
  const attempt: AttemptScore = {
    attemptId: fixture.id + '_fixture',
    sentenceId: fixture.id,
    overallAccuracy: fixture.scores.overall,
    fluency: fixture.scores.fluency ?? 0,
    completeness: fixture.scores.completeness ?? 0,
    prosody: fixture.scores.prosody ?? undefined,
    wordScores: [], // for now, leave empty; we're using fixtures mainly for overall UI
    createdAt: new Date().toISOString(),
    audioUrl,
  };

  // Generate word-level feedback (synthetic for now)
  const words = generateSyntheticWordFeedback(fixture.text, fixture.scores.overall);

  return {
    id: fixture.id,
    text: fixture.text,
    difficulty: fixture.difficulty,
    audioUrl,
    attempt,
    words,
  };
}

/**
 * Gets all practice phrases from fixtures.
 * 
 * @returns Array of all practice phrases converted from fixtures
 */
export function getAllPracticePhrasesFromFixtures(): PracticePhraseFromFixture[] {
  return PRONUNCIATION_FIXTURES.map(fixtureToPracticePhrase);
}

/**
 * Gets practice phrases filtered by difficulty level.
 * 
 * @param difficulty - The difficulty level to filter by
 * @returns Array of practice phrases with the specified difficulty
 */
export function getPracticePhrasesByDifficulty(difficulty: number): PracticePhraseFromFixture[] {
  return getFixturesByDifficulty(difficulty).map(fixtureToPracticePhrase);
}

/**
 * Gets a practice phrase by its ID.
 * 
 * @param id - The phrase ID (e.g. "phrase_1")
 * @returns The practice phrase if found, undefined otherwise
 */
export function getPracticePhraseById(id: string): PracticePhraseFromFixture | undefined {
  const fixture = getFixtureById(id);
  return fixture ? fixtureToPracticePhrase(fixture) : undefined;
}

