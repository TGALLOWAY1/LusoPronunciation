import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  AssessmentTransformation,
  InteractiveAttemptFrame,
  WalkthroughFrame,
} from './TourVisuals';

const IPA_GLYPHS = /[ɐɲʎʒʃɛɔɾ̃]/;

describe('tour evidence visuals', () => {
  beforeAll(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  });

  it('renders the production word-coaching UI and switches its selected word', () => {
    const { container } = render(<InteractiveAttemptFrame />);

    expect(screen.getAllByText(/^illustrative$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/score 66\/100/i)).toBeInTheDocument();
    expect(screen.getByText(/say it like/i)).toBeInTheDocument();
    expect(screen.getByText('MYE')).toBeInTheDocument();
    expect(screen.queryByText('AN_NASAL')).not.toBeInTheDocument();
    expect(screen.queryByText('IPA')).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(IPA_GLYPHS);

    fireEvent.click(screen.getByRole('button', { name: 'Minha' }));

    expect(screen.getByText(/score 82\/100/i)).toBeInTheDocument();
    expect(screen.getByText('MEEN-yah')).toBeInTheDocument();
    expect(screen.getAllByText(/^NY$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/canyon/i).length).toBeGreaterThan(0);
  });

  it('describes provider granularity without exposing IPA to learners', () => {
    const { container } = render(<AssessmentTransformation />);

    expect(screen.getByText(/word granularity/i)).toBeInTheDocument();
    expect(screen.getByText(/never invent a missing sound score/i)).toBeInTheDocument();
    expect(screen.getByText(/Say “minha” like MEEN-yah/i)).toBeInTheDocument();
    expect(screen.getByText(/The spelling rule/i)).toBeInTheDocument();
    expect(screen.queryByText('IPA')).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(IPA_GLYPHS);
  });

  it('keeps the seeded capture state local to the tour', () => {
    render(<WalkthroughFrame activeStep={1} />);

    expect(screen.getByText(/seeded recording ready/i)).toBeInTheDocument();
    expect(screen.getByText(/microphone access begins only in authenticated practice/i)).toBeInTheDocument();
  });

  it('uses respelling, reference words, and spelling rules in the walkthrough', () => {
    const { container } = render(<WalkthroughFrame activeStep={3} />);

    expect(screen.getByText('MEEN-yah')).toBeInTheDocument();
    expect(screen.getAllByText(/^NY$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/canyon/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/The spelling rule/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(IPA_GLYPHS);
  });
});
