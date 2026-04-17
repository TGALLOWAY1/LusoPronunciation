import { describe, it, expect } from 'vitest';
import { buildApiUrl, API_BASE_URL } from './apiUrl';

describe('buildApiUrl', () => {
  it('returns the path unchanged when no base URL is configured', () => {
    // Default test env leaves VITE_API_BASE_URL unset.
    expect(API_BASE_URL).toBe('');
    expect(buildApiUrl('/api/health')).toBe('/api/health');
  });

  it('rejects paths that do not start with /', () => {
    expect(() => buildApiUrl('api/health')).toThrow(/must start with/);
  });
});
