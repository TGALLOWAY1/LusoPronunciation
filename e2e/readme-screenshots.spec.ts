import { mkdirSync } from 'fs';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';

const OUTPUT_DIR = path.resolve(process.cwd(), 'docs/assets/readme');

const screenMatrix: Array<{ route: string; fileName: string; heading: string | RegExp }> = [
  { route: '/', fileName: 'dashboard.png', heading: 'Dashboard' },
  { route: '/practice/sentence', fileName: 'sentence-practice.png', heading: 'Sentence Practice' },
  { route: '/practice/word', fileName: 'word-practice.png', heading: /Word Practice/i },
  { route: '/review', fileName: 'review-queue.png', heading: /Review/i },
  { route: '/sessions', fileName: 'recent-sessions.png', heading: /Recent Sessions/i },
];

async function captureRoute(page: Page, route: string, heading: string | RegExp, outputPath: string) {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await page.setViewportSize({ width: 1440, height: 920 });

  if (typeof heading === 'string') {
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
  } else {
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
  }

  await page.waitForTimeout(300);
  await page.screenshot({ path: outputPath, fullPage: true });
}

test.describe('README screenshots', () => {
  test('capture current UI for main screens', async ({ page }) => {
    mkdirSync(OUTPUT_DIR, { recursive: true });

    for (const screen of screenMatrix) {
      const outputPath = path.join(OUTPUT_DIR, screen.fileName);
      await captureRoute(page, screen.route, screen.heading, outputPath);
    }
  });
});
