import { spawn } from 'child_process';

export class ConvertTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Audio conversion timed out after ${timeoutMs}ms.`);
    this.name = 'ConvertTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export class ConvertFailedError extends Error {
  readonly exitCode?: number | null;
  readonly stderr?: string;
  override readonly cause?: unknown;

  constructor(
    message: string,
    options?: {
      exitCode?: number | null;
      stderr?: string;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = 'ConvertFailedError';
    this.exitCode = options?.exitCode;
    this.stderr = options?.stderr;
    this.cause = options?.cause;
  }
}

export interface ConvertToWavParams {
  inputPath: string;
  outputPath: string;
  timeoutMs: number;
  onKill?: (kill: () => void) => void;
  ffmpegPath?: string;
}

function resolveFfmpegStaticPath(moduleValue: unknown): string | null {
  if (typeof moduleValue === 'string' && moduleValue.trim().length > 0) {
    return moduleValue;
  }

  if (moduleValue && typeof moduleValue === 'object' && 'default' in moduleValue) {
    const defaultExport = (moduleValue as { default?: unknown }).default;
    if (typeof defaultExport === 'string' && defaultExport.trim().length > 0) {
      return defaultExport;
    }
  }

  return null;
}

async function resolveFfmpegPath(configuredPath?: string): Promise<string> {
  if (configuredPath && configuredPath.trim().length > 0) {
    return configuredPath.trim();
  }

  if (process.env.AUDIO_CONVERT_FFMPEG_PATH?.trim()) {
    return process.env.AUDIO_CONVERT_FFMPEG_PATH.trim();
  }

  try {
    const ffmpegStaticModule = await import('ffmpeg-static').catch(() => null);
    const ffmpegStaticPath = resolveFfmpegStaticPath(ffmpegStaticModule);
    if (ffmpegStaticPath) {
      return ffmpegStaticPath;
    }
  } catch {
    // Fall through to system ffmpeg.
  }

  return 'ffmpeg';
}

export async function convertToWav(params: ConvertToWavParams): Promise<{ ok: true }> {
  const timeoutMs = Math.max(1, Math.floor(params.timeoutMs));
  const ffmpegPath = await resolveFfmpegPath(params.ffmpegPath);
  const ffmpegArgs = [
    '-i',
    params.inputPath,
    '-f',
    'wav',
    '-ar',
    '16000',
    '-ac',
    '1',
    '-sample_fmt',
    's16',
    '-loglevel',
    'error',
    '-y',
    params.outputPath,
  ];

  const child = spawn(ffmpegPath, ffmpegArgs, {
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  let timedOut = false;
  let finished = false;
  let stderr = '';

  const kill = (): void => {
    if (finished || child.killed) {
      return;
    }
    child.kill('SIGKILL');
  };

  params.onKill?.(kill);

  child.stderr?.on('data', (chunk: Buffer | string) => {
    stderr += chunk.toString();
  });

  const timeout = setTimeout(() => {
    timedOut = true;
    kill();
  }, timeoutMs);

  try {
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });

    finished = true;

    if (timedOut) {
      throw new ConvertTimeoutError(timeoutMs);
    }

    if (exitCode !== 0) {
      throw new ConvertFailedError(
        `Audio conversion failed with exit code ${String(exitCode)}.`,
        {
          exitCode,
          stderr: stderr.trim() || undefined,
        }
      );
    }

    return { ok: true };
  } catch (error) {
    finished = true;

    if (error instanceof ConvertTimeoutError || error instanceof ConvertFailedError) {
      throw error;
    }

    if (timedOut) {
      throw new ConvertTimeoutError(timeoutMs);
    }

    throw new ConvertFailedError('Audio conversion process failed to start or exited unexpectedly.', {
      stderr: stderr.trim() || undefined,
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}
