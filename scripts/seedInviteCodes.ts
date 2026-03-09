/**
 * Seed Invite Codes
 *
 * Creates invite codes in the database for gating registration.
 *
 * Usage:
 *   npx tsx scripts/seedInviteCodes.ts --code=RECRUIT-DEMO --maxUses=5
 *   npx tsx scripts/seedInviteCodes.ts --code=REVIEW-2025 --maxUses=1 --expiresInDays=30
 *
 * Required env:
 *   MONGODB_URI — MongoDB connection string (reads from .env if present)
 */

import { config } from 'dotenv';
config();

import mongoose from 'mongoose';
import { InviteCodeModel } from '../src/server/models/InviteCodeModel';

function parseArgs(): {
  code: string;
  maxUses: number;
  expiresInDays?: number;
  createdBy: string;
} {
  const args = process.argv.slice(2);
  let code = '';
  let maxUses = 5;
  let expiresInDays: number | undefined;
  let createdBy = 'admin';

  for (const arg of args) {
    if (arg.startsWith('--code=')) {
      code = arg.slice('--code='.length).trim().toUpperCase();
    } else if (arg.startsWith('--maxUses=')) {
      maxUses = parseInt(arg.slice('--maxUses='.length), 10);
    } else if (arg.startsWith('--expiresInDays=')) {
      expiresInDays = parseInt(arg.slice('--expiresInDays='.length), 10);
    } else if (arg.startsWith('--createdBy=')) {
      createdBy = arg.slice('--createdBy='.length).trim();
    }
  }

  if (!code) {
    console.error('Usage: npx tsx scripts/seedInviteCodes.ts --code=YOUR-CODE [--maxUses=5] [--expiresInDays=30]');
    process.exit(1);
  }

  if (isNaN(maxUses) || maxUses < 1) {
    console.error('--maxUses must be a positive integer');
    process.exit(1);
  }

  return { code, maxUses, expiresInDays, createdBy };
}

async function main(): Promise<void> {
  const { code, maxUses, expiresInDays, createdBy } = parseArgs();

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Missing MONGODB_URI environment variable. Set it in .env or pass directly.');
    process.exit(1);
  }

  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(mongoUri);
  console.log(`Connected.`);

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : undefined;

  // Check if code already exists
  const existing = await InviteCodeModel.findOne({ code });
  if (existing) {
    console.log(`Invite code "${code}" already exists (used ${existing.usedCount}/${existing.maxUses}, active=${existing.isActive}).`);
    await mongoose.disconnect();
    return;
  }

  const doc = await InviteCodeModel.create({
    code,
    maxUses,
    createdBy,
    expiresAt,
  });

  console.log(`\nInvite code created:`);
  console.log(`  Code:       ${doc.code}`);
  console.log(`  Max uses:   ${doc.maxUses}`);
  console.log(`  Expires:    ${doc.expiresAt?.toISOString() ?? 'never'}`);
  console.log(`  Created by: ${doc.createdBy}`);

  await mongoose.disconnect();
  console.log(`\nDone.`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
