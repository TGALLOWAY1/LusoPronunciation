import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { PracticeSessionModel } from '../models/PracticeSessionModel';
import { PronunciationAttemptModel } from '../models/PronunciationAttemptModel';
import type {
  PracticeSession as LegacyPracticeSession,
  SentencePracticeAttempt,
  WordPracticeAttempt,
} from '../../lib/types';

const router = Router();

/**
 * Legacy data payload for migration
 */
interface MigrationPayload {
  sessions: LegacyPracticeSession[];
  sentenceAttempts: SentencePracticeAttempt[];
  wordAttempts: WordPracticeAttempt[];
  progress?: any; // Progress data (optional, may be used in future)
}

/**
 * Migration result summary
 */
interface MigrationResult {
  importedSessions: number;
  importedAttempts: number;
  skippedSessions: number;
  skippedAttempts: number;
  errors: string[];
}

/**
 * Check if a session already exists (idempotency check)
 */
async function sessionExists(
  userId: mongoose.Types.ObjectId,
  startedAt: Date,
  mode: string
): Promise<boolean> {
  // Check if a session exists with the same userId, startedAt (within 1 second), and mode
  const startWindow = new Date(startedAt.getTime() - 1000);
  const endWindow = new Date(startedAt.getTime() + 1000);

  const existing = await PracticeSessionModel.findOne({
    userId,
    mode,
    startedAt: {
      $gte: startWindow,
      $lte: endWindow,
    },
  });

  return !!existing;
}

/**
 * Check if an attempt already exists (idempotency check)
 */
async function attemptExists(
  userId: mongoose.Types.ObjectId,
  contentId: string,
  contentType: 'sentence' | 'word',
  createdAt: Date
): Promise<boolean> {
  // Check if an attempt exists with the same userId, contentId, contentType, and createdAt (within 5 seconds)
  const startWindow = new Date(createdAt.getTime() - 5000);
  const endWindow = new Date(createdAt.getTime() + 5000);

  const existing = await PronunciationAttemptModel.findOne({
    userId,
    contentId,
    contentType,
    createdAt: {
      $gte: startWindow,
      $lte: endWindow,
    },
  });

  return !!existing;
}

/**
 * Convert legacy session to Mongo document format
 */
function convertLegacySession(
  legacySession: LegacyPracticeSession,
  userId: mongoose.Types.ObjectId
) {
  return {
    userId,
    mode: legacySession.mode === 'assessment' ? 'mixed' : legacySession.mode, // Map 'assessment' to 'mixed'
    startedAt: new Date(legacySession.startedAt),
    endedAt: legacySession.endedAt && legacySession.endedAt.trim() !== ''
      ? new Date(legacySession.endedAt)
      : undefined,
    device: legacySession.device,
    appVersion: legacySession.appVersion,
    totalAttempts: legacySession.totalAttempts,
    sentenceAttempts: legacySession.sentenceAttempts,
    wordAttempts: legacySession.wordAttempts,
    avgOverallScore: legacySession.avgOverallScore,
    avgFluencyScore: legacySession.avgFluencyScore,
    avgAccuracyScore: legacySession.avgAccuracyScore,
    avgCompletenessScore: legacySession.avgCompletenessScore,
    avgProsodyScore: legacySession.avgProsodyScore,
    dailyStreakAfterSession: legacySession.dailyStreakAfterSession,
  };
}

/**
 * Convert legacy sentence attempt to Mongo document format
 */
