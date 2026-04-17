import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/UserModel';
import { InviteCodeModel } from '../models/InviteCodeModel';
import { mapUserDocToDto } from '../mappers/userMapper';
import { createRateLimit, parsePositiveIntEnv } from '../middleware/rateLimit';

const router = Router();

/**
 * JWT payload interface
 */
interface JWTPayload {
  userId: string;
  email: string;
}

/**
 * Minimum enforced password length. Short passwords are one of the biggest
 * abuse vectors — 8 chars is the NIST floor and what we require.
 */
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_EMAIL_LENGTH = 254;
const MAX_DISPLAY_NAME_LENGTH = 80;
const MAX_INVITE_CODE_LENGTH = 64;

/**
 * bcrypt cost factor. Raised from 10 to 12 — ~4x stronger against offline
 * attack, still well under 100ms on modern hardware.
 */
const BCRYPT_ROUNDS = 12;

/**
 * Get JWT secret from environment with a minimum-entropy check. We require
 * >=32 characters to refuse obviously-weak secrets in production.
 */
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim() === '') {
    throw new Error(
      'Missing required environment variable: JWT_SECRET\n' +
      'Please set JWT_SECRET in your server environment. Generate with: openssl rand -hex 32'
    );
  }
  if (secret.trim().length < 32 && process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET must be at least 32 characters long in production. ' +
      'Generate with: openssl rand -hex 32'
    );
  }
  return secret;
}

function generateToken(userId: string, email: string): string {
  const secret = getJWTSecret();
  const payload: JWTPayload = { userId, email };
  return jwt.sign(payload, secret, {
    expiresIn: '7d', // 7 days
  });
}

function isValidEmail(email: string): boolean {
  if (email.length > MAX_EMAIL_LENGTH) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Constant-time string comparison to avoid timing leaks on invite-code lookup.
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ──────────────── Rate limits on auth endpoints ────────────────
//
// Auth is the classic target for brute-force, credential stuffing, and
// invite-code enumeration. We apply both per-IP and per-email windows.
// These limits are tight by design — legitimate humans never hit them.

const loginIpLimit = createRateLimit({
  name: 'auth:login:ip',
  windowMs: parsePositiveIntEnv(process.env.AUTH_LOGIN_IP_WINDOW_MS, 15 * 60 * 1000),
  max: parsePositiveIntEnv(process.env.AUTH_LOGIN_IP_MAX, 20),
  message: 'Too many login attempts from this network. Try again later.',
});

const registerIpLimit = createRateLimit({
  name: 'auth:register:ip',
  windowMs: parsePositiveIntEnv(process.env.AUTH_REGISTER_IP_WINDOW_MS, 60 * 60 * 1000),
  max: parsePositiveIntEnv(process.env.AUTH_REGISTER_IP_MAX, 10),
  message: 'Too many sign-up attempts from this network. Try again later.',
});

const devLoginLimit = createRateLimit({
  name: 'auth:dev-login:ip',
  windowMs: 60 * 60 * 1000,
  max: 30,
});

const providersLimit = createRateLimit({
  name: 'auth:providers:ip',
  windowMs: 60 * 1000,
  max: 60,
});

/**
 * POST /api/auth/register
 */
router.post('/register', registerIpLimit, async (req: Request, res: Response) => {
  try {
    const { email, password, displayName, inviteCode } = req.body ?? {};

    if (
      !email ||
      typeof email !== 'string' ||
      !isValidEmail(email) ||
      email.length > MAX_EMAIL_LENGTH
    ) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address',
      });
    }

    if (
      !password ||
      typeof password !== 'string' ||
      password.length < MIN_PASSWORD_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      return res.status(400).json({
        error: 'Invalid password',
        message: `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`,
      });
    }

    if (
      displayName !== undefined &&
      (typeof displayName !== 'string' || displayName.length > MAX_DISPLAY_NAME_LENGTH)
    ) {
      return res.status(400).json({
        error: 'Invalid displayName',
        message: `displayName must be a string up to ${MAX_DISPLAY_NAME_LENGTH} characters.`,
      });
    }

    // ──────────────── Invite code validation ────────────────
    const requireInvite = process.env.REQUIRE_INVITE_CODE !== 'false';

    if (requireInvite) {
      if (
        !inviteCode ||
        typeof inviteCode !== 'string' ||
        inviteCode.trim() === '' ||
        inviteCode.length > MAX_INVITE_CODE_LENGTH
      ) {
        return res.status(403).json({
          error: 'Invite code required',
          message: 'An invite code is required to register. Contact the app owner for access.',
        });
      }

      const normalizedCode = inviteCode.trim().toUpperCase();
      const invite = await InviteCodeModel.findOne({ code: normalizedCode });

      // Unified failure message to reduce invite-code enumeration — an
      // attacker can no longer distinguish between "does not exist",
      // "expired", and "used" from the error text.
      const inviteFailure = () => {
        console.warn(
          `[Auth] invite code rejected ip=${req.ip} codeLen=${normalizedCode.length}`
        );
        return res.status(403).json({
          error: 'Invalid invite code',
          message: 'This invite code is not valid or has expired.',
        });
      };

      if (!invite || !invite.isActive) {
        return inviteFailure();
      }
      // Constant-time compare to make timing enumeration harder.
      if (!constantTimeEquals(invite.code, normalizedCode)) {
        return inviteFailure();
      }
      if (invite.expiresAt && invite.expiresAt < new Date()) {
        return inviteFailure();
      }
      if (invite.usedCount >= invite.maxUses) {
        return inviteFailure();
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
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user
    const userDoc = new UserModel({
      email: email.toLowerCase(),
      passwordHash,
      displayName: typeof displayName === 'string' ? displayName.trim() || undefined : undefined,
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

    const token = generateToken(userDoc._id.toString(), userDoc.email);
    const user = mapUserDocToDto(userDoc);

    res.status(201).json({ token, user });
  } catch (error) {
    console.error('[Auth] Registration error:', error instanceof Error ? error.message : error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'An unexpected error occurred. Please try again.',
    });
  }
});

/**
 * Per-email login limit (on top of per-IP). Blunts credential-stuffing
 * targeted at a single known account even across rotating IPs.
 */
const loginEmailLimit = createRateLimit({
  name: 'auth:login:email',
  windowMs: parsePositiveIntEnv(process.env.AUTH_LOGIN_EMAIL_WINDOW_MS, 15 * 60 * 1000),
  max: parsePositiveIntEnv(process.env.AUTH_LOGIN_EMAIL_MAX, 10),
  keyBy: (req) => {
    const email =
      typeof req.body?.email === 'string' ? req.body.email.toLowerCase().slice(0, MAX_EMAIL_LENGTH) : '';
    return `email:${email || 'unknown'}`;
  },
  message: 'Too many login attempts for this account. Try again later.',
});

/**
 * POST /api/auth/login
 */
router.post('/login', loginIpLimit, loginEmailLimit, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || typeof email !== 'string' || email.length > MAX_EMAIL_LENGTH) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide an email address',
      });
    }

    if (
      !password ||
      typeof password !== 'string' ||
      password.length === 0 ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      return res.status(400).json({
        error: 'Invalid password',
        message: 'Please provide a password',
      });
    }

    const userDoc = await UserModel.findOne({ email: email.toLowerCase() });

    // Run bcrypt either way to equalize timing between "user exists" and
    // "user does not exist". Without this, response time leaks user existence.
    // The dummy hash corresponds to a password that will never match.
    const dummyHash =
      '$2b$12$CwTycUXWue0Thq9StjUM0uJ8gF2G2l2Sg4zV7yk1hN2v9eF1lQv5C';
    const hashToCompare = userDoc?.passwordHash || dummyHash;
    const isPasswordValid = await bcrypt.compare(password, hashToCompare);

    if (!userDoc || !userDoc.passwordHash || !isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid email or password',
      });
    }

    const token = generateToken(userDoc._id.toString(), userDoc.email);
    const user = mapUserDocToDto(userDoc);

    res.json({ token, user });
  } catch (error) {
    console.error('[Auth] Login error:', error instanceof Error ? error.message : error);
    res.status(500).json({
      error: 'Login failed',
      message: 'An unexpected error occurred. Please try again.',
    });
  }
});

