import mongoose from 'mongoose';
import { FlashcardModel, type IFlashcardDocument, type ReviewOutcome } from '../models/FlashcardModel';

/**
 * Default SRS parameters for new flashcards
 */
const DEFAULT_EASE_FACTOR = 2.5;
const DEFAULT_INTERVAL_DAYS = 1;

/**
 * SM-2 algorithm parameters
 */
const SM2_PARAMS = {
  again: { easeChange: -0.2, intervalMultiplier: 0.25 },
  hard: { easeChange: -0.15, intervalMultiplier: 0.5 },
  good: { easeChange: 0, intervalMultiplier: 1.0 },
  easy: { easeChange: 0.15, intervalMultiplier: 1.3 },
};

/**
 * Ensures a flashcard exists for the given user and content
 * Creates one with default SRS parameters if it doesn't exist
 * 
 * @returns The flashcard document (existing or newly created)
 */
export async function ensureFlashcard(
  userId: mongoose.Types.ObjectId,
  contentId: string,
  contentType: 'sentence' | 'word'
): Promise<IFlashcardDocument> {
  // Try to find existing card
  let card = await FlashcardModel.findOne({
    userId,
    contentId,
    contentType,
  });

  if (!card) {
    // Create new card with default SRS parameters
    card = new FlashcardModel({
      userId,
      contentId,
      contentType,
      nextDueAt: new Date(), // Due immediately
      intervalDays: DEFAULT_INTERVAL_DAYS,
      easeFactor: DEFAULT_EASE_FACTOR,
      reps: 0,
      lapses: 0,
      history: [],
    });

    await card.save();
    console.log(`[FlashcardService] Created new flashcard: ${contentType}:${contentId} for user ${userId}`);
  }

  return card;
}

/**
 * Updates flashcard SRS state based on review outcome
 * Uses a simplified SM-2 algorithm
 * 
 * @param card - The flashcard document to update
 * @param outcome - The review outcome
 * @param score - Optional pronunciation score (0-100)
 * @param attemptId - Optional pronunciation attempt ID to link
 */
export async function updateFlashcardAfterReview(
  card: IFlashcardDocument,
  outcome: ReviewOutcome,
  score?: number,
  attemptId?: mongoose.Types.ObjectId
): Promise<IFlashcardDocument> {
  const params = SM2_PARAMS[outcome];
  const now = new Date();

  // Update ease factor
  let newEaseFactor = card.easeFactor + params.easeChange;
  newEaseFactor = Math.max(1.3, newEaseFactor); // Minimum ease factor is 1.3

  // Update interval based on outcome
  let newIntervalDays: number;
  if (outcome === 'again') {
    // Failed - reset interval
    newIntervalDays = 1;
    card.lapses += 1;
  } else if (outcome === 'hard') {
    // Hard - reduce interval
    newIntervalDays = Math.max(1, Math.floor(card.intervalDays * params.intervalMultiplier));
    card.reps += 1;
  } else {
    // Good or Easy - increase interval
    if (card.reps === 0) {
      // First review
      newIntervalDays = 1;
    } else if (card.reps === 1) {
      // Second review
      newIntervalDays = 6;
    } else {
      // Subsequent reviews
      newIntervalDays = Math.floor(card.intervalDays * newEaseFactor * params.intervalMultiplier);
    }
    card.reps += 1;
  }

  // Calculate next due date
  const nextDueAt = new Date(now.getTime() + newIntervalDays * 24 * 60 * 60 * 1000);

  // Update card
  card.intervalDays = newIntervalDays;
  card.easeFactor = newEaseFactor;
  card.nextDueAt = nextDueAt;
  card.lastOutcome = outcome;
  if (score !== undefined) {
    card.lastScore = score;
  }
  if (attemptId) {
    card.history.push(attemptId);
  }

  await card.save();

  console.log(`[FlashcardService] Updated flashcard ${card._id}: outcome=${outcome}, interval=${newIntervalDays} days, ease=${newEaseFactor.toFixed(2)}`);

  return card;
}

/**
 * Auto-grades a pronunciation score into a review outcome
 * Maps score ranges to SRS outcomes
 * 
 * @param score - Pronunciation score (0-100)
 * @returns Review outcome
 */
export function scoreToOutcome(score: number): ReviewOutcome {
  if (score < 50) {
    return 'again'; // Poor - needs immediate review
  } else if (score < 70) {
    return 'hard'; // Below threshold - harder
  } else if (score < 90) {
    return 'good'; // Good performance
  } else {
    return 'easy'; // Excellent - can wait longer
  }
}

