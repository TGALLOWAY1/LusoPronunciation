import { Router, Request, Response } from 'express';
import { getMongoStatus, type MongoStatus } from '../db/mongoClient';

const router = Router();

export interface HealthResponseBody {
  ok: boolean;
  mongo: MongoStatus;
  error?: string;
}

export async function buildHealthResponse(
  getStatus: () => Promise<MongoStatus> = getMongoStatus
): Promise<{ statusCode: number; body: HealthResponseBody }> {
  try {
    const mongoStatus = await getStatus();

    // Always return 200 for liveness (Railway health check).
    // The response body still reports MongoDB status for observability.
    return {
      statusCode: 200,
      body: {
        ok: mongoStatus.connected,
        mongo: mongoStatus,
        ...(!mongoStatus.connected && { error: 'MongoDB is not connected.' }),
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
      },
    };
  }
}

/**
 * GET /api/health
 * 
 * Returns health status of the API and MongoDB connection
 */
router.get('/', async (_req: Request, res: Response) => {
  const { statusCode, body } = await buildHealthResponse();
  res.status(statusCode).json(body);
});

export default router;
