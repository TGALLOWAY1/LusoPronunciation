import express, { Express } from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { connectMongo } from './db/mongoClient';
import healthRouter from './routes/health';
import pronunciationRouter, { legacyPronunciationAssessmentRouter } from './routes/pronunciationAssessment';
import authRouter from './routes/auth';
import practiceRouter from './routes/practice';
import migrationRouter from './routes/migration';
import flashcardsRouter from './routes/flashcards';

// Load environment variables
config();

const app: Express = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api', practiceRouter);
app.use('/api/migrate', migrationRouter);
app.use('/api/flashcards', flashcardsRouter);
app.use('/api/pronunciation', pronunciationRouter);
app.use('/api/pronunciation-assessment', legacyPronunciationAssessmentRouter);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'LusoPronunciation API',
    version: '1.0.0',
  });
});

/**
 * Starts the Express server
 * Connects to MongoDB first, then starts listening
 */
async function startServer(): Promise<void> {
  try {
    // Connect to MongoDB
    console.log('[Server] Connecting to MongoDB...');
    await connectMongo();
    console.log('[Server] MongoDB connected successfully');

    // Start listening
    app.listen(PORT, () => {
      console.log(`[Server] Server running on http://localhost:${PORT}`);
      console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('[Server] Failed to start server:', error);
    process.exit(1);
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

// Start the server
if (require.main === module) {
  startServer().catch((error) => {
    console.error('[Server] Fatal error:', error);
    process.exit(1);
  });
}

export default app;
