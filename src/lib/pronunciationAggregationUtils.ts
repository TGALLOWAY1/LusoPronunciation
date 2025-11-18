import type { PracticePhraseFromFixture } from './pronunciationFixtureAdapter';

/**
 * Aggregated data for a difficulty level.
 */
export interface DifficultyAverage {
  difficulty: number;
  averageScore: number;
  count: number;
}

/**
 * Groups phrases by difficulty and computes the average overall score for each difficulty level.
 * 
 * @param phrases - Array of practice phrases from fixtures
 * @returns Array of difficulty averages, sorted by difficulty level (ascending)
 */
export function aggregateScoresByDifficulty(
  phrases: PracticePhraseFromFixture[]
): DifficultyAverage[] {
  // Group phrases by difficulty
  const difficultyGroups = new Map<number, PracticePhraseFromFixture[]>();
  
  for (const phrase of phrases) {
    const difficulty = phrase.difficulty;
    if (!difficultyGroups.has(difficulty)) {
      difficultyGroups.set(difficulty, []);
    }
    difficultyGroups.get(difficulty)!.push(phrase);
  }
  
  // Compute averages for each difficulty level
  const averages: DifficultyAverage[] = [];
  
  for (const [difficulty, groupPhrases] of difficultyGroups.entries()) {
    const totalScore = groupPhrases.reduce(
      (sum, phrase) => sum + phrase.attempt.overallAccuracy,
      0
    );
    const averageScore = totalScore / groupPhrases.length;
    
    averages.push({
      difficulty,
      averageScore: Math.round(averageScore * 10) / 10, // Round to 1 decimal
      count: groupPhrases.length,
    });
  }
  
  // Sort by difficulty (ascending)
  return averages.sort((a, b) => a.difficulty - b.difficulty);
}

