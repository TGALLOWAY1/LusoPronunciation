/**
 * Records one row per occurrence of an unknown word into the
 * UnknownWordObservation collection. Safe-to-fail: observation writes
 * never take down the ingestion pipeline — we swallow and log errors
 * so a log-write hiccup can't block a legitimate sentence save.
 */

import mongoose from 'mongoose';
import {
  UnknownWordObservationModel,
} from '../models/UnknownWordObservationModel';
import type { CustomSentenceTokenDto } from '../../shared/types/customSentence';
import { logStage } from '../lib/pipelineLogger';

const PIPELINE = 'custom-sentence';

export interface RecordObservationParams {
  userId: string;
  sentenceId: string;
  contextText: string;
  tokens: CustomSentenceTokenDto[];
}

/**
 * Filters the tokens array down to generated/unresolved tokens and writes
 * one observation row per token. Returns the number of rows written.
 */
export async function recordUnknownWordObservations(
  params: RecordObservationParams
): Promise<number> {
  const observable = params.tokens.filter(
    (t) =>
      t.resolutionType === 'generated' || t.resolutionType === 'unresolved'
  );
  if (observable.length === 0) {
    return 0;
  }

  const userId = new mongoose.Types.ObjectId(params.userId);
  const sentenceId = new mongoose.Types.ObjectId(params.sentenceId);

  const rows = observable.map((token) => ({
    surfaceForm: token.normalizedForm,
    rawSurfaceForm: token.surfaceForm,
    userId,
    sentenceId,
    contextText: params.contextText,
    resolutionType: token.resolutionType as 'generated' | 'unresolved',
    generatedPronunciationId: token.generatedPronunciationId
      ? new mongoose.Types.ObjectId(token.generatedPronunciationId)
      : undefined,
  }));

  try {
    await UnknownWordObservationModel.insertMany(rows, { ordered: false });
    logStage({
      pipeline: PIPELINE,
      stage: 'observe.unknown',
      userId: params.userId,
      sentenceId: params.sentenceId,
      data: { recorded: rows.length },
    });
    return rows.length;
  } catch (err) {
    logStage({
      pipeline: PIPELINE,
      stage: 'observe.unknown',
      level: 'warn',
      userId: params.userId,
      sentenceId: params.sentenceId,
      data: {
        attempted: rows.length,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return 0;
  }
}
