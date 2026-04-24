import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * End-to-end smoke for the Custom Sentence Builder.
 *
 * Scoped intentionally narrow: navigate to /builder, submit the form with
 * a stubbed POST /api/sentences/custom, and verify the preview card
 * renders the translated text plus at least one trust-coded token chip.
 * The deeper practice-page flow is covered by Vitest component tests and
 * the server-side unit suite — duplicating it here just means more
 * headless-chromium variables that can flake in CI.
 *
 * Uses regex route patterns to avoid any glob-vs-host ambiguity and a
 * broad /api/** fallback so unhandled calls don't surface as red errors
 * in the page and shift selectors around.
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

async function stubCreate(page: Page): Promise<void> {
  // Catch-all: any unhandled /api/** request succeeds with an empty body
  // so background requests (quota pings, session pings, health) don't
  // produce visible error surfaces in the UI.
  await page.route(/\/api\//, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });

  // Specific: POST /api/sentences/custom — the one the builder form hits.
  await page.route(/\/api\/sentences\/custom(\?.*)?$/, async (route: Route) => {
    if (route.request().method() !== 'POST') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
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
}

test.describe('Custom Sentence Builder', () => {
  test('renders the builder form and a trust-coded preview after submit', async ({ page }) => {
    await seedAuthToken(page);
    await stubCreate(page);

    await page.goto('/builder');

    const textarea = page.getByLabel(/english sentence/i);
    await expect(textarea).toBeVisible();

    const submit = page.getByRole('button', { name: /translate & preview/i });
    await expect(submit).toBeDisabled();

    await textarea.fill('I need to buy bread');
    await expect(submit).toBeEnabled();
    await submit.click();

    // Preview: translated text + status badge for a non-ready status.
    await expect(page.getByText('Eu preciso comprar pão.')).toBeVisible();
    await expect(page.getByText('Partial support', { exact: true })).toBeVisible();

    // Legend is always rendered when there are tokens; its presence is the
    // cheapest proof that the color-coded breakdown rendered at all.
    await expect(page.getByText('Curated data', { exact: true })).toBeVisible();
    await expect(page.getByText('Generated', { exact: true })).toBeVisible();

    // Add to Practice CTA is visible (we don't click it here; the practice
    // page has its own unit + component coverage).
    await expect(page.getByRole('button', { name: /add to practice/i })).toBeVisible();
  });
});
