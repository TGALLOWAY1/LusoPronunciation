import { describe, expect, it } from 'vitest';
import app from './app';

describe('server app module', () => {
  it('exports an express app instance', () => {
    expect(app).toBeDefined();
    expect(typeof app.use).toBe('function');
  });
});
