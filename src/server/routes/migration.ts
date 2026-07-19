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

// Idempotency match windows — kept identical to the original per-record
// findOne() semantics (session: +/-1s on startedAt+mode; attempt: +/-5s on
// createdAt+contentId+contentType), just evaluated in-memory against a single
// batched fetch instead of one round-trip per record.
const SESSION_MATCH_WINDOW_MS = 1000;
const ATTEMPT_MATCH_WINDOW_MS = 5000;

interface ExistingSessionSummary {
  mode: string;
  startedAt: Date;
}

interface ExistingAttemptSummary {
  contentId: string;
  createdAt: Date;
}

/**
 * Pure, DB-free idempotency check for sessions. Extracted so it can be unit
 * tested without a Mongo connection — mirrors the original findOne() window
 * query exactly (same userId is assumed to already be baked into `existing`
 * via the caller's query filter).
 */
export function sessionAlreadyExists(
  existing: ExistingSessionSummary[],
  mode: string,
  startedAt: Date
): boolean {
  const target = startedAt.getTime();
  if (!Number.isFinite(target)) {
    return false;
  }
  return existing.some(
    (e) => e.mode === mode && Math.abs(e.startedAt.getTime() - target) <= SESSION_MATCH_WINDOW_MS
  );
}

/**
 * Pure, DB-free idempotency check for attempts (sentence or word — the
 * caller pre-filters `existing` by contentType via the batched query).
 */
export function attemptAlreadyExists(
  existing: ExistingAttemptSummary[],
  contentId: string,
  createdAt: Date
): boolean {
  const target = createdAt.getTime();
  if (!Number.isFinite(target)) {
    return false;
  }
  return existing.some(
    (e) => e.contentId === contentId && Math.abs(e.createdAt.getTime() - target) <= ATTEMPT_MATCH_WINDOW_MS
  );
}

interface InsertManyOutcome<TDoc extends { _id: mongoose.Types.ObjectId }> {
  insertedIds: Set<string>;
  failures: Array<{ doc: TDoc; error: unknown }>;
}

/**
 * insertMany wrapper that tolerates partial failure. With `ordered: false`,
 * MongoDB attempts every document regardless of earlier failures; the error
 * thrown on partial failure carries the documents that *did* land
 * (`insertedDocs`) so we can tell which of our pre-assigned `_id`s succeeded
 * and treat the rest as per-record failures (duplicate-key races, schema
 * validation) rather than failing the whole batch.
 */
