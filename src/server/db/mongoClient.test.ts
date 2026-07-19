import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import './mongoClient';

describe('mongoClient connection visibility', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('logs loudly with a consistent [MongoDB] prefix on disconnected', () => {
    mongoose.connection.emit('disconnected');
    const [firstArg] = errorSpy.mock.calls[errorSpy.mock.calls.length - 1];
    expect(firstArg).toContain('[MongoDB]');
    expect(firstArg).toContain('disconnected');
  });

  it('logs on reconnected', () => {
    mongoose.connection.emit('reconnected');
    const [firstArg] = logSpy.mock.calls[logSpy.mock.calls.length - 1];
    expect(firstArg).toContain('[MongoDB]');
    expect(firstArg).toContain('restored');
  });

  it('logs on connection error with the [MongoDB] prefix', () => {
    mongoose.connection.emit('error', new Error('simulated connection error'));
    const lastCall = errorSpy.mock.calls[errorSpy.mock.calls.length - 1];
    expect(lastCall[0]).toContain('[MongoDB]');
    expect(lastCall[0]).toContain('error');
  });
});
