import { Router, Request, Response } from 'express';
import { getMongoStatus } from '../db/mongoClient';

const router = Router();

/**
 * GET /api/health
 * 
 * Returns health status of the API and MongoDB connection
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const mongoStatus = await getMongoStatus();

    res.json({
      ok: true,
      mongo: mongoStatus,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: errorMessage,
      mongo: await getMongoStatus().catch(() => ({
        connected: false,
        readyState: 0,
      })),
    });
  }
});

export default router;