/**
 * GET /api/auth/providers
 */
router.get('/providers', providersLimit, (_req: Request, res: Response) => {
  const providers: string[] = ['email'];

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.push('github');
  }
  if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
    providers.push('linkedin');
  }
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push('google');
  }
  // Dev login is only advertised in non-production, even if the flag is set.
  if (process.env.ENABLE_DEV_LOGIN === 'true' && process.env.NODE_ENV !== 'production') {
    providers.push('dev');
  }

  res.json({ providers });
});

/**
 * POST /api/auth/dev-login
 *
 * Hard-gated:
 *   1. NODE_ENV must NOT be "production".
 *   2. ENABLE_DEV_LOGIN must be "true".
 *   3. Requires a shared DEV_LOGIN_TOKEN header if set (adds friction so that
 *      flipping the flag accidentally in prod is not an instant bypass).
 */
router.post('/dev-login', devLoginLimit, async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  if (process.env.ENABLE_DEV_LOGIN !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }

  const requiredToken = process.env.DEV_LOGIN_TOKEN;
  if (requiredToken) {
    const provided = req.header('x-dev-login-token') || '';
    if (provided.length !== requiredToken.length || !constantTimeEquals(provided, requiredToken)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const devEmail = 'dev@lusopronunciation.local';

    let userDoc = await UserModel.findOne({ email: devEmail });
    if (!userDoc) {
      userDoc = await UserModel.create({
        email: devEmail,
        displayName: 'Dev User',
        passwordHash: await bcrypt.hash('dev-local-no-prod', BCRYPT_ROUNDS),
      });
    }

    const token = generateToken(userDoc._id.toString(), userDoc.email);
    const user = mapUserDocToDto(userDoc);

    res.json({ token, user });
  } catch (error) {
    console.error('[Auth] Dev login error:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Dev login failed' });
  }
});

export default router;
