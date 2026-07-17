import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  AssessmentTransformation,
  InteractiveAttemptFrame,
  WalkthroughFrame,
} from './TourVisuals';

describe('tour evidence visuals', () => {
  beforeAll(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  });

  it('renders the production word-coaching UI and switches its selected word', () => {
    render(<InteractiveAttemptFrame />);

    expect(screen.getAllByText(/^illustrative$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/score 66\/100/i)).toBeInTheDocument();
    expect(screen.getByText(/say it like/i)).toBeInTheDocument();
    expect(screen.getByText('Muhny')).toBeInTheDocument();
    expect(screen.queryByText('AN_NASAL')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Minha' }));

    expect(screen.getByText(/score 82\/100/i)).toBeInTheDocument();
    expect(screen.getByText('Mee-nyuh')).toBeInTheDocument();
    expect(screen.getAllByText(/^NY$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/canyon/i).length).toBeGreaterThan(0);
  });

  it('describes the current provider granularity without inventing phoneme scores', () => {
    render(<AssessmentTransformation />);

    expect(screen.getByText(/word granularity/i)).toBeInTheDocument();
    expect(screen.getByText(/never invent a missing sound score/i)).toBeInTheDocument();
    expect(screen.getByText(/NH in “minha”/i)).toBeInTheDocument();
  });

  it('keeps the seeded capture state local to the tour', () => {
    render(<WalkthroughFrame activeStep={1} />);

    expect(screen.getByText(/seeded recording ready/i)).toBeInTheDocument();
    expect(screen.getByText(/microphone access begins only in authenticated practice/i)).toBeInTheDocument();
  });
});
