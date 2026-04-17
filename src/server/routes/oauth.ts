import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/UserModel';

const router = Router();

// ──────────────── Helpers ────────────────

function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim() === '') {
    throw new Error('Missing required environment variable: JWT_SECRET');
  }
  return secret;
}

function generateToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, getJWTSecret(), { expiresIn: '7d' });
}

function getAppOrigin(): string {
  return process.env.APP_ORIGIN || 'http://localhost:3000';
}

/** Generate a cryptographically random state nonce and set it as an HttpOnly cookie. */
function setStateCookie(res: Response, provider: string): string {
  const state = crypto.randomBytes(32).toString('hex');
  res.cookie(`oauth_state_${provider}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: `/api/auth/oauth/${provider}/callback`,
  });
  return state;
}

/** Validate the state param against the cookie and clear it. Returns true if valid. */
function validateState(req: Request, res: Response, provider: string): boolean {
  const stateParam = req.query.state;
  const cookieName = `oauth_state_${provider}`;
  const stateCookie = req.cookies?.[cookieName];

  // Clear the cookie regardless
  res.clearCookie(cookieName, { path: `/api/auth/oauth/${provider}/callback` });

  if (!stateParam || !stateCookie || stateParam !== stateCookie) {
    return false;
  }
  return true;
}

// ──────────────── GitHub OAuth ────────────────

router.get('/github', (_req: Request, res: Response) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'GitHub OAuth not configured' });
  }

  const appOrigin = getAppOrigin();
  const state = setStateCookie(res, 'github');
  const redirectUri = `${appOrigin}/api/auth/oauth/github/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'user:email',
    state,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

router.get('/github/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  const appOrigin = getAppOrigin();

  // Validate CSRF state nonce
  if (!validateState(req, res, 'github')) {
    return res.redirect(`${appOrigin}/auth?error=invalid_state`);
  }

  if (!code || typeof code !== 'string') {
    return res.redirect(`${appOrigin}/auth?error=missing_code`);
  }

  try {
    const redirectUri = `${appOrigin}/api/auth/oauth/github/callback`;

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      console.error('[OAuth] GitHub token exchange failed:', tokenData.error);
      return res.redirect(`${appOrigin}/auth?error=token_exchange_failed`);
    }

    // Fetch user profile
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const githubUser = await userResponse.json() as {
      id: number;
      email: string | null;
      name: string | null;
      avatar_url: string | null;
    };

    // Fetch verified email — only accept verified addresses
    let email = githubUser.email;
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const emails = await emailsResponse.json() as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const verifiedEmails = emails.filter((e) => e.verified);
      const primary = verifiedEmails.find((e) => e.primary);
      email = primary?.email || verifiedEmails[0]?.email || null;
    }

    if (!email) {
      return res.redirect(`${appOrigin}/auth?error=no_email`);
    }

    // Find or create user
    const githubId = String(githubUser.id);
    let userDoc = await UserModel.findOne({
      $or: [
        { oauthProvider: 'github', oauthId: githubId },
        { email: email.toLowerCase() },
      ],
    });

    if (userDoc) {
      // Link OAuth if user exists by email but hasn't linked GitHub yet
      if (!userDoc.oauthProvider) {
        userDoc.oauthProvider = 'github';
        userDoc.oauthId = githubId;
        userDoc.avatarUrl = githubUser.avatar_url || undefined;
        await userDoc.save();
      }
    } else {
      userDoc = await UserModel.create({
        email: email.toLowerCase(),
        oauthProvider: 'github',
        oauthId: githubId,
        displayName: githubUser.name || undefined,
        avatarUrl: githubUser.avatar_url || undefined,
      });
    }

    const token = generateToken(userDoc._id.toString(), userDoc.email);
    // Hand the token to the SPA via a short-lived HttpOnly cookie instead of
    // embedding it in the redirect URL. Putting a JWT in a query string leaks
    // it through Referer headers, server logs, and browser history. The SPA
    // reads the cookie on /auth/callback via a single same-origin fetch that
    // returns the token in the response body and then clears the cookie.
    res.cookie('oauth_handoff', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2 * 60 * 1000, // 2 minutes — just enough for the SPA to pick it up
      path: '/api/auth/oauth/handoff',
    });
    res.redirect(`${appOrigin}/auth/callback`);
  } catch (error) {
    console.error('[OAuth] GitHub callback error:', error);
    res.redirect(`${appOrigin}/auth?error=server_error`);
  }
});

