/**
 * Rolls UnknownWordObservation rows up into the LexiconReviewItem queue.
 *
 * Intended to be run on a schedule (e.g. daily via
 * `npm run lexicon:aggregate` from cron). Only touches *pending* review
 * items — already-promoted and already-rejected items are never updated
 * automatically, which is the core "no automatic promotion" rule.
 *
 * The aggregation itself is split into a pure function (`groupObservations`)
 * that turns an array of raw rows into upsert payloads, and a small driver
 * that talks to Mongo. Tests cover the pure function without a DB.
 */

import mongoose from 'mongoose';
import {
  UnknownWordObservationModel,
  type IUnknownWordObservationDocument,
} from '../models/UnknownWordObservationModel';
import {
  LexiconReviewItemModel,
  type ILexiconReviewExample,
} from '../models/LexiconReviewItemModel';
import { logStage } from '../lib/pipelineLogger';

const PIPELINE = 'lexicon';
const MAX_EXAMPLES = 3;

export interface AggregatedGroup {
  surfaceForm: string;
  displayForm: string;
  frequency: number;
  uniqueUsers: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  examples: ILexiconReviewExample[];
  lastResolutionType: 'generated' | 'unresolved';
  lastGeneratedPronunciationId?: mongoose.Types.ObjectId;
}

export interface AggregationSummary {
  observations: number;
  groups: number;
  upserted: number;
  skippedNonPending: number;
}

/**
 * Pure transformation: given a set of observation rows, roll them into
 * groups keyed by normalized surfaceForm. The caller decides whether to
 * persist them.
 */
export function groupObservations(
  rows: Array<
    Pick<
      IUnknownWordObservationDocument,
      | 'surfaceForm'
      | 'rawSurfaceForm'
      | 'userId'
      | 'sentenceId'
      | 'contextText'
      | 'resolutionType'
      | 'generatedPronunciationId'
      | 'createdAt'
    >
  >
): AggregatedGroup[] {
  const byForm = new Map<string, AggregatedGroup & { userSet: Set<string>; displayCounts: Map<string, number> }>();

  for (const row of rows) {
    const key = row.surfaceForm;
    let group = byForm.get(key);
    if (!group) {
      group = {
        surfaceForm: key,
        displayForm: row.rawSurfaceForm,
        frequency: 0,
        uniqueUsers: 0,
        firstSeenAt: row.createdAt,
        lastSeenAt: row.createdAt,
        examples: [],
        lastResolutionType: row.resolutionType,
        lastGeneratedPronunciationId: row.generatedPronunciationId,
        userSet: new Set<string>(),
        displayCounts: new Map<string, number>(),
      };
      byForm.set(key, group);
    }

    group.frequency += 1;
    group.userSet.add(row.userId.toHexString());
    group.displayCounts.set(
      row.rawSurfaceForm,
      (group.displayCounts.get(row.rawSurfaceForm) ?? 0) + 1
    );

    if (row.createdAt < group.firstSeenAt) {
      group.firstSeenAt = row.createdAt;
    }
    if (row.createdAt > group.lastSeenAt) {
      group.lastSeenAt = row.createdAt;
      group.lastResolutionType = row.resolutionType;
      group.lastGeneratedPronunciationId = row.generatedPronunciationId;
    }

    if (group.examples.length < MAX_EXAMPLES) {
      group.examples.push({
        sentenceId: row.sentenceId,
        contextText: row.contextText,
        observedAt: row.createdAt,
      });
    }
  }

  const out: AggregatedGroup[] = [];
  for (const group of byForm.values()) {
    // Most frequent raw spelling wins as the display form.
    const display = [...group.displayCounts.entries()].sort(
      (a, b) => b[1] - a[1]
    )[0];
    const { userSet, displayCounts, ...rest } = group;
    out.push({
      ...rest,
      displayForm: display ? display[0] : rest.displayForm,
      uniqueUsers: userSet.size,
    });
  }

  // Deterministic order: most frequent first, then alphabetical.
  out.sort((a, b) => b.frequency - a.frequency || a.surfaceForm.localeCompare(b.surfaceForm));
  return out;
}

export interface AggregateOptions {
  /** Aggregate observations created since this date. Defaults to epoch. */
  since?: Date;
}

/**
 * Reads observations since `opts.since` (default: all time), groups them,
 * and upserts into pending LexiconReviewItem rows. Promoted and rejected
 * rows are left untouched.
 */
export async function aggregateUnknownWords(
  opts: AggregateOptions = {}
): Promise<AggregationSummary> {
  const since = opts.since ?? new Date(0);
  const rows = await UnknownWordObservationModel.find({
    createdAt: { $gte: since },
  }).lean();

  const groups = groupObservations(rows as any);

  let upserted = 0;
  let skipped = 0;

  for (const group of groups) {
    const existing = await LexiconReviewItemModel.findOne({
      surfaceForm: group.surfaceForm,
    });

    if (existing && existing.status !== 'pending') {
      skipped += 1;
      continue;
    }

    await LexiconReviewItemModel.findOneAndUpdate(
      { surfaceForm: group.surfaceForm },
      {
        $set: {
          surfaceForm: group.surfaceForm,
          displayForm: group.displayForm,
          frequency: group.frequency,
          uniqueUsers: group.uniqueUsers,
          firstSeenAt: group.firstSeenAt,
          lastSeenAt: group.lastSeenAt,
          examples: group.examples,
          lastResolutionType: group.lastResolutionType,
          generatedPronunciationId: group.lastGeneratedPronunciationId,
        },
        $setOnInsert: { status: 'pending' },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    upserted += 1;
  }

  const summary: AggregationSummary = {
    observations: rows.length,
    groups: groups.length,
    upserted,
    skippedNonPending: skipped,
  };

  logStage({
    pipeline: PIPELINE,
    stage: 'aggregate',
    data: summary as unknown as Record<string, unknown>,
  });

  return summary;
}
