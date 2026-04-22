#!/usr/bin/env tsx
/**
 * Rolls the last N days of UnknownWordObservation rows into the
 * LexiconReviewItem queue so admins see fresh counts in the review UI.
 *
 * Usage:
 *   npm run lexicon:aggregate                # whole history
 *   npm run lexicon:aggregate -- --days=7    # last 7 days only
 *
 * Intended to run from cron daily, or on-demand via the admin endpoint.
 */

import { config as loadEnv } from 'dotenv';
import { connectMongo } from '../src/server/db/mongoClient';
import { aggregateUnknownWords } from '../src/server/services/lexiconAggregator';

loadEnv();

function parseDaysArg(): number | undefined {
  const arg = process.argv.find((a) => a.startsWith('--days='));
  if (!arg) return undefined;
  const value = Number(arg.split('=')[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

async function main() {
  const days = parseDaysArg();
  const since = days
    ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    : undefined;

  await connectMongo();
  const summary = await aggregateUnknownWords({ since });
  console.log('[lexicon:aggregate] summary:', summary);
  process.exit(0);
}

main().catch((err) => {
  console.error('[lexicon:aggregate] failed:', err);
  process.exit(1);
});
