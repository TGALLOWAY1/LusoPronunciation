import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FocusAreasCard from './FocusAreasCard';

describe('FocusAreasCard', () => {
  it('uses English sound labels and reference words instead of provider IDs', () => {
    render(
      <FocusAreasCard
        words={[
          {
            id: 'rio',
            text: 'Rio',
            accuracyScore: 68,
            phonemes: [
              { symbol: 'R_TAP', score: 62, isProblem: true },
              { symbol: 'IY', score: 84, isProblem: false },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText(/“H” sound/).closest('li')).toHaveTextContent('“H” sound (like hat)');
    expect(screen.queryByText('R_TAP')).not.toBeInTheDocument();
  });
});
