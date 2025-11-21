/**
 * Assessment fixture generator for the content generation pipeline.
 * 
 * This is an optional step in the pipeline and is primarily for generating
 * test/regression data. It samples sentences from master datasets, assesses
 * their audio files using Azure Pronunciation Assessment, and generates
 * fixture files compatible with the existing pronunciation fixture format.
 * 
 * The generated fixtures can be used for:
 * - Testing pronunciation assessment UI components
 * - Regression testing of assessment mapping logic
 * - Providing example data for development
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { MasterSentence } from '../types/contentGeneration';
import { PronunciationFixture, PronunciationFixtureSet } from '../types/pronunciationFixtures';
import type { AttemptScore } from '../types/pronunciation';
import { assessAudio } from './azurePronunciationClient';

export interface GenerateFixturesOptions {
  count: number; // number of sentences to sample
  gender: 'male' | 'female';
}

/**
 * Samples sentences from the array, attempting to spread across difficulty levels.
 * 
 * @param sentences - Array of sentences to sample from
 * @param count - Number of sentences to sample
 * @returns Sampled sentences
 */
function sampleSentences(
  sentences: MasterSentence[],
  count: number
): MasterSentence[] {
  if (sentences.length <= count) {
    return sentences;
  }

  // Group by difficulty
  const byDifficulty = new Map<string, MasterSentence[]>();
  for (const sentence of sentences) {
    const diff = sentence.difficulty;
    if (!byDifficulty.has(diff)) {
      byDifficulty.set(diff, []);
    }
    byDifficulty.get(diff)!.push(sentence);
  }

  // Sample evenly across difficulties
  const sampled: MasterSentence[] = [];
  const difficulties = Array.from(byDifficulty.keys());
  const perDifficulty = Math.ceil(count / difficulties.length);

  for (const diff of difficulties) {
    const candidates = byDifficulty.get(diff)!;
    const toTake = Math.min(perDifficulty, candidates.length);
    const selected = candidates.slice(0, toTake);
    sampled.push(...selected);
    if (sampled.length >= count) {
      break;
    }
  }

  // If we still need more, fill from remaining
  if (sampled.length < count) {
    const remaining = sentences.filter(s => !sampled.includes(s));
    const needed = count - sampled.length;
    sampled.push(...remaining.slice(0, needed));
  }

  return sampled.slice(0, count);
}

/**
 * Converts an AttemptScore to a PronunciationFixture.
 * 
 * Uses the same transformation logic as src/lib/pronunciationFixtureAdapter.ts
 * to ensure consistency with existing fixtures.
 * 
 * @param attemptScore - The assessment result
 * @param sentence - The master sentence
 * @param gender - The voice gender used
 * @returns PronunciationFixture object
 */
function attemptScoreToFixture(
  attemptScore: AttemptScore,
  sentence: MasterSentence,
  gender: 'male' | 'female'
): PronunciationFixture {
  // Build audio file path (relative to project root)
  const audioFile = `public/audio/ptbr/${gender}/${sentence.id}.wav`;

  // Build Azure JSON file path (we'll save the raw Azure response separately)
  // For now, we'll use a placeholder path - in a full implementation, you might
  // want to save the raw Azure JSON response to a file
  const azureJsonFile = `data/test_data/generated/${sentence.id}_${gender}_azure.json`;

  return {
    id: `${sentence.id}_${gender}`,
    phraseNumber: 0, // Not applicable for generated fixtures
    text: sentence.text,
    difficulty: mapDifficultyToNumber(sentence.difficulty),
    audioFile,
    azureJsonFile,
    scores: {
      overall: attemptScore.overallAccuracy,
      accuracy: attemptScore.overallAccuracy,
      fluency: attemptScore.fluency,
      completeness: attemptScore.completeness,
      prosody: attemptScore.prosody,
    },
  };
}

/**
 * Maps difficulty string (A1-C1) to numeric difficulty (1-5).
 */
function mapDifficultyToNumber(difficulty: string): number {
  switch (difficulty) {
    case 'A1':
      return 1;
    case 'A2':
      return 2;
    case 'B1':
      return 3;
    case 'B2':
      return 4;
    case 'C1':
      return 5;
    default:
      return 3; // Default to B1
  }
}

/**
 * Generates pronunciation assessment fixtures from master sentences.
 * 
 * Samples sentences, assesses their audio files using Azure, and generates
 * fixture files compatible with the existing pronunciation fixture format.
 * 
 * @param sentences - Array of MasterSentence entries
 * @param options - Generation options (count, gender)
 */
export async function generateAssessmentFixtures(
  sentences: MasterSentence[],
  options: GenerateFixturesOptions
): Promise<void> {
  console.log(`Generating assessment fixtures: ${options.count} sentences, gender: ${options.gender}`);

  // Sample sentences
  const sampled = sampleSentences(sentences, options.count);
  console.log(`Sampled ${sampled.length} sentences`);

  const fixtures: PronunciationFixture[] = [];
  const errors: Array<{ sentence: MasterSentence; error: string }> = [];

  // Process each sentence
  for (let i = 0; i < sampled.length; i++) {
    const sentence = sampled[i];
    const wavPath = path.join(
      process.cwd(),
      'public',
      'audio',
      'ptbr',
      options.gender,
      `${sentence.id}.wav`
    );

    console.log(`[${i + 1}/${sampled.length}] Processing: ${sentence.id}`);

    try {
      // Check if WAV file exists
      try {
        await fs.access(wavPath);
      } catch {
        const error = `WAV file not found: ${wavPath}`;
        console.error(`  ✗ ${error}`);
        errors.push({ sentence, error });
        continue;
      }

      // Assess audio
      const attemptScore = await assessAudio(wavPath, sentence.text);

      // Convert to fixture
      const fixture = attemptScoreToFixture(attemptScore, sentence, options.gender);
      fixtures.push(fixture);

      console.log(`  ✔ Generated fixture: ${fixture.id} (overall: ${fixture.scores.overall})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ Assessment failed: ${errorMessage}`);
      errors.push({ sentence, error: errorMessage });
      // Continue processing other sentences
    }
  }

  // Write fixtures to file
  const outputDir = path.join(process.cwd(), 'data', 'test_data');
  await fs.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, 'pronunciation_fixtures_generated.json');
  const fixtureSet: PronunciationFixtureSet = {
    phrases: fixtures,
  };

  await fs.writeFile(
    outputPath,
    JSON.stringify(fixtureSet, null, 2),
    'utf-8'
  );

  console.log(`\n✅ Generated ${fixtures.length} fixtures`);
  console.log(`   Written to: ${outputPath}`);

  if (errors.length > 0) {
    console.log(`\n⚠️  ${errors.length} sentences failed:`);
    for (const { sentence, error } of errors) {
      console.log(`   - ${sentence.id}: ${error}`);
    }
  }
}

