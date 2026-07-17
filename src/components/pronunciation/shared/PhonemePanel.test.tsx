import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PhonemePanel from './PhonemePanel';

describe('Pronunciation guide panel', () => {
  it('shows eye dialect, reference words, and the spelling rule instead of IPA', () => {
    render(
      <PhonemePanel
        word={{
          id: 'rio',
          text: 'Rio',
          accuracyScore: 76,
          score: 76,
          guidePhonemes: ['R_TAP', 'IY', 'OW'],
          phonemes: [
            { symbol: 'R_TAP', score: 72, isProblem: true },
            { symbol: 'IY', score: 84, isProblem: false },
            { symbol: 'OW', score: 82, isProblem: false },
          ],
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Pronunciation guide' })).toBeInTheDocument();
    expect(screen.getByText('Hee-oh')).toBeInTheDocument();
    expect(screen.getByText(/R at the start/).closest('p')).toHaveTextContent('R at the start = "H" sound (like hat)');
    expect(screen.getByRole('heading', { name: 'Reference words' }).closest('section')).toHaveTextContent('H like hat');
    expect(screen.getByRole('heading', { name: 'Focus for your next try' }).closest('section')).toHaveTextContent('“H”');
    expect(screen.queryByText('R_TAP')).not.toBeInTheDocument();
    expect(screen.queryByText(/\/ɾ\//)).not.toBeInTheDocument();
  });

  it('does not claim every sound scored well when phonemes are unscored guide-only reference data', () => {
    render(
      <PhonemePanel
        word={{
          id: 'obrigado',
          text: 'obrigado',
          accuracyScore: 42,
          score: 42,
          guidePhonemes: ['OW', 'B', 'R_TAP', 'IY', 'G', 'AA', 'D', 'OW'],
          // Azure only returned a word-level score here (no per-phoneme
          // scoring), so these are unscored canonical reference entries.
          phonemes: [
            { symbol: 'OW' },
            { symbol: 'B' },
            { symbol: 'R_TAP' },
          ],
        }}
      />,
    );

    expect(screen.queryByText(/Every sound scored well/)).not.toBeInTheDocument();
  });
});