function convertLegacySentenceAttempt(
  legacyAttempt: SentencePracticeAttempt,
  userId: mongoose.Types.ObjectId,
  sessionIdMap: Map<string, mongoose.Types.ObjectId>
) {
  const sessionId = sessionIdMap.get(legacyAttempt.sessionId);

  return {
    userId,
    sessionId,
    contentId: legacyAttempt.sentenceId,
    contentType: 'sentence' as const,
    textPt: legacyAttempt.sentenceId, // Placeholder - will need to be enriched later
    textEn: undefined,
    engine: 'azure_speech' as const,
    scores: {
      overall: legacyAttempt.overallScore,
      accuracy: legacyAttempt.accuracyScore,
      fluency: legacyAttempt.fluencyScore,
      completeness: legacyAttempt.completenessScore,
      prosody: legacyAttempt.prosodyScore,
    },
    wordScores: legacyAttempt.wordScores?.map((ws) => ({
      wordId: ws.wordId,
      token: ws.token,
      overallScore: ws.overallScore,
      accuracyScore: ws.accuracyScore,
      fluencyScore: ws.fluencyScore,
      errorType: undefined, // Not available in legacy data
      phonemeScores: ws.phonemeScores?.map((ps) => ({
        phonemeId: ps.phonemeId,
        overallScore: ps.overallScore,
      })),
    })),
    rawAssessment: undefined, // Not stored in legacy localStorage
    recordingUrl: legacyAttempt.recordingUrl,
    recordingDataUrl: legacyAttempt.recordingDataUrl,
    recordingDurationSeconds: legacyAttempt.recordingDurationSeconds,
    latencyMs: legacyAttempt.latencyMs,
    passed: legacyAttempt.passed,
    targetOverallThreshold: legacyAttempt.targetOverallThreshold,
    targetAccuracyThreshold: legacyAttempt.targetAccuracyThreshold,
    retriesInThisSession: legacyAttempt.retriesInThisSession,
    usedHint: legacyAttempt.usedHint,
    slowedAudioPlayback: legacyAttempt.slowedAudioPlayback,
    listenedToNativeModelCount: legacyAttempt.listenedToNativeModelCount,
    confidenceLabel: legacyAttempt.confidenceLabel,
    practiceDirection: undefined,
    practiceMode: 'pronunciation' as const,
    isCorrect: undefined,
    selfRating: undefined,
    createdAt: new Date(legacyAttempt.createdAt),
  };
}

/**
 * Convert legacy word attempt to Mongo document format
 */
function convertLegacyWordAttempt(
  legacyAttempt: WordPracticeAttempt,
  userId: mongoose.Types.ObjectId,
  sessionIdMap: Map<string, mongoose.Types.ObjectId>
) {
  const sessionId = sessionIdMap.get(legacyAttempt.sessionId);

  return {
    userId,
    sessionId,
    contentId: legacyAttempt.wordId,
    contentType: 'word' as const,
    textPt: legacyAttempt.wordId, // Placeholder - will need to be enriched later
    textEn: undefined,
    engine: 'azure_speech' as const,
    scores: {
      overall: legacyAttempt.overallScore,
      accuracy: legacyAttempt.accuracyScore,
      fluency: legacyAttempt.fluencyScore,
      completeness: legacyAttempt.completenessScore,
      prosody: legacyAttempt.prosodyScore,
    },
    wordScores: undefined, // Word attempts don't have word-level scores
    rawAssessment: undefined, // Not stored in legacy localStorage
    recordingUrl: undefined,
    recordingDataUrl: undefined,
    recordingDurationSeconds: legacyAttempt.recordingDurationSeconds,
    latencyMs: legacyAttempt.latencyMs,
    passed: legacyAttempt.passed,
    targetOverallThreshold: legacyAttempt.targetOverallThreshold,
    targetAccuracyThreshold: undefined,
    retriesInThisSession: legacyAttempt.retriesInThisSession,
    usedHint: legacyAttempt.usedHint,
    slowedAudioPlayback: legacyAttempt.slowedAudioPlayback,
    listenedToNativeModelCount: legacyAttempt.listenedToNativeModelCount,
    confidenceLabel: undefined,
    practiceDirection: legacyAttempt.practiceDirection,
    practiceMode: legacyAttempt.practiceMode || 'pronunciation',
    isCorrect: legacyAttempt.isCorrect,
    selfRating: legacyAttempt.selfRating,
    createdAt: new Date(legacyAttempt.createdAt),
  };
}

/**
 * POST /api/migrate/local-storage
 * 
 * Migrates localStorage practice data to MongoDB
 * Requires authentication
 * 
 * Body: {
 *   sessions: LegacyPracticeSession[],
 *   sentenceAttempts: SentencePracticeAttempt[],
 *   wordAttempts: WordPracticeAttempt[],
 *   progress?: any
 * }
 * 
 * Returns: { importedSessions, importedAttempts, skippedSessions, skippedAttempts, errors }
 */
