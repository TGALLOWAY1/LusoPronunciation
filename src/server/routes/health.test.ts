import { describe, expect, it } from 'vitest';
import { buildHealthResponse } from './health';
import type { MongoStatus } from '../db/mongoClient';

describe('buildHealthResponse', () => {
  it('returns 200 when MongoDB is connected', async () => {
    const mongoStatus: MongoStatus = {
      connected: true,
      readyState: 1,
      host: 'localhost',
      name: 'lusopronounce',
    };

    const response = await buildHealthResponse(async () => mongoStatus);

    expect(response).toEqual({
      statusCode: 200,
      body: {
        ok: true,
        mongo: mongoStatus,
      },
    });
  });

  it('returns 503 when MongoDB is disconnected', async () => {
    const mongoStatus: MongoStatus = {
      connected: false,
      readyState: 0,
    };

    const response = await buildHealthResponse(async () => mongoStatus);

    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual({
      ok: false,
      error: 'MongoDB is not connected.',
      mongo: mongoStatus,
    });
  });

  it('returns 500 when MongoDB status lookup throws', async () => {
    const response = await buildHealthResponse(async () => {
      throw new Error('status lookup failed');
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      ok: false,
      error: 'status lookup failed',
      mongo: {
        connected: false,
        readyState: 0,
      },
    });
  });
});
