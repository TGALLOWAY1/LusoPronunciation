import { Router, Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { createRateLimit, parsePositiveIntEnv } from '../middleware/rateLimit';
import {
  createCustomSentence,
  CustomSentenceError,
  deleteCustomSentenceForUser,
  getCustomSentenceForUser,
  listCustomSentencesForUser,
} from '../services/customSentenceService';
import type { CreateCustomSentenceResponse } from '../../shared/types/customSentence';

const router = Router();

const LOG_TAG = '[CustomSentences]';

/**
 * Per-user throttle on the expensive create path. Translation + TTS
 * incur per-request Azure cost, so we cap fresh sentence creation to a
 * modest per-user rate; 20 new sentences per hour is generous for a
 * legitimate learner and harsh for an abusive client.
 */
const createRateLimitMiddleware = createRateLimit({
  name: 'custom-sentence:create',
  windowMs: parsePositiveIntEnv(process.env.CUSTOM_SENTENCE_CREATE_WINDOW_MS, 60 * 60 * 1000),
  max: parsePositiveIntEnv(process.env.CUSTOM_SENTENCE_CREATE_MAX, 20),
  message: 'Too many custom sentences — slow down and try again later.',
});

/**
 * POST /api/sentences/custom
 * Body: { englishText: string }
 * Response: { sentence, tokens, audioUrl, status }
 */
router.post(
  '/custom',
  requireAuth,
  createRateLimitMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { englishText } = req.body ?? {};

    if (typeof englishText !== 'string') {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'englishText must be a string',
      });
    }

    try {
      const result = await createCustomSentence({ englishText, userId });
      const response: CreateCustomSentenceResponse = {
        sentence: result.sentence,
        tokens: result.tokens,
        audioUrl: result.audioUrl,
        status: result.status,
      };
      return res.status(201).json(response);
    } catch (err) {
      if (err instanceof CustomSentenceError) {
        const status = mapErrorCodeToHttp(err.code);
        console.error(
          `${LOG_TAG} ${err.code}: ${err.message}`,
          err.cause instanceof Error ? err.cause.message : err.cause
        );
        return res.status(status).json({
          error: err.code,
          message: err.message,
        });
      }
      console.error(`${LOG_TAG} unhandled error:`, err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred.',
      });
    }
  }
);

/**
 * GET /api/sentences/custom
 * List the signed-in user's custom sentences (newest first).
 * Query: limit (1-200, default 50), offset (default 0)
 */
router.get('/custom', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const limit = parseInt(req.query.limit as string) || undefined;
    const offset = parseInt(req.query.offset as string) || undefined;
    const result = await listCustomSentencesForUser({ userId, limit, offset });
    res.json(result);
  } catch (err) {
    console.error(`${LOG_TAG} list error:`, err);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred.',
    });
  }
});

/**
 * GET /api/sentences/custom/:id
 * Fetch a single custom sentence owned by the signed-in user.
 */
router.get('/custom/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const sentence = await getCustomSentenceForUser({
      userId,
      sentenceId: req.params.id,
    });
    if (!sentence) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(sentence);
  } catch (err) {
    console.error(`${LOG_TAG} get error:`, err);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred.',
    });
  }
});

/**
 * DELETE /api/sentences/custom/:id
 * Removes the sentence document and the associated WAV file. Attempt
 * history is intentionally preserved — learners may want to see their
 * scores for sentences they later deleted.
 */
router.delete('/custom/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const deleted = await deleteCustomSentenceForUser({
      userId,
      sentenceId: req.params.id,
    });
    if (!deleted) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.status(204).end();
  } catch (err) {
    console.error(`${LOG_TAG} delete error:`, err);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred.',
    });
  }
});

function mapErrorCodeToHttp(code: CustomSentenceError['code']): number {
  switch (code) {
    case 'INVALID_INPUT':
      return 400;
    case 'TRANSLATION_FAILED':
    case 'TTS_FAILED':
      return 502;
    case 'VALIDATION_FAILED':
    case 'PERSISTENCE_FAILED':
      return 500;
    default:
      return 500;
  }
}

export default router;
