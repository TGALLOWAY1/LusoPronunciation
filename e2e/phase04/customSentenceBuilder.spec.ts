import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end coverage for the Custom Sentence Builder flow.
 *
 * Stubs the three server routes the happy path hits
 * (POST /api/sentences/custom, GET /api/sentences/custom/:id, and the
 * practice-session endpoints) so the test exercises the full
 * frontend pipeline — form submission, preview rendering, color-coded
 * token chips, router state, custom practice page load — without
 * touching real Azure.
 */

const fakeSentenceId = '65e0000000000000000000ab';

function buildSentenceResponse() {
  return {
    id: fakeSentenceId,
    userId: 'user-e2e',
    sourceTextEn: 'I need to buy bread',
    targetTextPt: 'Eu preciso comprar pão.',
    normalizedTextPt: 'eu preciso comprar pao',
    locale: 'pt-BR' as const,
    ttsAudioUrl: '/audio/custom/user-e2e/sentence.wav',
    status: 'partial_support' as const,
    tokens: [
      {
        position: 0,
        surfaceForm: 'Eu',
        normalizedForm: 'eu',
        resolutionType: 'exact_match' as const,
        wordEntryId: 'w_eu',
        confidence: 'high' as const,
      },
      {
        position: 1,
        surfaceForm: 'preciso',
        normalizedForm: 'preciso',
        resolutionType: 'exact_match' as const,
        wordEntryId: 'w_preciso',
        confidence: 'high' as const,
      },
      {
        position: 2,
        surfaceForm: 'comprar',
        normalizedForm: 'comprar',
        resolutionType: 'exact_match' as const,
        wordEntryId: 'w_comprar',
        confidence: 'high' as const,
      },
      {
        position: 3,
        surfaceForm: 'pão',
        normalizedForm: 'pao',
        resolutionType: 'generated' as const,
        generatedPronunciationId: 'gen-1',
        confidence: 'medium' as const,
      },
    ],
    createdAt: new Date('2026-04-22T00:00:00Z').toISOString(),
    updatedAt: new Date('2026-04-22T00:00:00Z').toISOString(),
  };
}

async function seedAuthToken(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('luso_auth_token', 'e2e-test-token');
  });
}

async function stubBuilderRoutes(page: Page): Promise<void> {
  await page.route('**/api/sentences/custom', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    const sentence = buildSentenceResponse();
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        sentence,
        tokens: sentence.tokens,
        audioUrl: sentence.ttsAudioUrl,
        status: sentence.status,
      }),
    });
  });

  await page.route(`**/api/sentences/custom/${fakeSentenceId}`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildSentenceResponse()),
      });
      return;
    }
    await route.fallback();
  });

  // Practice session endpoints — return quick stubs so the session start
  // doesn't block the page render.
  await page.route('**/api/practice-sessions', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'session-e2e',
        userId: 'user-e2e',
        mode: 'sentences',
        startedAt: new Date().toISOString(),
      }),
    });
  });
}

test.describe('Custom Sentence Builder', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthToken(page);
    await stubBuilderRoutes(page);
  });

  test('submits an English sentence, renders the preview, and navigates to practice', async ({ page }) => {
    await page.goto('/builder');

    const textarea = page.getByLabel(/english sentence/i);
    await expect(textarea).toBeVisible();

    const submit = page.getByRole('button', { name: /translate & preview/i });
    await expect(submit).toBeDisabled();

    await textarea.fill('I need to buy bread');
    await expect(submit).toBeEnabled();
    await submit.click();

    // Preview card rendered with translation and status badge
    await expect(page.getByText('Eu preciso comprar pão.')).toBeVisible();
    await expect(page.getByText(/partial support/i)).toBeVisible();

    // Color-coded token chips visible (green for curated, yellow for generated)
    await expect(page.getByText('Eu', { exact: true })).toBeVisible();
    await expect(page.getByText('pão', { exact: true })).toBeVisible();

    // Legend present
    await expect(page.getByText(/curated data/i)).toBeVisible();
    await expect(page.getByText(/needs review/i)).toBeVisible();

    // Add to Practice navigates to the custom practice page
    await page.getByRole('button', { name: /add to practice/i }).click();
    await expect(page).toHaveURL(new RegExp(`/practice/custom/${fakeSentenceId}$`));

    // Practice page shows the sentence and controls
    await expect(page.getByText('Eu preciso comprar pão.')).toBeVisible();
    await expect(page.getByRole('button', { name: /delete this custom sentence/i })).toBeVisible();
  });

  test('surfaces translation errors to the user', async ({ page }) => {
    await page.route('**/api/sentences/custom', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'TRANSLATION_FAILED',
          message: 'upstream failure',
        }),
      });
    });

    await page.goto('/builder');
    await page.getByLabel(/english sentence/i).fill('hello');
    await page.getByRole('button', { name: /translate & preview/i }).click();

    await expect(
      page.getByText(/translation service is not available/i)
    ).toBeVisible();
  });
});