router.post('/local-storage', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userIdObject = new mongoose.Types.ObjectId(userId);
    const payload: MigrationPayload = req.body;

    const result: MigrationResult = {
      importedSessions: 0,
      importedAttempts: 0,
      skippedSessions: 0,
      skippedAttempts: 0,
      errors: [],
    };

    // Validate payload
    if (!payload.sessions || !Array.isArray(payload.sessions)) {
      return res.status(400).json({
        error: 'Invalid payload',
        message: 'sessions must be an array',
      });
    }

    if (!payload.sentenceAttempts || !Array.isArray(payload.sentenceAttempts)) {
      return res.status(400).json({
        error: 'Invalid payload',
        message: 'sentenceAttempts must be an array',
      });
    }

    if (!payload.wordAttempts || !Array.isArray(payload.wordAttempts)) {
      return res.status(400).json({
        error: 'Invalid payload',
        message: 'wordAttempts must be an array',
      });
    }

    console.log(`[Migration] Starting migration for user ${userId}: ${payload.sessions.length} sessions, ${payload.sentenceAttempts.length} sentence attempts, ${payload.wordAttempts.length} word attempts`);

    // Step 1: Import sessions and build sessionId mapping
    const sessionIdMap = new Map<string, mongoose.Types.ObjectId>();

    for (const legacySession of payload.sessions) {
      try {
        const startedAt = new Date(legacySession.startedAt);

        // Check if session already exists (idempotency)
        const exists = await sessionExists(userIdObject, startedAt, legacySession.mode);
        if (exists) {
          result.skippedSessions++;
          console.log(`[Migration] Skipping duplicate session: ${legacySession.sessionId}`);
          continue;
        }

        // Convert and create session
        const sessionData = convertLegacySession(legacySession, userIdObject);
        const sessionDoc = new PracticeSessionModel(sessionData);
        await sessionDoc.save();

        // Map legacy sessionId to new Mongo _id
        sessionIdMap.set(legacySession.sessionId, sessionDoc._id);
        result.importedSessions++;

        console.log(`[Migration] Imported session: ${legacySession.sessionId} -> ${sessionDoc._id}`);
      } catch (error) {
        const errorMsg = `Failed to import session ${legacySession.sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        console.error(`[Migration] ${errorMsg}`, error);
      }
    }

    // Step 2: Import sentence attempts
    for (const legacyAttempt of payload.sentenceAttempts) {
      try {
        const createdAt = new Date(legacyAttempt.createdAt);

        // Check if attempt already exists (idempotency)
        const exists = await attemptExists(
          userIdObject,
          legacyAttempt.sentenceId,
          'sentence',
          createdAt
        );
        if (exists) {
          result.skippedAttempts++;
          continue;
        }

        // Convert and create attempt
        const attemptData = convertLegacySentenceAttempt(
          legacyAttempt,
          userIdObject,
          sessionIdMap
        );
        const attemptDoc = new PronunciationAttemptModel(attemptData);
        await attemptDoc.save();

        result.importedAttempts++;
      } catch (error) {
        const errorMsg = `Failed to import sentence attempt ${legacyAttempt.attemptId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        console.error(`[Migration] ${errorMsg}`, error);
      }
    }

    // Step 3: Import word attempts
    for (const legacyAttempt of payload.wordAttempts) {
      try {
        const createdAt = new Date(legacyAttempt.createdAt);

        // Check if attempt already exists (idempotency)
        const exists = await attemptExists(
          userIdObject,
          legacyAttempt.wordId,
          'word',
          createdAt
        );
        if (exists) {
          result.skippedAttempts++;
          continue;
        }

        // Convert and create attempt
        const attemptData = convertLegacyWordAttempt(
          legacyAttempt,
          userIdObject,
          sessionIdMap
        );
        const attemptDoc = new PronunciationAttemptModel(attemptData);
        await attemptDoc.save();

        result.importedAttempts++;
      } catch (error) {
        const errorMsg = `Failed to import word attempt ${legacyAttempt.attemptId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        console.error(`[Migration] ${errorMsg}`, error);
      }
    }

    console.log(`[Migration] Completed migration for user ${userId}: ${result.importedSessions} sessions, ${result.importedAttempts} attempts imported`);

    res.json(result);
  } catch (error) {
    console.error('[Migration] Migration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'Migration failed',
      message: errorMessage,
    });
  }
});

export default router;

