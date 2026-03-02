import { describe, expect, it } from 'vitest';
import { computeMedian, computePercentile } from './attemptMetrics';

describe('metrics percentiles helpers', () => {
  it('returns null for empty input', () => {
    expect(computeMedian([])).toBeNull();
    expect(computePercentile([], 0.95)).toBeNull();
  });

  it('computes p50 as median for odd and even lengths', () => {
    expect(computeMedian([30, 10, 20])).toBe(20);
    expect(computeMedian([40, 10, 30, 20])).toBe(25);
  });

  it('computes p95 using ceil(0.95 * n) - 1 index on sorted values', () => {
    const values = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
    expect(computePercentile(values, 0.95)).toBe(100);
  });
});
