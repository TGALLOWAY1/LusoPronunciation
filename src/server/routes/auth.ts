import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/UserModel';
import { mapUserDocToDto } from '../mappers/userMapper';
import type { User } from '../../shared/types';

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
 * Body: { email, password, displayName? }
 * Returns: { token, user: { id, email, displayName } }
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body;

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

export default router;

