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

    if (!mongoStatus.connected) {
      return {
        statusCode: 503,
        body: {
          ok: false,
          error: 'MongoDB is not connected.',
          mongo: mongoStatus,
        },
      };
    }

    return {
      statusCode: 200,
      body: {
        ok: true,
        mongo: mongoStatus,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      statusCode: 500,
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
