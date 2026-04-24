import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * End-to-end smoke for the Custom Sentence Builder.
 *
 * Scoped intentionally narrow: navigate to /builder, submit the form with
 * a stubbed POST /api/sentences/custom, and verify the preview card
 * renders the translated text plus at least one trust-coded token chip.
 * The deeper practice-page flow is covered by Vitest component tests and
 * the server-side unit suite — duplicating it here just adds
 * headless-chromium variables that flake in CI.
 *
 * Selector notes:
 *  - `getByRole('textbox')` is preferred over `getByLabel` because React 19's
 *    `useId` can produce label/control ids with non-ASCII characters that
 *    break some CSS-compatible resolvers. The builder page has exactly one
 *    textarea, so the role lookup is unambiguous.
 *  - A heading-level smoke assertion runs first so a failure cleanly reports
 *    "page didn't render" vs "selector didn't match".
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

async function installApiStubs(page: Page): Promise<void> {
  // Specific: POST /api/sentences/custom — the one the builder hits.
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

  // Catch-all: any other /api/** request gets an empty-object 200 so
  // background pings (speech-health, session, etc.) can't fail in a way
  // that shifts the DOM or blocks hydration.
  await page.route(/\/api\//, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });
}

function attachConsoleErrorLogging(page: Page): void {
  page.on('pageerror', (err) => {
    // Surface uncaught exceptions from the SPA so a test-run failure
    // includes the JavaScript error, not just "element not visible".
    // eslint-disable-next-line no-console
    console.log('[pageerror]', err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      // eslint-disable-next-line no-console
      console.log('[console.error]', msg.text());
    }
  });
}

test.describe('Custom Sentence Builder', () => {
  test('renders the builder form and a trust-coded preview after submit', async ({ page }) => {
    attachConsoleErrorLogging(page);
    await seedAuthToken(page);
    await installApiStubs(page);

    await page.goto('/builder');

    // Smoke: the page itself rendered (RequireAuth didn't redirect away
    // and the component didn't throw). `Sentence Builder` is the H1 set by
    // PageScaffold.
    await expect(
      page.getByRole('heading', { level: 1, name: 'Sentence Builder' })
    ).toBeVisible({ timeout: 10_000 });

    const textarea = page.getByRole('textbox');
    await expect(textarea).toBeVisible();

    const submit = page.getByRole('button', { name: /translate & preview/i });
    await expect(submit).toBeDisabled();

    await textarea.fill('I need to buy bread');
    await expect(submit).toBeEnabled();
    await submit.click();

    // Preview: translated text + status badge for a non-ready status.
    await expect(page.getByText('Eu preciso comprar pão.')).toBeVisible();
    await expect(page.getByText('Partial support', { exact: true })).toBeVisible();

    // Legend is always rendered when there are tokens.
    await expect(page.getByText('Curated data', { exact: true })).toBeVisible();
    await expect(page.getByText('Generated', { exact: true })).toBeVisible();

    // Add to Practice CTA is visible. We don't click it — the practice
    // page is covered by Vitest + server-side unit tests.
    await expect(page.getByRole('button', { name: /add to practice/i })).toBeVisible();
  });
});
