#!/usr/bin/env node

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import dataQualityConfig from '../../config/dataQuality.config';

type Args = {
  version?: string;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const versionArg = args.find((arg) => arg.startsWith('--version='));
  const version = versionArg?.split('=')[1]?.trim().replace(/^v/, '');
  return { version: version || undefined };
}

function sha256Hex(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function fileSha(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return sha256Hex(content);
}

async function readJson<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

function semverSortDesc(a: string, b: string): number {
  const parse = (value: string) => value.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const av = parse(a);
  const bv = parse(b);
  for (let i = 0; i < Math.max(av.length, bv.length); i += 1) {
    const diff = (bv[i] ?? 0) - (av[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function resolveReleaseDir(cwd: string, version?: string): Promise<{ version: string; dir: string }> {
  const releasesRoot = path.join(cwd, 'data', 'releases');
  if (version) {
    return {
      version,
      dir: path.join(releasesRoot, `v${version}`),
    };
  }

  const entries = await fs.readdir(releasesRoot, { withFileTypes: true });
  const versions = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('v'))
    .map((entry) => entry.name.replace(/^v/, ''))
    .sort(semverSortDesc);

  if (versions.length === 0) {
    throw new Error('No release directories found under data/releases.');
  }

  return {
    version: versions[0],
    dir: path.join(releasesRoot, `v${versions[0]}`),
  };
}

async function main() {
  const cwd = process.cwd();
  const { version: requestedVersion } = parseArgs();
  const { version, dir } = await resolveReleaseDir(cwd, requestedVersion);

  const artifacts: Record<string, { path: string; count: number; sha256: string }> = {};

  const artifactFiles: Record<string, string> = {
    categories: 'categories.json',
    phonemes: 'phonemes.json',
    pronunciationTips: 'pronunciationTips.json',
    words: 'words.json',
    sentences: 'sentences.json',
    lessons: 'lessons.json',
    audioIndex: 'audio_index.json',
    azureAssessmentConfigs: 'azureAssessmentConfigs.json',
  };

  for (const [key, fileName] of Object.entries(artifactFiles)) {
    const absolutePath = path.join(dir, fileName);
    const json = await readJson<any>(absolutePath);
    const count = Array.isArray(json) ? json.length : Object.keys(json ?? {}).length;
    artifacts[key] = {
      path: fileName,
      count,
      sha256: `sha256:${await fileSha(absolutePath)}`,
    };
  }

  const sourceFingerprint = `sha256:${sha256Hex(
    [
      await fileSha(path.join(cwd, 'data', 'masterWords.json')),
      await fileSha(path.join(cwd, 'data', 'masterSentences.json')),
      await fileSha(path.join(cwd, 'data', 'audio_index.json')),
    ].join('|')
  )}`;

  const generationConfigText = await fs
    .readFile(path.join(cwd, 'config', 'generationPipeline.config.ts'), 'utf-8')
    .catch(() => 'n/a');
  const configFingerprint = `sha256:${sha256Hex(
    JSON.stringify({
      generationConfig: generationConfigText,
      dataQualityConfig,
    })
  )}`;

  const validationPath = path.join(dir, 'validation-report.json');
  const validationReport = await readJson<any>(validationPath);

  const manifest = {
    datasetVersion: version,
    schemaVersion: '1.0.0',
    locale: 'pt-BR',
    buildTimestamp: new Date().toISOString(),
    sourceFingerprint,
    configFingerprint,
    artifacts,
    validation: {
      status: validationReport.summary?.errors === 0 ? 'passed' : 'failed',
      rulesetVersion: '1.0.0',
      reportPath: 'validation-report.json',
    },
    confidence: {
      modelA: 'google-ai-studio',
      modelB: 'openai',
      acceptThreshold: dataQualityConfig.thresholds.acceptConfidence,
      reviewThreshold: dataQualityConfig.thresholds.reviewConfidence,
      reportPath: 'confidence-report.json',
    },
  };

  await fs.writeFile(
    path.join(dir, 'dataset-manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  console.log(`[generateDatasetManifest] Wrote manifest for v${version}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[generateDatasetManifest] ${message}`);
  process.exit(1);
});
