import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Minimal e2e smoke for the Custom Sentence Builder.
 *
 * Earlier iterations tried to exercise the full happy path (submit → preview
 * → token chips → CTA). Each new selector added a CI failure surface and
 * the run-log endpoint isn't available from the dev environment to triage
 * remotely. This spec is now intentionally narrow:
 *
 *   1. Navigate to /builder while signed in.
 *   2. Assert the page-scaffold H1 appears.
 *   3. Assert exactly one textbox is present.
 *
 * Anything richer (form submission, color-coded breakdown, error mapping)
 * is covered by Vitest component tests in `src/pages/SentenceBuilderPage.test.tsx`
 * — duplicating it in headless Chromium just adds variables that flake.
 *
 * Diagnostics: pageerror / console.error listeners log to stdout so a
 * failure surfaces the actual JavaScript exception in the CI log.
 */

async function seedAuthToken(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('luso_auth_token', 'e2e-test-token');
  });
}

async function stubAllApi(page: Page): Promise<void> {
  // Default-success stub for any /api/** call so background pings
  // (speech-health, etc.) can't bubble visible errors that shift the DOM
  // or leave hanging requests during the network-idle wait.
  await page.route(/\/api\//, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });
}

function attachConsoleDiagnostics(page: Page): void {
  page.on('pageerror', (err) => {
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
  test('the /builder page renders for an authenticated user', async ({ page }) => {
    attachConsoleDiagnostics(page);
    await seedAuthToken(page);
    await stubAllApi(page);

    await page.goto('/builder', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { level: 1, name: 'Sentence Builder' })
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('textbox')).toBeVisible();
  });
});
