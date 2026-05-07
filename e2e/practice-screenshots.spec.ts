import { mkdirSync } from 'fs';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';

const OUTPUT_DIR = path.resolve(process.cwd(), 'docs/assets/practice');

type MediaScenario = 'success' | 'silent' | 'short' | 'micDenied';

/**
 * Mock Azure response for "Estou com fome." — the first sentence in
 * masterSentences.json (gemini_food_001), which auto-loads on the practice
 * page. Per-word `Phonemes` arrays use canonical IDs from
 * data/phoneme_metadata.json so the PhonemePanel renders rich tips
 * (English approximations, articulation hints, example words).
 */
function buildAssessmentPayload(attemptId: string) {
  const wordPhonemes = {
    Estou: [
      { Phoneme: 'EH', PronunciationAssessment: { AccuracyScore: 70 } },
      { Phoneme: 'S', PronunciationAssessment: { AccuracyScore: 92 } },
      { Phoneme: 'T', PronunciationAssessment: { AccuracyScore: 88 } },
      { Phoneme: 'OW', PronunciationAssessment: { AccuracyScore: 84 } },
    ],
    com: [
      { Phoneme: 'K', PronunciationAssessment: { AccuracyScore: 95 } },
      { Phoneme: 'ON_NASAL', PronunciationAssessment: { AccuracyScore: 90 } },
    ],
    fome: [
      { Phoneme: 'F', PronunciationAssessment: { AccuracyScore: 86 } },
      { Phoneme: 'OW', PronunciationAssessment: { AccuracyScore: 74 } },
      { Phoneme: 'M', PronunciationAssessment: { AccuracyScore: 91 } },
      { Phoneme: 'AH', PronunciationAssessment: { AccuracyScore: 68 } },
    ],
  } as const;

  return {
    rawAzure: {
      RecognitionStatus: 'Success',
      NBest: [
        {
          PronunciationAssessment: {
            AccuracyScore: 84,
            FluencyScore: 81,
            CompletenessScore: 100,
            PronScore: 83,
          },
          Words: [
            {
              Word: 'Estou',
              PronunciationAssessment: { AccuracyScore: 82, ErrorType: 'None' },
              Phonemes: wordPhonemes.Estou,
            },
            {
              Word: 'com',
              PronunciationAssessment: { AccuracyScore: 93, ErrorType: 'None' },
              Phonemes: wordPhonemes.com,
            },
            {
              Word: 'fome',
              PronunciationAssessment: { AccuracyScore: 76, ErrorType: 'Mispronunciation' },
              Phonemes: wordPhonemes.fome,
            },
          ],
        },
      ],
    },
    attemptScore: {
      attemptId,
      sentenceId: 'gemini_food_001',
      overallAccuracy: 84,
      fluency: 81,
      completeness: 100,
      prosody: 78,
      createdAt: new Date().toISOString(),
      wordScores: [
        { word: 'Estou', accuracy: 82, errorType: 'None' },
        { word: 'com', accuracy: 93, errorType: 'None' },
        { word: 'fome', accuracy: 76, errorType: 'Mispronunciation' },
      ],
    },
    telemetry: {
      requestId: `req-${attemptId}`,
      fallbackUsed: false,
      serverTimingsMs: { convertMs: 2, azureMs: 40, normalizeMs: 3 },
    },
    fallbackUsed: false,
  };
}

async function enableE2EMediaScenario(page: Page, scenario: MediaScenario) {
  await page.addInitScript((s: MediaScenario) => {
    (window as unknown as { __E2E__: unknown }).__E2E__ = {
      enabled: true,
      mediaScenario: s,
      mediaStopDelayMs: 8,
    };
  }, scenario);
}

async function seedAuthToken(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('luso_auth_token', 'e2e-screenshot-token');
  });
}

async function disableAnimations(page: Page) {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.addStyleTag({
    content:
      '*{animation-duration:0s !important;animation-delay:0s !important;transition-duration:0s !important;scroll-behavior:auto !important;}',
  });
}

test.use({
  viewport: { width: 1440, height: 1100 },
  launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {},
});

test.describe('Practice sentence screenshots', () => {
  test('capture before and after submitting a recording', async ({ page }) => {
    mkdirSync(OUTPUT_DIR, { recursive: true });

    await enableE2EMediaScenario(page, 'success');
    await seedAuthToken(page);

    let requestCount = 0;
    await page.route('**/api/pronunciation/assessment', async (route) => {
      requestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildAssessmentPayload(`screenshot-${requestCount}`)),
      });
    });

    await page.goto('/practice/sentence', { waitUntil: 'domcontentloaded' });
    await disableAnimations(page);

    // Wait for the practice page to be ready (Sentences tab + Start button)
    await expect(page.getByRole('button', { name: 'Sentences' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible({
      timeout: 15_000,
    });

    // BEFORE: capture the practice screen as the user first sees it.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'sentence-practice-before.png'),
      fullPage: true,
    });

    // Record one attempt: Start -> Stop -> Submit.
    await page.getByRole('button', { name: 'Start recording' }).click();
    await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible();
    await page.getByRole('button', { name: 'Stop recording' }).click();
    await expect(page.getByRole('button', { name: 'Submit recording' })).toBeVisible();
    await page.getByRole('button', { name: 'Submit recording' }).click();

    // AFTER: wait until the coaching card and phoneme tips are both rendered.
    await expect(page.locator('[aria-label="Next step coaching"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole('heading', { name: /Sound Details \(Phonemes & Tips\)/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('🔊 How to pronounce these sounds:')).toBeVisible({
      timeout: 15_000,
    });

    expect(requestCount).toBe(1);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'sentence-practice-after.png'),
      fullPage: true,
    });
  });
});