// ──────────────── LinkedIn OAuth ────────────────

router.get('/linkedin', (_req: Request, res: Response) => {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'LinkedIn OAuth not configured' });
  }

  const appOrigin = getAppOrigin();
  const state = setStateCookie(res, 'linkedin');
  const redirectUri = `${appOrigin}/api/auth/oauth/linkedin/callback`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid profile email',
    state,
  });

  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`);
});

router.get('/linkedin/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  const appOrigin = getAppOrigin();

  // Validate CSRF state nonce
  if (!validateState(req, res, 'linkedin')) {
    return res.redirect(`${appOrigin}/auth?error=invalid_state`);
  }

  if (!code || typeof code !== 'string') {
    return res.redirect(`${appOrigin}/auth?error=missing_code`);
  }

  try {
    const redirectUri = `${appOrigin}/api/auth/oauth/linkedin/callback`;

    // Exchange code for access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    });

    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      console.error('[OAuth] LinkedIn token exchange failed:', tokenData.error);
      return res.redirect(`${appOrigin}/auth?error=token_exchange_failed`);
    }

    // Fetch user profile via OpenID Connect userinfo endpoint
    const userInfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const linkedinUser = await userInfoResponse.json() as {
      sub: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    const email = linkedinUser.email;
    if (!email) {
      return res.redirect(`${appOrigin}/auth?error=no_email`);
    }

    // Find or create user
    let userDoc = await UserModel.findOne({
      $or: [
        { oauthProvider: 'linkedin', oauthId: linkedinUser.sub },
        { email: email.toLowerCase() },
      ],
    });

    if (userDoc) {
      if (!userDoc.oauthProvider) {
        userDoc.oauthProvider = 'linkedin';
        userDoc.oauthId = linkedinUser.sub;
        userDoc.avatarUrl = linkedinUser.picture || undefined;
        await userDoc.save();
      }
    } else {
      userDoc = await UserModel.create({
        email: email.toLowerCase(),
        oauthProvider: 'linkedin',
        oauthId: linkedinUser.sub,
        displayName: linkedinUser.name || undefined,
        avatarUrl: linkedinUser.picture || undefined,
      });
    }

    const token = generateToken(userDoc._id.toString(), userDoc.email);
    // Hand the token to the SPA via a short-lived HttpOnly cookie instead of
    // embedding it in the redirect URL. Putting a JWT in a query string leaks
    // it through Referer headers, server logs, and browser history. The SPA
    // reads the cookie on /auth/callback via a single same-origin fetch that
    // returns the token in the response body and then clears the cookie.
    res.cookie('oauth_handoff', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2 * 60 * 1000, // 2 minutes — just enough for the SPA to pick it up
      path: '/api/auth/oauth/handoff',
    });
    res.redirect(`${appOrigin}/auth/callback`);
  } catch (error) {
    console.error('[OAuth] LinkedIn callback error:', error);
    res.redirect(`${appOrigin}/auth?error=server_error`);
  }
});

// ──────────────── Token handoff ────────────────
//
// Single-use endpoint: the SPA fetches this on /auth/callback to retrieve the
// token that OAuth deposited in an HttpOnly cookie, then the server clears
// the cookie. This keeps the JWT out of URLs/Referer/history while still
// letting client JS store it in localStorage for subsequent API calls.
router.get('/handoff', (req: Request, res: Response) => {
  const token = req.cookies?.oauth_handoff;
  res.clearCookie('oauth_handoff', { path: '/api/auth/oauth/handoff' });
  if (!token || typeof token !== 'string') {
    return res.status(401).json({ error: 'No pending OAuth session' });
  }
  res.json({ token });
});

export default router;
