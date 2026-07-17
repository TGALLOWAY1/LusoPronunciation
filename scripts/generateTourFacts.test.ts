import { describe, expect, it } from 'vitest';
import { TOUR_FACTS } from '../src/pages/tour/tourFacts.generated';
import { deriveTourFacts } from './generateTourFacts';

describe('generated tour facts', () => {
  it('matches the current repository data', async () => {
    await expect(deriveTourFacts()).resolves.toEqual(TOUR_FACTS);
  });
});
