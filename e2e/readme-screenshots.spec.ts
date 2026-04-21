import { mkdirSync } from 'fs';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';

const OUTPUT_DIR = path.resolve(process.cwd(), 'docs/assets/readme');

const screenMatrix: Array<{
  route: string;
  fileName: string;
  readyText: string;
  role?: Parameters<Page['getByRole']>[0];
}> = [
  { route: '/', fileName: 'dashboard.png', readyText: 'Dashboard' },
  {
    route: '/practice/sentence',
    fileName: 'sentence-practice.png',
    readyText: 'Sentences',
    role: 'button',
  },
  {
    route: '/practice/word',
    fileName: 'word-practice.png',
    readyText: 'Words',
    role: 'button',
  },
  { route: '/review', fileName: 'review-queue.png', readyText: 'Review Queue' },
  {
    route: '/sessions',
    fileName: 'recent-sessions.png',
    readyText: 'Recent Sessions',
  },
];

async function captureRoute(page: Page, route: string, readyText: string, outputPath: string, role: Parameters<Page['getByRole']>[0] = 'heading') {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await page.setViewportSize({ width: 1440, height: 920 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });

  await page.addStyleTag({
    content:
      '*{animation-duration:0s !important;animation-delay:0s !important;transition-duration:0s !important;scroll-behavior:auto !important;}',
  });

  const readyTarget = page.locator('main').getByRole(role, { name: readyText, exact: true }).first();
  await expect(readyTarget).toBeVisible({ timeout: 15_000 });
  await expect(readyTarget).toHaveCSS('opacity', '1', { timeout: 15_000 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: outputPath, fullPage: false });
}


test.describe('README screenshots', () => {
  test('capture current UI for main screens', async ({ page }) => {
    mkdirSync(OUTPUT_DIR, { recursive: true });

    for (const screen of screenMatrix) {
      const outputPath = path.join(OUTPUT_DIR, screen.fileName);
      await captureRoute(page, screen.route, screen.readyText, outputPath, screen.role);
    }
  });
});
