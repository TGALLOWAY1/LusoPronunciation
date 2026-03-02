import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const spawnMock = vi.fn();

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
  default: {
    spawn: (...args: unknown[]) => spawnMock(...args),
  },
}));

import {
  convertToWav,
  ConvertFailedError,
  ConvertTimeoutError,
} from './audioConversion';

type MockChildProcess = EventEmitter & {
  stderr: EventEmitter;
  killed: boolean;
  kill: ReturnType<typeof vi.fn>;
};

function createMockChildProcess(): MockChildProcess {
  const child = new EventEmitter() as MockChildProcess;
  child.stderr = new EventEmitter();
  child.killed = false;
  child.kill = vi.fn(() => {
    child.killed = true;
    child.emit('close', null);
    return true;
  });
  return child;
}

describe('convertToWav', () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('throws ConvertTimeoutError when conversion exceeds timeout', async () => {
    vi.useFakeTimers();
    const child = createMockChildProcess();
    spawnMock.mockReturnValue(child);

    const promise = convertToWav({
      inputPath: '/tmp/input.webm',
      outputPath: '/tmp/output.wav',
      timeoutMs: 5,
      ffmpegPath: 'ffmpeg',
    });
    const rejection = expect(promise).rejects.toBeInstanceOf(ConvertTimeoutError);

    await vi.advanceTimersByTimeAsync(10);
    await rejection;
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  it('throws ConvertFailedError when ffmpeg exits non-zero', async () => {
    const child = createMockChildProcess();
    spawnMock.mockReturnValue(child);

    const promise = convertToWav({
      inputPath: '/tmp/input.webm',
      outputPath: '/tmp/output.wav',
      timeoutMs: 1000,
      ffmpegPath: 'ffmpeg',
    });

    await Promise.resolve();
    child.stderr.emit('data', Buffer.from('conversion failed'));
    child.emit('close', 1);

    await expect(promise).rejects.toBeInstanceOf(ConvertFailedError);
  });
});
