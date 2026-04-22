import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logStage, timeStage } from './pipelineLogger';

describe('logStage', () => {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    vi.restoreAllMocks();
  });

  it('writes a structured info line by default', () => {
    logStage({
      pipeline: 'custom-sentence',
      stage: 'translate',
      userId: 'u1',
      data: { chars: 19 },
    });

    expect(console.log).toHaveBeenCalledWith(
      '[custom-sentence:translate] {"userId":"u1","chars":19}'
    );
  });

  it('routes warn and error levels to the matching console method', () => {
    logStage({ pipeline: 'p', stage: 's', level: 'warn', data: { kind: 'fallback' } });
    logStage({ pipeline: 'p', stage: 's', level: 'error', data: { error: 'boom' } });

    expect(console.warn).toHaveBeenCalledWith('[p:s] {"kind":"fallback"}');
    expect(console.error).toHaveBeenCalledWith('[p:s] {"error":"boom"}');
  });

  it('survives unserializable payloads', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    expect(() =>
      logStage({ pipeline: 'p', stage: 's', data: cyclic })
    ).not.toThrow();
  });
});

describe('timeStage', () => {
  const originalLog = console.log;
  const originalError = console.error;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    vi.restoreAllMocks();
  });

  it('logs success with a numeric durationMs', async () => {
    const result = await timeStage(
      { pipeline: 'p', stage: 'ok', data: { n: 1 } },
      async () => 'value'
    );
    expect(result).toBe('value');
    const line = (console.log as unknown as vi.Mock).mock.calls[0][0] as string;
    expect(line).toMatch(/\[p:ok\]/);
    expect(line).toMatch(/"durationMs":\d+/);
  });

  it('logs an error and re-throws on failure', async () => {
    await expect(
      timeStage({ pipeline: 'p', stage: 'boom' }, async () => {
        throw new Error('kapow');
      })
    ).rejects.toThrow('kapow');

    const line = (console.error as unknown as vi.Mock).mock.calls[0][0] as string;
    expect(line).toMatch(/\[p:boom\]/);
    expect(line).toMatch(/"error":"kapow"/);
    expect(line).toMatch(/"durationMs":\d+/);
  });
});
