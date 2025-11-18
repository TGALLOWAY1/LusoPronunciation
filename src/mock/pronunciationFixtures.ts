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

const fixtures = fixturesJson as PronunciationFixtureSet;

export const PRONUNCIATION_FIXTURES: PronunciationFixture[] = fixtures.phrases;

// Convenience helpers:

export function getFixtureById(id: string): PronunciationFixture | undefined {
  return fixtures.phrases.find(p => p.id === id);
}

export function getFixturesByDifficulty(difficulty: number): PronunciationFixture[] {
  return fixtures.phrases.filter(p => p.difficulty === difficulty);
}

