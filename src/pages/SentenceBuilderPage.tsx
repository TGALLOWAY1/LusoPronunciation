import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageScaffold from '@/components/common/PageScaffold';
import SentenceBuilderForm from '@/components/builder/SentenceBuilderForm';
import SentencePreview from '@/components/builder/SentencePreview';
import {
  createCustomSentence,
  CustomSentenceApiError,
} from '@/api/customSentences';
import type { CustomSentenceDto } from '@/shared/types/customSentence';

export default function SentenceBuilderPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentence, setSentence] = useState<CustomSentenceDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = useCallback(async (englishText: string) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await createCustomSentence({ englishText });
      setSentence(response.sentence);
    } catch (err) {
      if (err instanceof CustomSentenceApiError) {
        setError(friendlyMessage(err));
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not create this sentence. Please try again.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setSentence(null);
    setError(null);
  }, []);

  const handlePractice = useCallback(() => {
    if (!sentence) return;
    navigate('/', {
      state: { customSentenceId: sentence.id },
    });
  }, [navigate, sentence]);

  return (
    <PageScaffold
      title="Sentence Builder"
      subtitle="Type an English sentence. We translate it to Brazilian Portuguese, synthesize native audio, and add it to your personal practice set."
      maxWidth="2xl"
    >
      {!sentence && (
        <SentenceBuilderForm
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          errorMessage={error}
        />
      )}
      {sentence && (
        <SentencePreview
          sentence={sentence}
          onPractice={handlePractice}
          onReset={handleReset}
        />
      )}
    </PageScaffold>
  );
}

function friendlyMessage(err: CustomSentenceApiError): string {
  switch (err.code) {
    case 'INVALID_INPUT':
      return err.message;
    case 'TRANSLATION_FAILED':
      return 'The translation service is not available right now. Please try again in a moment.';
    case 'TTS_FAILED':
      return 'Could not generate native audio for this sentence. Please try again.';
    case 'VALIDATION_FAILED':
      return 'We could not build reliable pronunciation data for this sentence. Try rephrasing or simplifying it.';
    case 'PERSISTENCE_FAILED':
      return 'Saving failed. Please try again.';
    default:
      if (err.status === 401) {
        return 'You need to sign in before using the Sentence Builder.';
      }
      return err.message || 'Something went wrong. Please try again.';
  }
}
