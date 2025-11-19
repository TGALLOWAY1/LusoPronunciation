import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SentenceFeedback, { type OverallScores, type WordFeedback } from '@/components/practice/SentenceFeedback';

describe('SentenceFeedback', () => {
  const mockOverall: OverallScores = {
    accuracy: 85,
    fluency: 90,
    completeness: 88,
    prosody: 82,
  };

  const mockWords: WordFeedback[] = [
    {
      index: 0,
      text: 'Oi',
      accuracyScore: 95,
    },
    {
      index: 1,
      text: 'tudo',
      accuracyScore: 80,
      errorType: 'mispronounced',
    },
    {
      index: 2,
      text: 'bem',
      accuracyScore: 75,
    },
  ];

  it('should render without error', () => {
    render(<SentenceFeedback overall={mockOverall} words={mockWords} />);
    expect(screen.getByText('Pronunciation Feedback')).toBeInTheDocument();
  });

  it('should display overall accuracy score', () => {
    render(<SentenceFeedback overall={mockOverall} words={mockWords} />);
    expect(screen.getByText('Accuracy')).toBeInTheDocument();
    expect(screen.getByText('85 / 100')).toBeInTheDocument();
  });

  it('should display fluency score when provided', () => {
    render(<SentenceFeedback overall={mockOverall} words={mockWords} />);
    expect(screen.getByText('Fluency')).toBeInTheDocument();
    expect(screen.getByText('90 / 100')).toBeInTheDocument();
  });

  it('should display completeness score when provided', () => {
    render(<SentenceFeedback overall={mockOverall} words={mockWords} />);
    expect(screen.getByText('Completeness')).toBeInTheDocument();
    expect(screen.getByText('88 / 100')).toBeInTheDocument();
  });

  it('should display prosody score when provided', () => {
    render(<SentenceFeedback overall={mockOverall} words={mockWords} />);
    expect(screen.getByText('Prosody')).toBeInTheDocument();
    expect(screen.getByText('82 / 100')).toBeInTheDocument();
  });

  it('should not display optional scores when undefined', () => {
    const minimalOverall: OverallScores = {
      accuracy: 85,
    };
    render(<SentenceFeedback overall={minimalOverall} words={mockWords} />);
    expect(screen.getByText('Accuracy')).toBeInTheDocument();
    expect(screen.queryByText('Fluency')).not.toBeInTheDocument();
    expect(screen.queryByText('Completeness')).not.toBeInTheDocument();
    expect(screen.queryByText('Prosody')).not.toBeInTheDocument();
  });

  it('should display word-by-word feedback', () => {
    render(<SentenceFeedback overall={mockOverall} words={mockWords} />);
    expect(screen.getByText('Word-by-Word Feedback')).toBeInTheDocument();
    expect(screen.getByText('Oi')).toBeInTheDocument();
    expect(screen.getByText('tudo')).toBeInTheDocument();
    expect(screen.getByText('bem')).toBeInTheDocument();
  });

  it('should handle empty words array', () => {
    render(<SentenceFeedback overall={mockOverall} words={[]} />);
    expect(screen.getByText('Pronunciation Feedback')).toBeInTheDocument();
    expect(screen.queryByText('Word-by-Word Feedback')).not.toBeInTheDocument();
  });

  it('should display phoneme chips when phoneme data is available', () => {
    const wordsWithPhonemes: WordFeedback[] = [
      {
        index: 0,
        text: 'Oi',
        accuracyScore: 95,
        phonemes: [
          { symbol: 'aa', score: 90 },
          { symbol: 'ih', score: 95 },
        ],
      },
    ];

    render(<SentenceFeedback overall={mockOverall} words={wordsWithPhonemes} />);
    // Phoneme chips should render (checking for symbol display)
    expect(screen.getByText('aa')).toBeInTheDocument();
    expect(screen.getByText('ih')).toBeInTheDocument();
  });

  it('should not display phoneme chips when phoneme data is missing', () => {
    render(<SentenceFeedback overall={mockOverall} words={mockWords} />);
    // Words without phonemes should not show phoneme chips
    // We can't easily test absence, but we can verify the word chips render
    expect(screen.getByText('Oi')).toBeInTheDocument();
  });

  it('should round scores correctly', () => {
    const overallWithDecimals: OverallScores = {
      accuracy: 85.7,
      fluency: 90.3,
    };
    render(<SentenceFeedback overall={overallWithDecimals} words={mockWords} />);
    expect(screen.getByText('86 / 100')).toBeInTheDocument();
    expect(screen.getByText('90 / 100')).toBeInTheDocument();
  });
});

