import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/UserModel';
import { InviteCodeModel } from '../models/InviteCodeModel';
import { mapUserDocToDto } from '../mappers/userMapper';

const router = Router();

/**
 * JWT payload interface
 */
interface JWTPayload {
  userId: string;
  email: string;
}

/**
 * Get JWT secret from environment
 */
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim() === '') {
    throw new Error(
      'Missing required environment variable: JWT_SECRET\n' +
      'Please set JWT_SECRET in your server environment.'
    );
  }
  return secret;
}

/**
 * Generate JWT token for user
 */
function generateToken(userId: string, email: string): string {
  const secret = getJWTSecret();
  const payload: JWTPayload = {
    userId,
    email,
  };
  
  return jwt.sign(payload, secret, {
    expiresIn: '7d', // 7 days
  });
}

/**
 * Validate email format (basic check)
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * POST /api/auth/register
 *
 * Body: { email, password, displayName?, inviteCode? }
 * Returns: { token, user: { id, email, displayName } }
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, displayName, inviteCode } = req.body;

    // Validate input
    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address',
      });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        error: 'Invalid password',
        message: 'Password must be at least 6 characters long',
      });
    }

    // ──────────────── Invite code validation ────────────────
    const requireInvite = process.env.REQUIRE_INVITE_CODE !== 'false';

    if (requireInvite) {
      if (!inviteCode || typeof inviteCode !== 'string' || inviteCode.trim() === '') {
        return res.status(403).json({
          error: 'Invite code required',
          message: 'An invite code is required to register. Contact the app owner for access.',
        });
      }

      const normalizedCode = inviteCode.trim().toUpperCase();
      const invite = await InviteCodeModel.findOne({ code: normalizedCode });

      if (!invite || !invite.isActive) {
        return res.status(403).json({
          error: 'Invalid invite code',
          message: 'This invite code is not valid.',
        });
      }

      if (invite.expiresAt && invite.expiresAt < new Date()) {
        return res.status(403).json({
          error: 'Expired invite code',
          message: 'This invite code has expired.',
        });
      }

      if (invite.usedCount >= invite.maxUses) {
        return res.status(403).json({
          error: 'Invite code used',
          message: 'This invite code has reached its usage limit.',
        });
      }
    }

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'An account with this email already exists',
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userDoc = new UserModel({
      email: email.toLowerCase(),
      passwordHash,
      displayName: displayName?.trim() || undefined,
    });

    await userDoc.save();

    // Record invite usage (atomic update)
    if (requireInvite && inviteCode) {
      const normalizedCode = inviteCode.trim().toUpperCase();
      await InviteCodeModel.updateOne(
        { code: normalizedCode },
        {
          $inc: { usedCount: 1 },
          $push: { usedBy: userDoc._id },
        }
      );
    }

    // Generate token
    const token = generateToken(userDoc._id.toString(), userDoc.email);

    // Map to DTO
    const user = mapUserDocToDto(userDoc);

    res.status(201).json({
      token,
      user,
    });
  } catch (error) {
    console.error('[Auth] Registration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'Registration failed',
      message: errorMessage,
    });
  }
});

/**
 * POST /api/auth/login
 * 
 * Body: { email, password }
 * Returns: { token, user: { id, email, displayName } }
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide an email address',
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        error: 'Invalid password',
        message: 'Please provide a password',
      });
    }

    // Find user by email
    const userDoc = await UserModel.findOne({ email: email.toLowerCase() });
    if (!userDoc) {
      // Don't reveal whether user exists or not (security best practice)
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid email or password',
      });
    }

    // OAuth-only users cannot log in with email/password
    if (!userDoc.passwordHash) {
      return res.status(401).json({
        error: 'OAuth account',
        message: `This account uses ${userDoc.oauthProvider || 'social'} login. Please sign in with that provider.`,
      });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, userDoc.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid email or password',
      });
    }

    // Generate token
    const token = generateToken(userDoc._id.toString(), userDoc.email);

    // Map to DTO
    const user = mapUserDocToDto(userDoc);

    res.json({
      token,
      user,
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'Login failed',
      message: errorMessage,
    });
  }
});

/**
 * GET /api/auth/providers
 *
 * Returns which auth providers are available (OAuth configured, dev login, etc.)
 */
router.get('/providers', (_req: Request, res: Response) => {
  const providers: string[] = ['email'];

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.push('github');
  }
  if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
    providers.push('linkedin');
  }
  if (process.env.NODE_ENV !== 'production') {
    providers.push('dev');
  }

  res.json({ providers });
});

/**
 * POST /api/auth/dev-login
 *
 * Quick-login for development/testing — creates or finds a dev user and returns a token.
 * Disabled in production.
 */
router.post('/dev-login', async (_req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const devEmail = 'dev@lusopronunciation.local';

    let userDoc = await UserModel.findOne({ email: devEmail });
    if (!userDoc) {
      userDoc = await UserModel.create({
        email: devEmail,
        displayName: 'Dev User',
        passwordHash: await bcrypt.hash('devdev', 10),
      });
    }

    const token = generateToken(userDoc._id.toString(), userDoc.email);
    const user = mapUserDocToDto(userDoc);

    res.json({ token, user });
  } catch (error) {
    console.error('[Auth] Dev login error:', error);
    res.status(500).json({ error: 'Dev login failed' });
  }
});

export default router;