async function insertManyTolerant<TDoc extends { _id: mongoose.Types.ObjectId }>(
  model: mongoose.Model<any>,
  docs: TDoc[]
): Promise<InsertManyOutcome<TDoc>> {
  if (docs.length === 0) {
    return { insertedIds: new Set(), failures: [] };
  }

  try {
    const inserted = (await model.insertMany(docs, { ordered: false })) as unknown as TDoc[];
    return {
      insertedIds: new Set(inserted.map((d) => String(d._id))),
      failures: [],
    };
  } catch (error: any) {
    const insertedDocs: TDoc[] = Array.isArray(error?.insertedDocs) ? error.insertedDocs : [];
    const insertedIds = new Set(insertedDocs.map((d) => String((d as any)._id)));

    const looksLikePartialBulkFailure =
      insertedIds.size > 0 ||
      Array.isArray(error?.writeErrors) ||
      error?.name === 'MongoBulkWriteError' ||
      error?.name === 'MongoServerError' ||
      error?.name === 'ValidationError';

    if (!looksLikePartialBulkFailure) {
      // Not a recognizable per-document failure shape (e.g. connection
      // dropped) — don't silently swallow it as "every record failed".
      throw error;
    }

    const failures = docs
      .filter((doc) => !insertedIds.has(String(doc._id)))
      .map((doc) => ({ doc, error }));

    return { insertedIds, failures };
  }
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
// Bound the migration payload. A real user migrating their local history will
// always be well below these numbers. Anything larger is either corrupt data
// or abuse. Keep these conservative — the route writes once per user per
// device, there is no legitimate reason to raise them without a case.
const MAX_MIGRATION_SESSIONS = 5_000;
const MAX_MIGRATION_SENTENCE_ATTEMPTS = 50_000;
const MAX_MIGRATION_WORD_ATTEMPTS = 50_000;

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

    if (
      payload.sessions.length > MAX_MIGRATION_SESSIONS ||
      payload.sentenceAttempts.length > MAX_MIGRATION_SENTENCE_ATTEMPTS ||
      payload.wordAttempts.length > MAX_MIGRATION_WORD_ATTEMPTS
    ) {
      console.warn(
        `[Migration] Rejected oversized payload user=${userId} sessions=${payload.sessions.length} sentences=${payload.sentenceAttempts.length} words=${payload.wordAttempts.length}`
      );
      return res.status(413).json({
        error: 'Payload too large',
        message: 'Migration payload exceeds allowed item counts.',
      });
    }

    console.log(`[Migration] Starting migration for user ${userId}: ${payload.sessions.length} sessions, ${payload.sentenceAttempts.length} sentence attempts, ${payload.wordAttempts.length} word attempts`);

    // Step 1: Import sessions and build sessionId mapping
    //
    // Batched: one existence-check query covering every session in the
    // payload (instead of one findOne() per record), then one insertMany()
    // for whatever doesn't already exist.
    const sessionIdMap = new Map<string, mongoose.Types.ObjectId>();

    const sessionStartedAts = payload.sessions.map((s) => new Date(s.startedAt));
    const sessionModes = Array.from(new Set(payload.sessions.map((s) => s.mode)));
    const finiteSessionStarts = sessionStartedAts
      .map((d) => d.getTime())
      .filter((t) => Number.isFinite(t));

    let existingSessions: ExistingSessionSummary[] = [];
    if (payload.sessions.length > 0) {
      const sessionQuery: Record<string, unknown> = { userId: userIdObject };
      if (sessionModes.length > 0) {
        sessionQuery.mode = { $in: sessionModes };
      }
      if (finiteSessionStarts.length > 0) {
        sessionQuery.startedAt = {
          $gte: new Date(Math.min(...finiteSessionStarts) - SESSION_MATCH_WINDOW_MS),
          $lte: new Date(Math.max(...finiteSessionStarts) + SESSION_MATCH_WINDOW_MS),
        };
      }
      existingSessions = (await PracticeSessionModel.find(sessionQuery, {
        mode: 1,
        startedAt: 1,
      }).lean()) as unknown as ExistingSessionSummary[];
    }

    const newSessionRecords: Array<{
      _id: mongoose.Types.ObjectId;
      legacySession: LegacyPracticeSession;
    }> = [];
    const sessionDataById = new Map<string, ReturnType<typeof convertLegacySession>>();

    for (let i = 0; i < payload.sessions.length; i++) {
      const legacySession = payload.sessions[i];
      const startedAt = sessionStartedAts[i];

      if (sessionAlreadyExists(existingSessions, legacySession.mode, startedAt)) {
        result.skippedSessions++;
        console.log(`[Migration] Skipping duplicate session: ${legacySession.sessionId}`);
        continue;
      }

      try {
        // Convert (validation happens here, per-record, same as before)
        const sessionData = convertLegacySession(legacySession, userIdObject);
        newSessionRecords.push({
          _id: new mongoose.Types.ObjectId(),
          legacySession,
        });
        // Stash the converted data alongside the record via a side map keyed
        // by _id so we can build the insertMany payload below without a
        // second conversion pass.
        sessionDataById.set(String(newSessionRecords[newSessionRecords.length - 1]._id), sessionData);
      } catch (error) {
        const errorMsg = `Failed to import session ${legacySession.sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        console.error(`[Migration] ${errorMsg}`, error);
      }
    }

    if (newSessionRecords.length > 0) {
      const docsToInsert = newSessionRecords.map((record) => ({
        _id: record._id,
        ...sessionDataById.get(String(record._id)),
      }));

      const { insertedIds, failures } = await insertManyTolerant(
        PracticeSessionModel,
        docsToInsert as Array<{ _id: mongoose.Types.ObjectId }>
      );

      for (const record of newSessionRecords) {
        const idStr = String(record._id);
        if (insertedIds.has(idStr)) {
          sessionIdMap.set(record.legacySession.sessionId, record._id);
          result.importedSessions++;
          console.log(`[Migration] Imported session: ${record.legacySession.sessionId} -> ${record._id}`);
        }
      }

      for (const failure of failures) {
        const failedId = String((failure.doc as { _id: mongoose.Types.ObjectId })._id);
        const record = newSessionRecords.find((r) => String(r._id) === failedId);
        const errorMsg = `Failed to import session ${record?.legacySession.sessionId ?? 'unknown'}: ${
          failure.error instanceof Error ? failure.error.message : 'Unknown error'
        }`;
        result.errors.push(errorMsg);
        console.error(`[Migration] ${errorMsg}`, failure.error);
      }
    }
    sessionDataById.clear();

    // Step 2: Import sentence attempts (same batched pattern)
    const sentenceContentIds = Array.from(
      new Set(payload.sentenceAttempts.map((a) => a.sentenceId))
    );
    const existingSentenceAttempts: ExistingAttemptSummary[] =
      sentenceContentIds.length > 0
        ? ((await PronunciationAttemptModel.find(
            { userId: userIdObject, contentType: 'sentence', contentId: { $in: sentenceContentIds } },
            { contentId: 1, createdAt: 1 }
          ).lean()) as unknown as ExistingAttemptSummary[])
        : [];

    const newSentenceAttemptRecords: Array<{
      _id: mongoose.Types.ObjectId;
      legacyAttempt: SentencePracticeAttempt;
    }> = [];
    const sentenceAttemptDataById = new Map<string, ReturnType<typeof convertLegacySentenceAttempt>>();

    for (const legacyAttempt of payload.sentenceAttempts) {
      const createdAt = new Date(legacyAttempt.createdAt);

      if (attemptAlreadyExists(existingSentenceAttempts, legacyAttempt.sentenceId, createdAt)) {
        result.skippedAttempts++;
        continue;
      }

      try {
        const attemptData = convertLegacySentenceAttempt(legacyAttempt, userIdObject, sessionIdMap);
        const _id = new mongoose.Types.ObjectId();
        newSentenceAttemptRecords.push({ _id, legacyAttempt });
        sentenceAttemptDataById.set(String(_id), attemptData);
      } catch (error) {
        const errorMsg = `Failed to import sentence attempt ${legacyAttempt.attemptId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        console.error(`[Migration] ${errorMsg}`, error);
      }
    }

    if (newSentenceAttemptRecords.length > 0) {
      const docsToInsert = newSentenceAttemptRecords.map((record) => ({
        _id: record._id,
        ...sentenceAttemptDataById.get(String(record._id)),
      }));

      const { insertedIds, failures } = await insertManyTolerant(
        PronunciationAttemptModel,
        docsToInsert as Array<{ _id: mongoose.Types.ObjectId }>
      );

      for (const record of newSentenceAttemptRecords) {
        if (insertedIds.has(String(record._id))) {
          result.importedAttempts++;
        }
      }

      for (const failure of failures) {
        const failedId = String((failure.doc as { _id: mongoose.Types.ObjectId })._id);
        const record = newSentenceAttemptRecords.find((r) => String(r._id) === failedId);
        const errorMsg = `Failed to import sentence attempt ${record?.legacyAttempt.attemptId ?? 'unknown'}: ${
          failure.error instanceof Error ? failure.error.message : 'Unknown error'
        }`;
        result.errors.push(errorMsg);
        console.error(`[Migration] ${errorMsg}`, failure.error);
      }
    }

    // Step 3: Import word attempts (same batched pattern)
    const wordContentIds = Array.from(new Set(payload.wordAttempts.map((a) => a.wordId)));
    const existingWordAttempts: ExistingAttemptSummary[] =
      wordContentIds.length > 0
        ? ((await PronunciationAttemptModel.find(
            { userId: userIdObject, contentType: 'word', contentId: { $in: wordContentIds } },
            { contentId: 1, createdAt: 1 }
          ).lean()) as unknown as ExistingAttemptSummary[])
        : [];

    const newWordAttemptRecords: Array<{
      _id: mongoose.Types.ObjectId;
      legacyAttempt: WordPracticeAttempt;
    }> = [];
    const wordAttemptDataById = new Map<string, ReturnType<typeof convertLegacyWordAttempt>>();

    for (const legacyAttempt of payload.wordAttempts) {
      const createdAt = new Date(legacyAttempt.createdAt);

      if (attemptAlreadyExists(existingWordAttempts, legacyAttempt.wordId, createdAt)) {
        result.skippedAttempts++;
        continue;
      }

      try {
        const attemptData = convertLegacyWordAttempt(legacyAttempt, userIdObject, sessionIdMap);
        const _id = new mongoose.Types.ObjectId();
        newWordAttemptRecords.push({ _id, legacyAttempt });
        wordAttemptDataById.set(String(_id), attemptData);
      } catch (error) {
        const errorMsg = `Failed to import word attempt ${legacyAttempt.attemptId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        console.error(`[Migration] ${errorMsg}`, error);
      }
    }

    if (newWordAttemptRecords.length > 0) {
      const docsToInsert = newWordAttemptRecords.map((record) => ({
        _id: record._id,
        ...wordAttemptDataById.get(String(record._id)),
      }));

      const { insertedIds, failures } = await insertManyTolerant(
        PronunciationAttemptModel,
        docsToInsert as Array<{ _id: mongoose.Types.ObjectId }>
      );

      for (const record of newWordAttemptRecords) {
        if (insertedIds.has(String(record._id))) {
          result.importedAttempts++;
        }
      }

      for (const failure of failures) {
        const failedId = String((failure.doc as { _id: mongoose.Types.ObjectId })._id);
        const record = newWordAttemptRecords.find((r) => String(r._id) === failedId);
        const errorMsg = `Failed to import word attempt ${record?.legacyAttempt.attemptId ?? 'unknown'}: ${
          failure.error instanceof Error ? failure.error.message : 'Unknown error'
        }`;
        result.errors.push(errorMsg);
        console.error(`[Migration] ${errorMsg}`, failure.error);
      }
    }

    console.log(`[Migration] Completed migration for user ${userId}: ${result.importedSessions} sessions, ${result.importedAttempts} attempts imported`);

    res.json(result);
  } catch (error) {
    console.error('[Migration] Migration error:', error instanceof Error ? error.message : error);
    res.status(500).json({
      error: 'Migration failed',
      message: 'An unexpected error occurred during migration.',
    });
  }
});

export default router;

