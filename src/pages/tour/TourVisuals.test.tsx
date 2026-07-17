import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RawVsCoached, ScoredAttemptCard } from './TourVisuals';

const IPA_GLYPHS = /[ɐɲʎʒʃɛɔɾ̃]/;

describe('public tour pronunciation visuals', () => {
  it('shows learner-friendly sound labels in the scored-attempt preview', () => {
    const { container } = render(<ScoredAttemptCard />);

    expect(screen.getByText('Sound-by-sound score')).toBeInTheDocument();
    expect(screen.queryByText('IPA')).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(IPA_GLYPHS);
  });

  it('contrasts raw provider IDs with eye-dialect coaching', () => {
    const { container } = render(<RawVsCoached />);

    expect(screen.getByText('Provider sound ID')).toBeInTheDocument();
    expect(screen.getByText('Say it like')).toBeInTheDocument();
    expect(screen.getByText('MYE')).toBeInTheDocument();
    expect(screen.getByText('The spelling rule')).toBeInTheDocument();
    expect(screen.queryByText('IPA')).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(IPA_GLYPHS);
  });
});
