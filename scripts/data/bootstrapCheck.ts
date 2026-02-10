#!/usr/bin/env node

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

type ManifestArtifact = {
  path: string;
  sha256: string;
};

function sha256Hex(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function parseVersionArg(): string {
  const arg = process.argv.slice(2).find((value) => value.startsWith('--version='));
  return (arg?.split('=')[1]?.trim().replace(/^v/, '') || '2.0.0');
}

async function main() {
  const cwd = process.cwd();
  const version = parseVersionArg();
  const releaseDir = path.join(cwd, 'data', 'releases', `v${version}`);
  const manifestPath = path.join(releaseDir, 'dataset-manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as {
    artifacts: Record<string, ManifestArtifact>;
  };

  for (const [artifactKey, artifact] of Object.entries(manifest.artifacts)) {
    const artifactPath = path.join(releaseDir, artifact.path);
    const body = await fs.readFile(artifactPath);
    const actual = sha256Hex(body);
    const expected = artifact.sha256.replace(/^sha256:/, '');
    if (actual !== expected) {
      throw new Error(`Checksum mismatch for ${artifactKey}: expected ${expected}, got ${actual}`);
    }
  }

  console.log(`[bootstrapCheck] v${version} manifest and checksums are valid.`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[bootstrapCheck] ${message}`);
  process.exit(1);
});

