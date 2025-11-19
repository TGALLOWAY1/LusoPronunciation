/**
 * Pronunciation Fixtures Loader
 * 
 * This module loads normalized pronunciation test fixtures from
 * `data/test_data/pronunciation_fixtures.json`.
 * 
 * The fixture file is generated from:
 * - `data/test_data/phrase_ids.csv` (phrase text and difficulty)
 * - `data/test_data/phrase_*_JSON.json` (Azure Speech pronunciation assessment scores)
 * - `data/test_data/Phrase * Audio.wav` (audio files)
 * 
 * This fixture set is intended for:
 * - Development UI/UX work
 * - Unit tests for the pronunciation UI components
 * - Regression checks for parsing Azure Speech API responses
 */

import fixturesJson from '../../data/test_data/pronunciation_fixtures.json';
import type { PronunciationFixtureSet, PronunciationFixture } from '@/types/pronunciationFixtures';

let fixtures: PronunciationFixtureSet;
let fixturesLoaded = false;

try {
  fixtures = fixturesJson as PronunciationFixtureSet;
  if (!fixtures || !fixtures.phrases || !Array.isArray(fixtures.phrases)) {
    throw new Error('Invalid pronunciation fixtures format');
  }
  fixturesLoaded = true;
} catch (error) {
  console.error('Error loading pronunciation fixtures:', error);
  // Provide empty fixtures as fallback
  fixtures = { phrases: [] };
  fixturesLoaded = false;
}

export const PRONUNCIATION_FIXTURES: PronunciationFixture[] = fixtures.phrases;

/**
 * Check if fixtures were loaded successfully.
 */
export function areFixturesLoaded(): boolean {
  return fixturesLoaded;
}

// Convenience helpers:

export function getFixtureById(id: string): PronunciationFixture | undefined {
  return fixtures.phrases.find(p => p.id === id);
}

export function getFixturesByDifficulty(difficulty: number): PronunciationFixture[] {
  return fixtures.phrases.filter(p => p.difficulty === difficulty);
}

