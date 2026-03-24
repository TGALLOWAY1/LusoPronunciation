import express, { Express } from 'express';
import path from 'path';
import { existsSync } from 'fs';
import { config } from 'dotenv';
import helmet from 'helmet';
import { connectMongo } from './db/mongoClient';
import healthRouter from './routes/health';
import pronunciationRouter, { legacyPronunciationAssessmentRouter } from './routes/pronunciationAssessment';
import authRouter from './routes/auth';
import practiceRouter from './routes/practice';
import migrationRouter from './routes/migration';
import flashcardsRouter from './routes/flashcards';
import {
  pronunciationCorsMiddleware,
  pronunciationRateLimitMiddleware,
} from './middleware/pronunciationSecurity';
import { requireAuth } from './middleware/auth';
import {
  logInviteCodeReadiness,
  validateRequiredLaunchEnvVars,
} from './config/startupChecks';

// Load environment variables
config();

const app: Express = express();
const PORT = process.env.PORT || 4000;
const nonApiSpaRoutePattern = /^(?!\/api(?:\/|$)).*/;

// Middleware
app.use(helmet());
app.use(express.json());

// Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api', practiceRouter);
app.use('/api/migrate', migrationRouter);
app.use('/api/flashcards', flashcardsRouter);
app.use(
  '/api/pronunciation',
  pronunciationCorsMiddleware,
  requireAuth,
  pronunciationRateLimitMiddleware,
  pronunciationRouter
);
app.use(
  '/api/pronunciation-assessment',
  pronunciationCorsMiddleware,
  requireAuth,
  pronunciationRateLimitMiddleware,
  legacyPronunciationAssessmentRouter
);

// ──────────────── Static SPA Serving (production) ────────────────
const distPath = path.resolve(__dirname, '../../dist');

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

/**
 * Starts the Express server
 * Starts listening first (so health checks can respond), then connects to MongoDB
 */
async function startServer(): Promise<void> {
  // Start listening immediately so Railway health checks can reach the server
  app.listen(PORT, () => {
    console.log(`[Server] Server running on http://localhost:${PORT}`);
    console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
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
// Vitest sets NODE_ENV or VITEST env vars; tsx doesn't reliably support
// require.main === module, so we check argv and env to decide.
const isTestImport =
  process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

if (!isTestImport) {
  startServer().catch((error) => {
    console.error('[Server] Fatal error:', error);
    process.exit(1);
  });
}

export default app;
