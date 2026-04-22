import { Router, Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import {
  createCustomSentence,
  CustomSentenceError,
} from '../services/customSentenceService';
import type { CreateCustomSentenceResponse } from '../../shared/types/customSentence';

const router = Router();

const LOG_TAG = '[CustomSentences]';

/**
 * POST /api/sentences/custom
 *
 * Body: { englishText: string }
 * Response: { sentence, tokens, audioUrl, status }
 */
router.post('/custom', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
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
});

function mapErrorCodeToHttp(code: CustomSentenceError['code']): number {
  switch (code) {
    case 'INVALID_INPUT':
      return 400;
    case 'TRANSLATION_FAILED':
    case 'TTS_FAILED':
      return 502;
    case 'PERSISTENCE_FAILED':
      return 500;
    default:
      return 500;
  }
}

export default router;
