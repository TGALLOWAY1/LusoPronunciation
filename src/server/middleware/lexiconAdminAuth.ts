/**
 * Admin gate for the lexicon review endpoints.
 *
 * Strategy: require a valid JWT (reuses `requireAuth`), then compare
 * `req.user.id` against the comma-separated `LEXICON_ADMIN_USER_IDS`
 * allowlist. In production a missing/empty allowlist denies all access
 * (fail-safe); outside production an empty allowlist lets any signed-in
 * user through so developers can iterate locally without seeding env.
 */

import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from './auth';

function parseAllowlist(): string[] {
  return (process.env.LEXICON_ADMIN_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function requireLexiconAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required.',
    });
    return;
  }

  const allowlist = parseAllowlist();
  const isProd = process.env.NODE_ENV === 'production';

  if (allowlist.length === 0) {
    if (isProd) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Lexicon admin access is not configured.',
      });
      return;
    }
    // Dev convenience: any signed-in user passes.
    next();
    return;
  }

  if (!allowlist.includes(userId)) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Lexicon admin access required.',
    });
    return;
  }

  next();
}
