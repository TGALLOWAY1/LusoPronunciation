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

  it('updates the selected sound and coaching from deterministic repository metadata', () => {
    render(<InteractiveAttemptFrame />);

    expect(screen.getAllByText(/^illustrative$/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /inspect mãe sound ɐ̃/i }));

    expect(screen.getByText(/touch your nose; you should feel vibration/i)).toBeInTheDocument();
    expect(screen.getByText(/selected sound is outlined/i)).toBeInTheDocument();
  });

  it('describes the current provider granularity without inventing phoneme scores', () => {
    render(<AssessmentTransformation />);

    expect(screen.getByText(/word granularity/i)).toBeInTheDocument();
    expect(screen.getByText(/no phoneme score is invented/i)).toBeInTheDocument();
    expect(screen.getByText(/NH in “minha”/i)).toBeInTheDocument();
  });

  it('keeps the seeded capture state local to the tour', () => {
    render(<WalkthroughFrame activeStep={1} />);

    expect(screen.getByText(/seeded recording ready/i)).toBeInTheDocument();
    expect(screen.getByText(/never requests microphone permission/i)).toBeInTheDocument();
  });
});
