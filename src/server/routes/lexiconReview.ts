import { Router, type Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { requireLexiconAdmin } from '../middleware/lexiconAdminAuth';
import {
  getReviewItem,
  LexiconReviewError,
  listReviewItems,
  promoteReviewItem,
  rejectReviewItem,
} from '../services/lexiconReviewService';
import {
  aggregateUnknownWords,
  type AggregationSummary,
} from '../services/lexiconAggregator';
import {
  resetMasterWordIndex,
} from '../lib/masterWordIndex';
import type {
  ILexiconReviewItemDocument,
  LexiconReviewStatus,
} from '../models/LexiconReviewItemModel';

const router = Router();

router.use(requireAuth, requireLexiconAdmin);

/**
 * GET /api/admin/lexicon/review
 * Query: status=pending|promoted|rejected, limit, offset
 */
router.get('/review', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = (req.query.status as LexiconReviewStatus | undefined) ?? 'pending';
    if (!['pending', 'promoted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const { items, total } = await listReviewItems({ status, limit, offset });

    res.json({
      items: items.map(toDto),
      total,
      limit,
      offset,
      status,
    });
  } catch (err) {
    console.error('[LexiconReview] list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/review/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const item = await getReviewItem(req.params.id);
    res.json(toDto(item));
  } catch (err) {
    handleServiceError(err, res, '[LexiconReview] get error:');
  }
});

/**
 * POST /api/admin/lexicon/review/:id/promote
 * Body: { text, en?, partOfSpeech?, phonemes: string[], ipa?, pronunciationNotes }
 */
router.post(
  '/review/:id/promote',
  async (req: AuthenticatedRequest, res: Response) => {
    const adminUserId = req.user!.id;
    try {
      const item = await promoteReviewItem({
        id: req.params.id,
        payload: req.body,
        adminUserId,
      });
      // Drop the cached master-word index so the next resolver call picks
      // up the newly promoted entry without waiting for a redeploy.
      resetMasterWordIndex();
      res.json(toDto(item));
    } catch (err) {
      handleServiceError(err, res, '[LexiconReview] promote error:');
    }
  }
);

/**
 * POST /api/admin/lexicon/review/:id/reject
 * Body: { reason?: string }
 */
router.post(
  '/review/:id/reject',
  async (req: AuthenticatedRequest, res: Response) => {
    const adminUserId = req.user!.id;
    try {
      const item = await rejectReviewItem({
        id: req.params.id,
        reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined,
        adminUserId,
      });
      res.json(toDto(item));
    } catch (err) {
      handleServiceError(err, res, '[LexiconReview] reject error:');
    }
  }
);

/**
 * POST /api/admin/lexicon/aggregate
 * Optional: triggers the daily aggregation on-demand. Production should
 * still drive this from a cron job calling the CLI script, but a manual
 * knob is useful during admin sessions.
 */
router.post('/aggregate', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const summary: AggregationSummary = await aggregateUnknownWords();
    res.json(summary);
  } catch (err) {
    console.error('[LexiconReview] aggregate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function handleServiceError(err: unknown, res: Response, logPrefix: string) {
  if (err instanceof LexiconReviewError) {
    const statusCode =
      err.code === 'NOT_FOUND'
        ? 404
        : err.code === 'INVALID_STATE'
          ? 409
          : 400;
    return res.status(statusCode).json({ error: err.code, message: err.message });
  }
  console.error(logPrefix, err);
  res.status(500).json({ error: 'Internal server error' });
}

function toDto(doc: ILexiconReviewItemDocument) {
  return {
    id: doc._id.toHexString(),
    surfaceForm: doc.surfaceForm,
    displayForm: doc.displayForm,
    frequency: doc.frequency,
    uniqueUsers: doc.uniqueUsers,
    firstSeenAt: doc.firstSeenAt.toISOString(),
    lastSeenAt: doc.lastSeenAt.toISOString(),
    lastResolutionType: doc.lastResolutionType,
    status: doc.status,
    examples: doc.examples.map((ex) => ({
      sentenceId: ex.sentenceId.toHexString(),
      contextText: ex.contextText,
      observedAt: ex.observedAt.toISOString(),
    })),
    generatedPronunciationId: doc.generatedPronunciationId?.toHexString(),
    promoted: doc.promoted
      ? {
          text: doc.promoted.text,
          en: doc.promoted.en,
          partOfSpeech: doc.promoted.partOfSpeech,
          phonemes: doc.promoted.phonemes,
          ipa: doc.promoted.ipa,
          pronunciationNotes: doc.promoted.pronunciationNotes,
          promotedBy: doc.promoted.promotedBy.toHexString(),
          promotedAt: doc.promoted.promotedAt.toISOString(),
        }
      : undefined,
    rejected: doc.rejected
      ? {
          reason: doc.rejected.reason,
          rejectedBy: doc.rejected.rejectedBy.toHexString(),
          rejectedAt: doc.rejected.rejectedAt.toISOString(),
        }
      : undefined,
  };
}

export default router;
