import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { PracticeSessionModel } from '../models/PracticeSessionModel';
import { PronunciationAttemptModel } from '../models/PronunciationAttemptModel';
import {
  mapPracticeSessionDocToDto,
  mapPronunciationAttemptDocToDto,
  mapPronunciationAttemptDocsToDtos,
} from '../mappers/practiceMapper';
import type {
  PracticeSessionMode,
} from '../../shared/types';

const router = Router();

/**
 * POST /api/practice-sessions
 * 
 * Creates a new practice session
 * Requires authentication
 * 
 * Body: { mode: 'sentences' | 'words' | 'mixed' }
 * Returns: PracticeSession DTO
 */
router.post('/practice-sessions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mode } = req.body;
    const userId = req.user!.id;

    // Validate mode
    if (!mode || !['sentences', 'words', 'mixed'].includes(mode)) {
      return res.status(400).json({
        error: 'Invalid mode',
        message: 'Mode must be one of: sentences, words, mixed',
      });
    }

    // Create session
    const sessionDoc = new PracticeSessionModel({
      userId: new mongoose.Types.ObjectId(userId),
      mode: mode as PracticeSessionMode,
      startedAt: new Date(),
    });

    await sessionDoc.save();

    const session = mapPracticeSessionDocToDto(sessionDoc);
    res.status(201).json(session);
  } catch (error) {
    console.error('[Practice] Error creating session:', error instanceof Error ? error.message : error);
    res.status(500).json({
      error: 'Failed to create practice session',
      message: 'An unexpected error occurred.',
    });
  }
});

/**
 * PATCH /api/practice-sessions/:id/complete
 * 
 * Completes a practice session by setting endedAt
 * Requires authentication
 * 
 * Returns: Updated PracticeSession DTO
 */
router.patch(
  '/practice-sessions/:id/complete',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Validate session ID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          error: 'Invalid session ID',
        });
      }

      // Find and update session (ensuring ownership)
      const sessionDoc = await PracticeSessionModel.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(id),
          userId: new mongoose.Types.ObjectId(userId),
        },
        {
          endedAt: new Date(),
        },
        {
          new: true,
        }
      );

      if (!sessionDoc) {
        return res.status(404).json({
          error: 'Session not found',
          message: 'Session does not exist or you do not have permission to access it',
        });
      }

      const session = mapPracticeSessionDocToDto(sessionDoc);
      res.json(session);
    } catch (error) {
      console.error('[Practice] Error completing session:', error instanceof Error ? error.message : error);
      res.status(500).json({
        error: 'Failed to complete practice session',
        message: 'An unexpected error occurred.',
      });
    }
  }
);

/**
 * POST /api/pronunciation-attempts
 * 
 * Creates a new pronunciation attempt
 * Requires authentication
 * 
 * Body: {
 *   sessionId?: string,
 *   content: { contentId, contentType, textPt, textEn? },
 *   engine: 'mock' | 'azure_speech',
 *   scores: { overall, accuracy, fluency?, completeness?, prosody? },
 *   wordScores?: [...],
 *   rawAssessment?: any,
 *   ...other optional fields
 * }
 * Returns: PronunciationAttempt DTO
 */
