import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SentenceBuilderPage from './SentenceBuilderPage';
import * as customSentencesApi from '@/api/customSentences';
import type { CustomSentenceDto } from '@/shared/types/customSentence';

vi.mock('@/api/customSentences', async () => {
  const actual = await vi.importActual<typeof import('@/api/customSentences')>(
    '@/api/customSentences'
  );
  return {
    ...actual,
    createCustomSentence: vi.fn(),
  };
});

vi.mock('@/hooks/useAudioPlayer', () => ({
  useAudioPlayer: () => ({
    play: vi.fn(),
    pause: vi.fn(),
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    isLoading: false,
    error: null,
  }),
}));

const mockCreate = customSentencesApi.createCustomSentence as unknown as ReturnType<
  typeof vi.fn
>;

function buildSentence(
  overrides: Partial<CustomSentenceDto> = {}
): CustomSentenceDto {
  return {
    id: 'sentence-1',
    userId: 'user-1',
    sourceTextEn: 'I need to buy bread',
    targetTextPt: 'Eu preciso comprar pão.',
    normalizedTextPt: 'eu preciso comprar pao',
    locale: 'pt-BR',
    ttsAudioUrl: '/audio/custom/user-1/sentence-1.wav',
    status: 'ready',
    tokens: [
      {
        position: 0,
        surfaceForm: 'Eu',
        normalizedForm: 'eu',
        resolutionType: 'exact_match',
        wordEntryId: 'w_eu',
        confidence: 'high',
      },
      {
        position: 1,
        surfaceForm: 'preciso',
        normalizedForm: 'preciso',
        resolutionType: 'exact_match',
        wordEntryId: 'w_preciso',
        confidence: 'high',
      },
      {
        position: 2,
        surfaceForm: 'xilogravura',
        normalizedForm: 'xilogravura',
        resolutionType: 'generated',
        generatedPronunciationId: 'gen-1',
        confidence: 'medium',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('SentenceBuilderPage', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form and requires a non-empty sentence before enabling submit', () => {
    render(
      <MemoryRouter>
        <SentenceBuilderPage />
      </MemoryRouter>
    );

    const submit = screen.getByRole('button', { name: /translate & preview/i });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/english sentence/i), {
      target: { value: 'I need to buy bread' },
    });
    expect(submit).not.toBeDisabled();
  });

  it('submits and shows the preview with color-coded tokens', async () => {
    const sentence = buildSentence();
    mockCreate.mockResolvedValue({
      sentence,
      tokens: sentence.tokens,
      audioUrl: sentence.ttsAudioUrl,
      status: sentence.status,
    });

    render(
      <MemoryRouter>
        <SentenceBuilderPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/english sentence/i), {
      target: { value: 'I need to buy bread' },
    });
    fireEvent.click(screen.getByRole('button', { name: /translate & preview/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Eu preciso comprar pão.')
      ).toBeInTheDocument();
    });

    // Token chips rendered for each surface form
    expect(screen.getByText('Eu')).toBeInTheDocument();
    expect(screen.getByText('preciso')).toBeInTheDocument();
    expect(screen.getByText('xilogravura')).toBeInTheDocument();

    // Add to Practice CTA appears
    expect(
      screen.getByRole('button', { name: /add to practice/i })
    ).toBeInTheDocument();
  });

  it('shows a friendly error message on API failure', async () => {
    mockCreate.mockRejectedValue(
      new customSentencesApi.CustomSentenceApiError('boom', {
        status: 502,
        code: 'TRANSLATION_FAILED',
      })
    );

    render(
      <MemoryRouter>
        <SentenceBuilderPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/english sentence/i), {
      target: { value: 'hello' },
    });
    fireEvent.click(screen.getByRole('button', { name: /translate & preview/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/translation service is not available/i)
      ).toBeInTheDocument();
    });
  });
});
