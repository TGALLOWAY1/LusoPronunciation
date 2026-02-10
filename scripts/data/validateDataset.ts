#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { runDatasetValidation } from '../../src/pipeline/validators/runDatasetValidation';

type Args = {
  version?: string;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const versionArg = args.find((arg) => arg.startsWith('--version='));
  const version = versionArg?.split('=')[1]?.trim().replace(/^v/, '');
  return { version: version || undefined };
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

  const words = await readJson<any[]>(path.join(dir, 'words.json'));
  const sentences = await readJson<any[]>(path.join(dir, 'sentences.json'));
  const categories = await readJson<any[]>(path.join(dir, 'categories.json'));
  const phonemes = await readJson<any[]>(path.join(dir, 'phonemes.json'));
  const pronunciationTips = await readJson<any[]>(path.join(dir, 'pronunciationTips.json'));
  const azureAssessmentConfigs = await readJson<any[]>(path.join(dir, 'azureAssessmentConfigs.json'));
  const audioIndex = await readJson<Record<string, any>>(path.join(dir, 'audio_index.json'));

  const report = runDatasetValidation(version, {
    words,
    sentences,
    categories,
    phonemes,
    pronunciationTips,
    azureAssessmentConfigs,
    audioIndex,
  });

  await fs.writeFile(path.join(dir, 'validation-report.json'), JSON.stringify(report, null, 2), 'utf-8');

  console.log(
    `[validateDataset] v${version}: ${report.summary.errors} errors, ${report.summary.warnings} warnings`
  );

  if (report.summary.errors > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[validateDataset] ${message}`);
  process.exit(1);
});

