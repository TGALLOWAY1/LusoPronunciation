import type {
  PracticeSession,
  PronunciationAttempt,
  PracticeContentRef,
} from '../../shared/types';
import type { IPracticeSessionDocument } from '../models/PracticeSessionModel';
import type { IPronunciationAttemptDocument } from '../models/PronunciationAttemptModel';

/**
 * Maps a MongoDB practice session document to a PracticeSession DTO
 */
export function mapPracticeSessionDocToDto(
  doc: IPracticeSessionDocument
): PracticeSession {
  const startedAt = doc.startedAt.toISOString();
  const endedAt = doc.endedAt?.toISOString();
  const durationSeconds = endedAt
    ? Math.floor((doc.endedAt.getTime() - doc.startedAt.getTime()) / 1000)
    : undefined;

  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    mode: doc.mode,
    startedAt,
    endedAt,
    createdAt: doc.createdAt.toISOString(),
    device: doc.device,
    appVersion: doc.appVersion,
    totalAttempts: doc.totalAttempts,
    sentenceAttempts: doc.sentenceAttempts,
    wordAttempts: doc.wordAttempts,
    avgOverallScore: doc.avgOverallScore,
    avgFluencyScore: doc.avgFluencyScore,
    avgAccuracyScore: doc.avgAccuracyScore,
    avgCompletenessScore: doc.avgCompletenessScore,
    avgProsodyScore: doc.avgProsodyScore,
    dailyStreakAfterSession: doc.dailyStreakAfterSession,
  };
}

/**
 * Maps multiple MongoDB practice session documents to PracticeSession DTOs
 */
export function mapPracticeSessionDocsToDtos(
  docs: IPracticeSessionDocument[]
): PracticeSession[] {
  return docs.map(mapPracticeSessionDocToDto);
}

/**
 * Maps a MongoDB pronunciation attempt document to a PronunciationAttempt DTO
 */
export function mapPronunciationAttemptDocToDto(
  doc: IPronunciationAttemptDocument
): PronunciationAttempt {
  const content: PracticeContentRef = {
    contentId: doc.contentId,
    contentType: doc.contentType,
    textPt: doc.textPt,
    textEn: doc.textEn,
  };

  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    sessionId: doc.sessionId?.toString(),
    content,
    engine: doc.engine,
    scores: {
      overall: doc.scores.overall,
      accuracy: doc.scores.accuracy,
      fluency: doc.scores.fluency,
      completeness: doc.scores.completeness,
      prosody: doc.scores.prosody,
    },
    wordScores: doc.wordScores?.map((ws) => ({
      wordId: ws.wordId,
      token: ws.token,
      overallScore: ws.overallScore,
      accuracyScore: ws.accuracyScore,
      fluencyScore: ws.fluencyScore,
      errorType: ws.errorType,
      phonemeScores: ws.phonemeScores?.map((ps) => ({
        phonemeId: ps.phonemeId,
        overallScore: ps.overallScore,
      })),
    })),
    rawAssessment: doc.rawAssessment,
    createdAt: doc.createdAt.toISOString(),
    recordingUrl: doc.recordingUrl,
    recordingDataUrl: doc.recordingDataUrl,
    recordingDurationSeconds: doc.recordingDurationSeconds,
    latencyMs: doc.latencyMs,
    passed: doc.passed,
    targetOverallThreshold: doc.targetOverallThreshold,
    targetAccuracyThreshold: doc.targetAccuracyThreshold,
    retriesInThisSession: doc.retriesInThisSession,
    usedHint: doc.usedHint,
    slowedAudioPlayback: doc.slowedAudioPlayback,
    listenedToNativeModelCount: doc.listenedToNativeModelCount,
    confidenceLabel: doc.confidenceLabel,
    practiceDirection: doc.practiceDirection,
    practiceMode: doc.practiceMode,
    isCorrect: doc.isCorrect,
    selfRating: doc.selfRating,
  };
}

/**
 * Maps multiple MongoDB pronunciation attempt documents to PronunciationAttempt DTOs
 */
export function mapPronunciationAttemptDocsToDtos(
  docs: IPronunciationAttemptDocument[]
): PronunciationAttempt[] {
  return docs.map(mapPronunciationAttemptDocToDto);
}

