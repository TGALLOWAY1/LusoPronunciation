import { mkdirSync } from 'fs';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';

const OUTPUT_DIR = path.resolve(process.cwd(), 'docs/assets/tour');
const VIEWPORTS = [
  { name: '320', width: 320, height: 700 },
  { name: '375', width: 375, height: 812 },
  { name: '430', width: 430, height: 932 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 1000 },
] as const;

async function openTour(page: Page) {
  const errors: string[] = [];
  const assessmentRequests: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => {
    const url = request.url();
    const runtimeRequest = ['fetch', 'xhr'].includes(request.resourceType());
    if (runtimeRequest && (/\/api\/|cognitiveservices\.azure\.com/i.test(url))) {
      assessmentRequests.push(url);
    }
  });

  await page.goto('/tour', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('From speech scores');
  await expect(page.getByText(/static sample based on the production feedback format/i)).toBeVisible();
  await page.waitForTimeout(750);

  return { errors, assessmentRequests };
}

test.describe('public tour', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name}px has no page overflow or runtime requests`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const { errors, assessmentRequests } = await openTour(page);

      const dimensions = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        root: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));

      expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
      expect(dimensions.root).toBeLessThanOrEqual(dimensions.viewport);
      expect(errors).toEqual([]);
      expect(assessmentRequests).toEqual([]);

      if (viewport.width === 375) {
        mkdirSync(OUTPUT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'tour-mobile-375.png'), fullPage: true });
      }
      if (viewport.width === 1440) {
        mkdirSync(OUTPUT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'tour-desktop-1440.png'), fullPage: true });
      }
    });
  }

  test('sample and walkthrough controls are keyboard operable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openTour(page);

    const nasalSound = page.getByRole('button', { name: /inspect mãe sound ɐ̃/i });
    await nasalSound.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/touch your nose; you should feel vibration/i)).toBeVisible();

    const coachingStep = page.getByRole('button', { name: /04 \/ 04/i });
    await coachingStep.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/repository coaching metadata/i)).toBeVisible();
  });

  test('reduced motion disables the tour reveal animations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openTour(page);

    const animationNames = await page.evaluate(() => ({
      state: getComputedStyle(document.querySelector('.tour-state-enter') as Element).animationName,
      flow: getComputedStyle(document.querySelector('.tour-flow-line') as Element).animationName,
    }));

    expect(animationNames).toEqual({ state: 'none', flow: 'none' });
  });
});
