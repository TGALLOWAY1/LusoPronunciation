import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import SentenceFeedback from '@/components/practice/SentenceFeedback';
import { PronunciationFeedbackPanel } from '@/components/pronunciation';
import {
  adaptWordScoresToNormalized,
  buildWordAudioVariantsForSentence,
  enrichWordsWithCanonicalData,
} from '@/components/pronunciation/shared';

vi.mock('@/components/pronunciation', () => ({
  PronunciationFeedbackPanel: vi.fn(() => <div data-testid="feedback-panel" />),
}));

vi.mock('@/components/pronunciation/shared', () => ({
  adaptWordScoresToNormalized: vi.fn(() => []),
  buildWordAudioVariantsForSentence: vi.fn(() => []),
  enrichWordsWithCanonicalData: vi.fn((_sentence, words) => words),
}));

vi.mock('@/state/settingsStore', () => ({
  useSettingsStore: vi.fn(() => ({ selectedVoice: 'female' })),
}));

vi.mock('@/hooks/useCanonicalWordMap', () => ({
  useCanonicalWordMap: vi.fn(() => null),
}));

describe('SentenceFeedback', () => {
  const mockAttempt = {
    attemptId: 'attempt-1',
    sentenceId: 'sentence-1',
    overallAccuracy: 85,
    fluency: 90,
    completeness: 88,
    prosody: 82,
    wordScores: [
      {
        word: 'Oi',
        accuracy: 95,
      },
    ],
    createdAt: '2026-03-22T12:00:00.000Z',
  };

  const normalizedWords = [
    {
      index: 0,
      text: 'Oi',
      accuracyScore: 95,
      score: 95,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(PronunciationFeedbackPanel).mockImplementation(() => (
      <div data-testid="feedback-panel" />
    ));
    vi.mocked(adaptWordScoresToNormalized).mockReturnValue(normalizedWords);
    vi.mocked(enrichWordsWithCanonicalData).mockImplementation((_sentence, words) => words);
    vi.mocked(buildWordAudioVariantsForSentence).mockReturnValue([
      {
        type: 'native',
        url: '/audio/oi.mp3',
        wordIndex: 0,
      },
    ]);
  });

  it('passes derived panel props for an explicit current attempt', () => {
    const sentence = {
      textPt: 'Oi',
      translationEn: 'Hi',
      difficulty: 1,
    } as any;

    render(
      <SentenceFeedback
        sentence={sentence}
        attempts={[mockAttempt]}
        currentAttempt={mockAttempt}
        rawAzureResponse={{ raw: true }}
      />
    );

    expect(adaptWordScoresToNormalized).toHaveBeenCalledWith(mockAttempt.wordScores, { raw: true });
    expect(enrichWordsWithCanonicalData).toHaveBeenCalledWith(sentence, normalizedWords, null);
    expect(buildWordAudioVariantsForSentence).toHaveBeenCalledWith(sentence, 'female');

    const latestProps = vi.mocked(PronunciationFeedbackPanel).mock.lastCall?.[0];
    expect(latestProps).toMatchObject({
      attempts: [mockAttempt],
      currentAttempt: mockAttempt,
      sentenceText: 'Oi',
      translationText: 'Hi',
      difficulty: 1,
      hideHeaderContent: true,
      showDevControls: false,
      wordAudios: [
        {
          type: 'native',
          url: '/audio/oi.mp3',
          wordIndex: 0,
        },
      ],
      words: normalizedWords,
    });
  });

  it('uses the most recent attempt when currentAttempt is omitted', () => {
    const attempts = [
      mockAttempt,
      {
        ...mockAttempt,
        attemptId: 'attempt-older',
        createdAt: '2026-03-21T12:00:00.000Z',
      },
    ];

    render(<SentenceFeedback attempts={attempts} fallbackText="Fallback sentence" />);

    const latestProps = vi.mocked(PronunciationFeedbackPanel).mock.lastCall?.[0];
    expect(latestProps?.currentAttempt).toBe(mockAttempt);
    expect(latestProps?.sentenceText).toBe('Fallback sentence');
  });

  it('passes null currentAttempt and undefined words when there are no attempts', () => {
    vi.mocked(adaptWordScoresToNormalized).mockReturnValue([]);

    render(<SentenceFeedback fallbackText="No attempts yet" />);

    const latestProps = vi.mocked(PronunciationFeedbackPanel).mock.lastCall?.[0];
    expect(latestProps).toMatchObject({
      attempts: [],
      currentAttempt: null,
      sentenceText: 'No attempts yet',
      words: undefined,
      wordAudios: undefined,
    });
  });
});
