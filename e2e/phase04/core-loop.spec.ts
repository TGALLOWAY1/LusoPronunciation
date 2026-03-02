import { expect, test, type Page } from '@playwright/test';

type MediaScenario = 'success' | 'silent' | 'short' | 'micDenied';

function buildAssessmentPayload(attemptId: string) {
  return {
    rawAzure: {
      RecognitionStatus: 'Success',
      NBest: [
        {
          PronunciationAssessment: {
            AccuracyScore: 83,
            FluencyScore: 80,
            CompletenessScore: 86,
            PronScore: 82,
          },
          Words: [
            {
              Word: 'ola',
              PronunciationAssessment: { AccuracyScore: 80, ErrorType: 'None' },
            },
            {
              Word: 'mundo',
              PronunciationAssessment: { AccuracyScore: 82, ErrorType: 'None' },
            },
          ],
        },
      ],
    },
    attemptScore: {
      attemptId,
      sentenceId: 'sentence-e2e',
      overallAccuracy: 83,
      fluency: 80,
      completeness: 86,
      prosody: null,
      createdAt: '2026-03-02T00:00:00.000Z',
      wordScores: [
        { word: 'ola', accuracy: 80, errorType: 'None' },
        { word: 'mundo', accuracy: 82, errorType: 'None' },
      ],
    },
    telemetry: {
      requestId: `req-${attemptId}`,
      fallbackUsed: false,
      serverTimingsMs: {
        convertMs: 2,
        azureMs: 40,
        normalizeMs: 3,
      },
    },
    fallbackUsed: false,
  };
}

async function enableE2EMediaScenario(
  page: Page,
  mediaScenario: MediaScenario
): Promise<void> {
  await page.addInitScript((scenario: MediaScenario) => {
    window.__E2E__ = {
      enabled: true,
      mediaScenario: scenario,
      mediaStopDelayMs: 8,
    };
  }, mediaScenario);
}

async function goToSentencePractice(page: Page): Promise<void> {
  await page.goto('/practice/sentence');
  await expect(page.getByRole('heading', { name: 'Sentence Practice' })).toBeVisible();
}

async function recordOneAttempt(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start recording' }).click();
  await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await expect(page.getByRole('button', { name: 'Submit recording' })).toBeVisible();
}

test.describe('Phase 04 core learner loop e2e', () => {
  test('happy path: record -> submit -> feedback', async ({ page }) => {
    await enableE2EMediaScenario(page, 'success');

    let requestCount = 0;
    await page.route('**/api/pronunciation/assessment', async (route) => {
      requestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildAssessmentPayload(`happy-${requestCount}`)),
      });
    });

    await goToSentencePractice(page);
    await recordOneAttempt(page);
    await page.getByRole('button', { name: 'Submit recording' }).click();

    await expect(page.locator('[aria-label="Next step coaching"]')).toBeVisible();
    expect(requestCount).toBe(1);
  });

  test('cancel analysis: cancel in-flight submit, then retry and succeed', async ({ page }) => {
    await enableE2EMediaScenario(page, 'success');

    let requestCount = 0;
    let releaseFirstRequest: (() => void) | null = null;

    await page.route('**/api/pronunciation/assessment', async (route) => {
      requestCount += 1;
      if (requestCount === 1) {
        await new Promise<void>((resolve) => {
          releaseFirstRequest = resolve;
        });
      }

      try {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildAssessmentPayload(`cancel-${requestCount}`)),
        });
      } catch {
        await route.abort().catch(() => undefined);
      }
    });

    await goToSentencePractice(page);
    await recordOneAttempt(page);
    await page.getByRole('button', { name: 'Submit recording' }).click();

    await expect(page.getByRole('button', { name: 'Cancel analysis' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel analysis' }).click();

    await expect(page.getByRole('button', { name: 'Cancel analysis' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Submit recording' })).toBeEnabled();

    releaseFirstRequest?.();
    await page.getByRole('button', { name: 'Submit recording' }).click();

    await expect(page.locator('[aria-label="Next step coaching"]')).toBeVisible();
    expect(requestCount).toBeGreaterThanOrEqual(2);
  });

  test('silence/short quality gate blocks submit and prevents network request', async ({ page }) => {
    await enableE2EMediaScenario(page, 'short');

    let requestCount = 0;
    await page.route('**/api/pronunciation/assessment', async (route) => {
      requestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildAssessmentPayload(`unexpected-${requestCount}`)),
      });
    });

    await goToSentencePractice(page);
    await recordOneAttempt(page);
    await page.getByRole('button', { name: 'Submit recording' }).click();

    await expect(page.getByText(/Too short - try speaking the whole sentence/i)).toBeVisible();
    expect(requestCount).toBe(0);
  });

  test('mic denied shows guidance UI', async ({ page }) => {
    await enableE2EMediaScenario(page, 'micDenied');

    await goToSentencePractice(page);
    await page.getByRole('button', { name: 'Start recording' }).click();

    await expect(page.getByText(/Microphone permission denied/i)).toBeVisible();
  });
});
