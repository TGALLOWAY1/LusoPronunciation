import { describe, expect, it } from 'vitest';
import { buildHealthResponse, buildReadinessResponse } from './health';
import type { MongoStatus } from '../db/mongoClient';

const speechOk = () => ({ configured: true });
const speechMissing = () => ({ configured: false });

describe('buildHealthResponse', () => {
  it('returns 200 with ok:true when MongoDB and speech are both ready', async () => {
    const mongoStatus: MongoStatus = {
      connected: true,
      readyState: 1,
      host: 'localhost',
      name: 'lusopronounce',
    };

    const response = await buildHealthResponse(async () => mongoStatus, speechOk);

    expect(response).toEqual({
      statusCode: 200,
      body: {
        ok: true,
        mongo: mongoStatus,
        speech: { configured: true },
      },
    });
  });

  it('returns ok:false when Mongo is connected but speech is not configured', async () => {
    const mongoStatus: MongoStatus = {
      connected: true,
      readyState: 1,
      host: 'localhost',
      name: 'lusopronounce',
    };

    const response = await buildHealthResponse(async () => mongoStatus, speechMissing);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: false,
      error: 'Azure Speech credentials are not configured.',
      mongo: mongoStatus,
      speech: { configured: false },
    });
  });

  it('returns 200 with ok:false when MongoDB is disconnected', async () => {
    const mongoStatus: MongoStatus = {
      connected: false,
      readyState: 0,
    };

    const response = await buildHealthResponse(async () => mongoStatus, speechOk);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: false,
      error: 'MongoDB is not connected.',
      mongo: mongoStatus,
      speech: { configured: true },
    });
  });

  it('returns 200 with error when MongoDB status lookup throws', async () => {
    const response = await buildHealthResponse(async () => {
      throw new Error('status lookup failed');
    }, speechOk);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: false,
      error: 'status lookup failed',
      mongo: {
        connected: false,
        readyState: 0,
      },
      speech: { configured: true },
    });
  });
});

describe('buildReadinessResponse', () => {
  it('returns 200 with ok:true when MongoDB is connected', async () => {
    const mongoStatus: MongoStatus = {
      connected: true,
      readyState: 1,
      host: 'localhost',
      name: 'lusopronounce',
    };

    const response = await buildReadinessResponse(async () => mongoStatus);

    expect(response).toEqual({
      statusCode: 200,
      body: { ok: true, mongo: mongoStatus },
    });
  });

  it('returns 503 with ok:false when MongoDB is disconnected', async () => {
    const mongoStatus: MongoStatus = {
      connected: false,
      readyState: 0,
    };

    const response = await buildReadinessResponse(async () => mongoStatus);

    expect(response).toEqual({
      statusCode: 503,
      body: { ok: false, mongo: mongoStatus },
    });
  });

  it('does not affect buildHealthResponse (liveness stays 200 unconditionally)', async () => {
    const mongoStatus: MongoStatus = { connected: false, readyState: 0 };
    const liveness = await buildHealthResponse(async () => mongoStatus, () => ({ configured: true }));
    const readiness = await buildReadinessResponse(async () => mongoStatus);

    expect(liveness.statusCode).toBe(200);
    expect(readiness.statusCode).toBe(503);
  });
});
