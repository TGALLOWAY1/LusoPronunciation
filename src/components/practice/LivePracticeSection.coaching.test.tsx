import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttemptScore } from '@/types/pronunciation';
import LivePracticeSection from './LivePracticeSection';

let mockHookState: any;

const mockResetRecording = vi.fn();
const mockSubmitAttempt = vi.fn();
const mockCancelAnalysis = vi.fn();

vi.mock('@/hooks/useLivePronunciationPractice', () => ({
  useLivePronunciationPractice: () => mockHookState,
}));

vi.mock('@/components/pronunciation', () => ({
  PronunciationFeedbackPanel: () => <div data-testid="feedback-panel" />,
}));

vi.mock('@/components/pronunciation/shared', () => ({
  adaptWordScoresToNormalized: () => [],
  buildWordAudioVariantsForSentence: () => [],
  enrichWordsWithCanonicalData: (_sentence: unknown, words: unknown[]) => words,
}));

vi.mock('@/state/settingsStore', () => ({
  useSettingsStore: () => ({ selectedVoice: 'male' }),
}));

vi.mock('@/hooks/useCanonicalWordMap', () => ({
  useCanonicalWordMap: () => new Map(),
}));

vi.mock('@/components/common/PremiumRecordButton', () => ({
  default: ({ isRecording, onClick }: { isRecording: boolean; onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      {isRecording ? 'Stop' : 'Record'}
    </button>
  ),
}));

const sentence = {
  id: 'sentence-1',
  textPt: 'Minha galho carro pão',
  translationEn: 'My branch car bread',
  difficulty: 2,
  categoryId: 'travel',
  categoryLabelEn: 'Travel',
  categoryLabelPt: 'Viagem',
  audioMaleUrl: '/audio/sentence-male.wav',
  audioFemaleUrl: '/audio/sentence-female.wav',
};

function createAttempt(overrides: Partial<AttemptScore>): AttemptScore {
  return {
    attemptId: 'attempt-1',
    sentenceId: sentence.id,
    overallAccuracy: 82,
    fluency: 84,
    completeness: 84,
    wordScores: [],
    createdAt: '2026-03-02T00:00:00.000Z',
    ...overrides,
  };
}

function setHookState(currentAttempt: AttemptScore): void {
  mockHookState = {
    isRecording: false,
    audioUrl: 'blob://recording',
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    resetRecording: mockResetRecording,
    submitting: false,
    error: null,
    attemptState: 'scored',
    attempts: [currentAttempt],
    currentAttempt,
    rawAzureResponse: null,
    submitAttempt: mockSubmitAttempt,
    cancelAnalysis: mockCancelAnalysis,
  };
}

describe('LivePracticeSection coaching card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows coaching card after a scored attempt and retry CTA triggers retry handler', () => {
    setHookState(
      createAttempt({
        completeness: 60,
        fluency: 90,
        overallAccuracy: 90,
      })
    );

    render(<LivePracticeSection sentence={sentence} sessionId="session-1" />);

    expect(screen.getByLabelText('Next step coaching')).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: 'Retry sentence' });

    mockResetRecording.mockClear();
    fireEvent.click(retryButton);

    expect(mockResetRecording).toHaveBeenCalledTimes(1);
  });

  it('opens minimal pair drill from CTA on scored attempts that match confusion tags', () => {
    setHookState(
      createAttempt({
        overallAccuracy: 68,
        fluency: 88,
        completeness: 92,
        wordScores: [
          { word: 'carro', accuracy: 61 },
          { word: 'galho', accuracy: 64 },
          { word: 'pão', accuracy: 60 },
        ],
      })
    );

    render(<LivePracticeSection sentence={sentence} sessionId="session-1" />);

    const startDrillButton = screen.getByRole('button', { name: 'Start drill' });

    mockResetRecording.mockClear();
    fireEvent.click(startDrillButton);

    expect(screen.getByText('Minimal pair drill')).toBeInTheDocument();
    expect(mockResetRecording).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Retry sentence' }));
    expect(mockResetRecording).toHaveBeenCalledTimes(1);
  });
});
