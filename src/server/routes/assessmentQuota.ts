import { Router, Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { computeQuotaState } from '../middleware/assessmentQuota';

/**
 * GET /api/assessment-quota
 *
 * Read-only view of the caller's current assessment allowance. Does NOT consume
 * a slot — it only reads the persisted counters. Powers the quota indicator in
 * the practice UI (the "N of 10 today" / lifetime-remaining display) so the
 * user can see their allowance before recording.
 */
const router = Router();

router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const email = req.user!.email;
    const state = await computeQuotaState(userId, email);
    res.json(state);
  } catch (error) {
    console.error(
      '[AssessmentQuota] Failed to read quota state:',
      error instanceof Error ? error.message : error
    );
    res.status(500).json({
      error: 'Failed to read quota',
      message: 'Could not read your assessment quota. Please try again.',
    });
  }
});

export default router;
