import { Router, Request, Response } from 'express';
import { getMongoStatus, type MongoStatus } from '../db/mongoClient';

const router = Router();

export interface SpeechReadiness {
  configured: boolean;
}

export interface HealthResponseBody {
  ok: boolean;
  mongo: MongoStatus;
  speech: SpeechReadiness;
  error?: string;
}

function checkSpeechConfigured(env: NodeJS.ProcessEnv = process.env): SpeechReadiness {
  const hasKey = typeof env.AZURE_SPEECH_KEY === 'string' && env.AZURE_SPEECH_KEY.trim().length > 0;
  const hasRegion =
    typeof env.AZURE_SPEECH_REGION === 'string' && env.AZURE_SPEECH_REGION.trim().length > 0;
  return { configured: hasKey && hasRegion };
}

export async function buildHealthResponse(
  getStatus: () => Promise<MongoStatus> = getMongoStatus,
  getSpeech: () => SpeechReadiness = checkSpeechConfigured
): Promise<{ statusCode: number; body: HealthResponseBody }> {
  const speech = getSpeech();

  try {
    const mongoStatus = await getStatus();
    const ok = mongoStatus.connected && speech.configured;

    // Always return 200 for liveness (Railway health check).
    // The response body still reports dependency readiness for observability.
    const errorMessage = !mongoStatus.connected
      ? 'MongoDB is not connected.'
      : !speech.configured
        ? 'Azure Speech credentials are not configured.'
        : undefined;

    return {
      statusCode: 200,
      body: {
        ok,
        mongo: mongoStatus,
        speech,
        ...(errorMessage ? { error: errorMessage } : {}),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Still return 200 so the deploy isn't killed — report the error in the body
    return {
      statusCode: 200,
      body: {
        ok: false,
        error: errorMessage,
        mongo: {
          connected: false,
          readyState: 0,
        },
        speech,
      },
    };
  }
}

/**
 * GET /api/health
 *
 * Returns health status of the API, MongoDB connection, and speech
 * configuration. Always 200 so upstream health checks treat the process as
 * alive; the body distinguishes "up" from "ready".
 */
router.get('/', async (_req: Request, res: Response) => {
  const { statusCode, body } = await buildHealthResponse();
  res.status(statusCode).json(body);
});

export interface ReadinessResponseBody {
  ok: boolean;
  mongo: MongoStatus;
}

/**
 * Builds the readiness payload/status. Exported (like buildHealthResponse)
 * so it can be unit tested with an injected status getter instead of a real
 * MongoDB connection.
 */
export async function buildReadinessResponse(
  getStatus: () => Promise<MongoStatus> = getMongoStatus
): Promise<{ statusCode: number; body: ReadinessResponseBody }> {
  const mongoStatus = await getStatus();
  if (!mongoStatus.connected) {
    return { statusCode: 503, body: { ok: false, mongo: mongoStatus } };
  }
  return { statusCode: 200, body: { ok: true, mongo: mongoStatus } };
}

/**
 * GET /api/health/ready
 *
 * Readiness probe (distinct from the liveness probe above): 503 when MongoDB
 * is not connected, 200 otherwise. This is intentionally a *different* route
 * from GET /api/health, which must keep returning 200 unconditionally —
 * Railway's healthcheck is wired to the liveness route and would restart-loop
 * the deploy if it started failing whenever Mongo blipped.
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const { statusCode, body } = await buildReadinessResponse();
  res.status(statusCode).json(body);
});

export default router;
