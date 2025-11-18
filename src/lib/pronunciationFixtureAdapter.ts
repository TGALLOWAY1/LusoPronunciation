/**
 * Pronunciation Fixture Adapter
 * 
 * Converts PronunciationFixture data into practice-ready format for UI components.
 * This adapter provides a convenient bridge between test fixtures and the practice UI.
 */

import { PRONUNCIATION_FIXTURES, getFixtureById, getFixturesByDifficulty } from '@/mock/pronunciationFixtures';
import type { PronunciationFixture } from '@/types/pronunciationFixtures';
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
};

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

  return {
    id: fixture.id,
    text: fixture.text,
    difficulty: fixture.difficulty,
    audioUrl,
    attempt,
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

