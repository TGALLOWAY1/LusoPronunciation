import express, { Express } from 'express';
import path from 'path';
import { existsSync } from 'fs';
import { config } from 'dotenv';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { connectMongo } from './db/mongoClient';
import healthRouter from './routes/health';
import pronunciationRouter, { legacyPronunciationAssessmentRouter } from './routes/pronunciationAssessment';
import authRouter from './routes/auth';
import oauthRouter from './routes/oauth';
import practiceRouter from './routes/practice';
import migrationRouter from './routes/migration';
import flashcardsRouter from './routes/flashcards';
import {
  pronunciationCorsMiddleware,
  pronunciationRateLimitMiddleware,
  pronunciationDailyQuotaMiddleware,
} from './middleware/pronunciationSecurity';
import { requireAuth } from './middleware/auth';
import { createRateLimit, parsePositiveIntEnv } from './middleware/rateLimit';
import {
  logInviteCodeReadiness,
  validateRequiredLaunchEnvVars,
} from './config/startupChecks';

// Load environment variables
config();

const app: Express = express();
const PORT = process.env.PORT || 4000;
const nonApiSpaRoutePattern = /^(?!\/api(?:\/|$)).*/;

// Trust Railway's reverse proxy (required for correct req.ip, req.protocol)
app.set('trust proxy', 1);

// Disable the X-Powered-By header (helmet also does this, belt-and-suspenders).
app.disable('x-powered-by');

// ──────────────── Security headers (Helmet) ────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'", 'blob:'],
        workerSrc: ["'self'", 'blob:'],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // MediaRecorder/WAV blobs need this off
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    strictTransportSecurity: {
      maxAge: 63072000, // 2 years
      includeSubDomains: true,
      preload: false, // flip to true only if you intend to submit to the HSTS preload list
    },
  })
);
app.use(cookieParser());

// ──────────────── Body size limits ────────────────
//
// Explicit limits prevent "JSON bomb" DoS. We keep defaults tight; the
// migration endpoint gets a larger override configured at its own route.
const GLOBAL_JSON_LIMIT = process.env.JSON_BODY_LIMIT || '128kb';
const MIGRATION_JSON_LIMIT = process.env.MIGRATION_JSON_LIMIT || '2mb';
app.use(express.json({ limit: GLOBAL_JSON_LIMIT }));
app.use(express.urlencoded({ extended: false, limit: GLOBAL_JSON_LIMIT }));

// ──────────────── Global per-IP rate limit ────────────────
//
// Baseline limit applied to every `/api/*` request. Route-specific limiters
// still run on top. This exists so that routes that *aren't* individually
// limited can't be spammed without bound.
const globalApiLimit = createRateLimit({
  name: 'api:global',
  windowMs: parsePositiveIntEnv(process.env.GLOBAL_API_WINDOW_MS, 60 * 1000),
  max: parsePositiveIntEnv(process.env.GLOBAL_API_MAX, 120),
  message: 'Too many requests. Please slow down.',
});
app.use('/api', globalApiLimit);

// Request logging (lightweight — method, path, status, duration)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// ──────────────── Routes ────────────────
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/auth/oauth', oauthRouter);
app.use('/api', practiceRouter);
// Migration endpoint: auth enforced by route handlers; override JSON limit here.
app.use(
  '/api/migrate',
  express.json({ limit: MIGRATION_JSON_LIMIT }),
  migrationRouter
);
app.use('/api/flashcards', flashcardsRouter);
app.use(
  '/api/pronunciation',
  pronunciationCorsMiddleware,
  requireAuth,
  pronunciationRateLimitMiddleware,
  pronunciationDailyQuotaMiddleware,
  pronunciationRouter
);
app.use(
  '/api/pronunciation-assessment',
  pronunciationCorsMiddleware,
  requireAuth,
  pronunciationRateLimitMiddleware,
  pronunciationDailyQuotaMiddleware,
  legacyPronunciationAssessmentRouter
);

// ──────────────── Static SPA Serving (production) ────────────────
const distPath = path.resolve(__dirname, '../../dist');

console.log(`[Server] distPath: ${distPath}, exists: ${existsSync(distPath)}`);

if (existsSync(distPath)) {
  // Serve Vite-built static assets with aggressive caching
  app.use(express.static(distPath, {
    maxAge: '1y',
    immutable: true,
    // Don't cache index.html itself (must always fetch latest)
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));

  // SPA fallback — serve index.html for all non-API routes
  app.get(nonApiSpaRoutePattern, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // Dev/API-only mode — no SPA built yet
  app.get('/', (_req, res) => {
    res.json({
      message: 'LusoPronunciation API',
      version: '1.0.0',
      note: 'Run "npm run build" to enable SPA serving.',
    });
  });
}

// ──────────────── Global error handler ────────────────
//
// Never leak stack traces or raw error.message to the client. Log server-side,
// return a generic message. Request ID can be correlated in logs.
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const requestId = (req.header('x-request-id') || '').toString();
  console.error('[Server] Unhandled route error:', err.message, err.stack);
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred.',
      ...(requestId ? { requestId } : {}),
    });
  }
});

/**
 * Starts the Express server
 * Starts listening first (so health checks can respond), then connects to MongoDB
 */
async function startServer(): Promise<void> {
  console.log(`[Server] Starting on port ${PORT} (HOST: 0.0.0.0)...`);

  // Hard-stop on unsafe production configs. We refuse to boot with obvious
  // foot-guns enabled.
  if (process.env.NODE_ENV === 'production') {
    if (process.env.ENABLE_DEV_LOGIN === 'true') {
      console.error(
        '[Server] ENABLE_DEV_LOGIN=true is not allowed in production. Aborting.'
      );
      process.exit(1);
    }
    if (process.env.SPEECH_DEBUG && /^(1|true|yes|on)$/i.test(process.env.SPEECH_DEBUG)) {
      console.warn(
        '[Server] SPEECH_DEBUG is enabled in production. This dumps full Azure payloads to disk — ' +
        'disable unless actively investigating an incident.'
      );
    }
  }

  // Start listening immediately so Railway health checks can reach the server
  // Explicitly bind to 0.0.0.0 — required for Railway's proxy to reach the app
  const server = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Server] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[Server] Health check: http://0.0.0.0:${PORT}/api/health`);
  });

  server.on('error', (err: Error) => {
    console.error(`[Server] Failed to bind to port ${PORT}:`, err.message);
    process.exit(1);
  });

  try {
    validateRequiredLaunchEnvVars();

    // Connect to MongoDB
    console.log('[Server] Connecting to MongoDB...');
    await connectMongo();
    console.log('[Server] MongoDB connected successfully');
    await logInviteCodeReadiness();
  } catch (error) {
    console.error('[Server] Failed to connect to MongoDB:', error);
    // Don't exit — keep the server running so health checks can report the error
  }
}

// Catch unhandled errors to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection:', reason);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server when run directly (not imported for testing).
// tsx doesn't reliably set require.main === module, so we detect test
// environments instead — Vitest sets VITEST=true automatically.
const isTestImport =
  process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

if (!isTestImport) {
  startServer().catch((error) => {
    console.error('[Server] Fatal error:', error);
    process.exit(1);
  });
}

export default app;