router.post('/pronunciation-attempts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      sessionId,
      content,
      engine,
      scores,
      wordScores,
      rawAssessment,
      recordingUrl,
      recordingDataUrl,
      recordingDurationSeconds,
      latencyMs,
      passed,
      targetOverallThreshold,
      targetAccuracyThreshold,
      retriesInThisSession,
      usedHint,
      slowedAudioPlayback,
      listenedToNativeModelCount,
      confidenceLabel,
      practiceDirection,
      practiceMode,
      isCorrect,
      selfRating,
    } = req.body;

    // Validate required fields
    if (!content || !content.contentId || !content.contentType) {
      return res.status(400).json({
        error: 'Invalid content',
        message: 'Content must include contentId and contentType',
      });
    }

    // textPt is required but can be a placeholder during migration
    if (!content.textPt || typeof content.textPt !== 'string') {
      return res.status(400).json({
        error: 'Invalid content',
        message: 'Content must include textPt (string)',
      });
    }

    if (!engine || !['mock', 'azure_speech'].includes(engine)) {
      return res.status(400).json({
        error: 'Invalid engine',
        message: 'Engine must be one of: mock, azure_speech',
      });
    }

    if (!scores || typeof scores.overall !== 'number' || typeof scores.accuracy !== 'number') {
      return res.status(400).json({
        error: 'Invalid scores',
        message: 'Scores must include overall and accuracy (0-100)',
      });
    }

    // Validate sessionId if provided (ensure it belongs to user)
    let sessionObjectId: mongoose.Types.ObjectId | undefined;
    if (sessionId) {
      if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        return res.status(400).json({
          error: 'Invalid session ID',
        });
      }

      // Verify session belongs to user
      const sessionDoc = await PracticeSessionModel.findOne({
        _id: new mongoose.Types.ObjectId(sessionId),
        userId: new mongoose.Types.ObjectId(userId),
      });

      if (!sessionDoc) {
        return res.status(404).json({
          error: 'Session not found',
          message: 'Session does not exist or you do not have permission to access it',
        });
      }

      sessionObjectId = sessionDoc._id;
    }

    // Create attempt
    const attemptDoc = new PronunciationAttemptModel({
      userId: new mongoose.Types.ObjectId(userId),
      sessionId: sessionObjectId,
      contentId: content.contentId,
      contentType: content.contentType,
      textPt: content.textPt,
      textEn: content.textEn,
      engine,
      scores: {
        overall: scores.overall,
        accuracy: scores.accuracy,
        fluency: scores.fluency,
        completeness: scores.completeness,
        prosody: scores.prosody,
      },
      wordScores,
      rawAssessment,
      recordingUrl,
      recordingDataUrl,
      recordingDurationSeconds,
      latencyMs,
      passed,
      targetOverallThreshold,
      targetAccuracyThreshold,
      retriesInThisSession,
      usedHint,
      slowedAudioPlayback,
      listenedToNativeModelCount,
      confidenceLabel,
      practiceDirection,
      practiceMode,
      isCorrect,
      selfRating,
    });

    await attemptDoc.save();

    const attempt = mapPronunciationAttemptDocToDto(attemptDoc);
    res.status(201).json(attempt);
  } catch (error) {
    console.error('[Practice] Error creating attempt:', error instanceof Error ? error.message : error);
    res.status(500).json({
      error: 'Failed to create pronunciation attempt',
      message: 'An unexpected error occurred.',
    });
  }
});

/**
 * GET /api/pronunciation-attempts
 * 
 * Fetches pronunciation attempts for the current user
 * Requires authentication
 * 
 * Query params:
 *   - limit: number (default: 50)
 *   - offset: number (default: 0)
 *   - contentId: string (optional, filter by content)
 * 
 * Returns: { attempts: PronunciationAttempt[], total: number }
 */
router.get('/pronunciation-attempts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100
    const offset = parseInt(req.query.offset as string) || 0;
    const contentId = req.query.contentId as string | undefined;

    // Build query (always filter by userId for security)
    const query: any = {
      userId: new mongoose.Types.ObjectId(userId),
    };

    if (contentId) {
      if (typeof contentId !== 'string' || contentId.length > 128) {
        return res.status(400).json({ error: 'Invalid contentId' });
      }
      query.contentId = contentId;
    }

    // Fetch attempts
    const [attemptDocs, total] = await Promise.all([
      PronunciationAttemptModel.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .exec(),
      PronunciationAttemptModel.countDocuments(query),
    ]);

    const attempts = mapPronunciationAttemptDocsToDtos(attemptDocs);

    res.json({
      attempts,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Practice] Error fetching attempts:', error instanceof Error ? error.message : error);
    res.status(500).json({
      error: 'Failed to fetch pronunciation attempts',
      message: 'An unexpected error occurred.',
    });
  }
});

export default router;
