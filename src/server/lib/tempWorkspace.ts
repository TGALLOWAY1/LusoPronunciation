import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export interface TempWorkspace {
  dir: string;
  inputPath: string;
  outputPath: string;
  cleanup: () => Promise<void>;
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 64);
}

export async function createWorkspace(prefix: string, requestId: string): Promise<TempWorkspace> {
  const safePrefix = sanitizeSegment(prefix) || 'workspace';
  const safeRequestId = sanitizeSegment(requestId) || 'request';
  const workspacePrefix = join(tmpdir(), `${safePrefix}-${safeRequestId}-`);
  const dir = await mkdtemp(workspacePrefix);

  let cleanupPromise: Promise<void> | null = null;

  return {
    dir,
    inputPath: join(dir, 'input.webm'),
    outputPath: join(dir, 'output.wav'),
    cleanup: async () => {
      if (!cleanupPromise) {
        cleanupPromise = rm(dir, { recursive: true, force: true }).catch(() => undefined);
      }
      await cleanupPromise;
    },
  };
}
