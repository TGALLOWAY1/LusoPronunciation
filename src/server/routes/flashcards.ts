import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { FlashcardModel } from '../models/FlashcardModel';
import { ensureFlashcard, updateFlashcardAfterReview } from '../services/flashcardService';
import type { ReviewOutcome } from '../models/FlashcardModel';

const router = Router();

/**
 * Flashcard DTO for API responses
 */
interface FlashcardDto {
  id: string;
  userId: string;
  contentId: string;
  contentType: 'sentence' | 'word';
  nextDueAt: string; // ISO timestamp
  intervalDays: number;
  easeFactor: number;
  reps: number;
  lapses: number;
  lastScore?: number;
  lastOutcome?: ReviewOutcome;
  historyCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/flashcards/due
 * 
 * Fetches flashcards that are due for review
 * Requires authentication
 * 
 * Query params:
 *   - limit: number (default: 20, max: 100)
 * 
 * Returns: FlashcardDto[]
 */
router.get('/due', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userIdObject = new mongoose.Types.ObjectId(userId);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const now = new Date();

    // Find due flashcards
    const cards = await FlashcardModel.find({
      userId: userIdObject,
      nextDueAt: { $lte: now },
    })
      .sort({ nextDueAt: 1 }) // Oldest due first
      .limit(limit)
      .exec();

    // Map to DTOs
    const dtos: FlashcardDto[] = cards.map((card) => ({
      id: card._id.toString(),
      userId: card.userId.toString(),
      contentId: card.contentId,
      contentType: card.contentType,
      nextDueAt: card.nextDueAt.toISOString(),
      intervalDays: card.intervalDays,
      easeFactor: card.easeFactor,
      reps: card.reps,
      lapses: card.lapses,
      lastScore: card.lastScore,
      lastOutcome: card.lastOutcome,
      historyCount: card.history.length,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
    }));

    res.json(dtos);
  } catch (error) {
    console.error('[Flashcards] Error fetching due cards:', error);
    const errorMessage = 'An unexpected error occurred.';
    res.status(500).json({
      error: 'Failed to fetch due flashcards',
      message: errorMessage,
    });
  }
});

/**
 * POST /api/flashcards/review
 * 
 * Records a flashcard review and updates SRS state
 * Requires authentication
 * 
 * Body: {
 *   cardId: string,
 *   grade: 'again' | 'hard' | 'good' | 'easy',
 *   attemptId?: string, // Optional pronunciation attempt ID to link
 *   score?: number // Optional pronunciation score (0-100)
 * }
 * 
 * Returns: Updated FlashcardDto
 */
router.post('/review', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userIdObject = new mongoose.Types.ObjectId(userId);
    const { cardId, grade, attemptId, score } = req.body;

    // Validate inputs
    if (!cardId || typeof cardId !== 'string') {
      return res.status(400).json({
        error: 'Invalid cardId',
        message: 'cardId must be a string',
      });
    }

    if (!grade || !['again', 'hard', 'good', 'easy'].includes(grade)) {
      return res.status(400).json({
        error: 'Invalid grade',
        message: 'grade must be one of: again, hard, good, easy',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      return res.status(400).json({
        error: 'Invalid cardId',
        message: 'cardId must be a valid ObjectId',
      });
    }

    // Find card (ensuring ownership)
    const card = await FlashcardModel.findOne({
      _id: new mongoose.Types.ObjectId(cardId),
      userId: userIdObject,
    });

    if (!card) {
      return res.status(404).json({
        error: 'Flashcard not found',
        message: 'Flashcard does not exist or you do not have permission to access it',
      });
    }

    // Update card with review
    const attemptIdObject = attemptId && mongoose.Types.ObjectId.isValid(attemptId)
      ? new mongoose.Types.ObjectId(attemptId)
      : undefined;

    const updatedCard = await updateFlashcardAfterReview(
      card,
      grade as ReviewOutcome,
      score,
      attemptIdObject
    );

    // Map to DTO
    const dto: FlashcardDto = {
      id: updatedCard._id.toString(),
      userId: updatedCard.userId.toString(),
      contentId: updatedCard.contentId,
      contentType: updatedCard.contentType,
      nextDueAt: updatedCard.nextDueAt.toISOString(),
      intervalDays: updatedCard.intervalDays,
      easeFactor: updatedCard.easeFactor,
      reps: updatedCard.reps,
      lapses: updatedCard.lapses,
      lastScore: updatedCard.lastScore,
      lastOutcome: updatedCard.lastOutcome,
      historyCount: updatedCard.history.length,
      createdAt: updatedCard.createdAt.toISOString(),
      updatedAt: updatedCard.updatedAt.toISOString(),
    };

    res.json(dto);
  } catch (error) {
    console.error('[Flashcards] Error reviewing card:', error);
    const errorMessage = 'An unexpected error occurred.';
    res.status(500).json({
      error: 'Failed to review flashcard',
      message: errorMessage,
    });
  }
});

/**
 * POST /api/flashcards/ensure
 * 
 * Ensures a flashcard exists for the given content
 * Creates one if it doesn't exist
 * Requires authentication
 * 
 * Body: {
 *   contentId: string,
 *   contentType: 'sentence' | 'word'
 * }
 * 
 * Returns: FlashcardDto
 */
router.post('/ensure', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userIdObject = new mongoose.Types.ObjectId(userId);
    const { contentId, contentType } = req.body;

    // Validate inputs
    if (!contentId || typeof contentId !== 'string') {
      return res.status(400).json({
        error: 'Invalid contentId',
        message: 'contentId must be a string',
      });
    }

    if (!contentType || !['sentence', 'word'].includes(contentType)) {
      return res.status(400).json({
        error: 'Invalid contentType',
        message: 'contentType must be one of: sentence, word',
      });
    }

    // Ensure card exists
    const card = await ensureFlashcard(userIdObject, contentId, contentType);

    // Map to DTO
    const dto: FlashcardDto = {
      id: card._id.toString(),
      userId: card.userId.toString(),
      contentId: card.contentId,
      contentType: card.contentType,
      nextDueAt: card.nextDueAt.toISOString(),
      intervalDays: card.intervalDays,
      easeFactor: card.easeFactor,
      reps: card.reps,
      lapses: card.lapses,
      lastScore: card.lastScore,
      lastOutcome: card.lastOutcome,
      historyCount: card.history.length,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
    };

    res.json(dto);
  } catch (error) {
    console.error('[Flashcards] Error ensuring flashcard:', error);
    const errorMessage = 'An unexpected error occurred.';
    res.status(500).json({
      error: 'Failed to ensure flashcard',
      message: errorMessage,
    });
  }
});

export default router;
