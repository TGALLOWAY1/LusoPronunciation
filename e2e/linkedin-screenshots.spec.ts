import { mkdirSync } from 'fs';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';

const OUTPUT_DIR = path.resolve(process.cwd(), 'docs/assets/linkedin');

type Screen = {
  route: string;
  fileName: string;
  readyText: string;
  role?: Parameters<Page['getByRole']>[0];
  postNav?: (page: Page) => Promise<void>;
  fullPage?: boolean;
};

const screenMatrix: Screen[] = [
  {
    route: '/',
    fileName: 'dashboard-sentences.png',
    readyText: 'Sentences',
    role: 'button',
    // Expand the "Previous attempts" accordion so the phoneme-tip panel
    // renders populated from the seeded attempt instead of the "Click a
    // word..." empty state. Captured full-page so branding + sentence +
    // phoneme tips all appear together.
    postNav: async (page) => {
      await page
        .getByRole('button', { name: /^Previous attempts/, exact: false })
        .click();
      // Force an attempt to be selected in case the auto-select effect hasn't
      // yet populated `selectedAttemptId` — click the most recent entry.
      await page
        .getByRole('button', { name: /\d+d ago/ })
        .first()
        .click();
      await expect(
        page.getByRole('heading', { name: /How to pronounce these sounds/i }),
      ).toBeVisible({ timeout: 10_000 });
      await page.evaluate(() => window.scrollTo(0, 0));
    },
    fullPage: true,
  },
  { route: '/?tab=words', fileName: 'dashboard-words.png', readyText: 'Words', role: 'button' },
  { route: '/review', fileName: 'review.png', readyText: 'Review' },
  { route: '/progress', fileName: 'progress.png', readyText: 'Progress' },
];

function buildSeedPayload() {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const userId = 'local_user';
  const sentenceIds = [
    'gemini_food_001',
    'gemini_food_002',
    'gemini_food_003',
    'gemini_food_004',
    'gemini_food_005',
  ];
  const wordIds = ['basic_001', 'basic_002', 'basic_003', 'basic_004', 'basic_005'];
  const scorePool = [72, 78, 81, 84, 86, 88, 91, 93, 95];

  const sessions = Array.from({ length: 5 }, (_, i) => {
    const startedAt = new Date(now - (6 - i) * dayMs - 2 * 60 * 60 * 1000).toISOString();
    const endedAt = new Date(now - (6 - i) * dayMs - 60 * 60 * 1000).toISOString();
    const sentenceCount = 3 + (i % 2);
    const wordCount = 3 + ((i + 1) % 3);
    return {
      sessionId: `seed_session_${i + 1}`,
      userId,
      startedAt,
      endedAt,
      durationSeconds: 600 + i * 90,
      mode: i % 2 === 0 ? 'sentences' : 'mixed',
      device: 'desktop',
      totalAttempts: sentenceCount + wordCount,
      sentenceAttempts: sentenceCount,
      wordAttempts: wordCount,
      avgOverallScore: 80 + i,
      avgAccuracyScore: 82 + i,
      avgFluencyScore: 78 + i,
      avgCompletenessScore: 90,
      avgProsodyScore: 79 + i,
      dailyStreakAfterSession: i + 1,
    };
  });

  // Word-level scores for the "Estou com fome." sentence so the phoneme panel
  // can auto-select the first word and enrich it with canonical phonemes.
  const estouComFomeWordScores = [
    { token: 'Estou', overallScore: 82, accuracyScore: 84, errorType: 'none' as const },
    { token: 'com', overallScore: 93, accuracyScore: 95, errorType: 'none' as const },
    { token: 'fome', overallScore: 76, accuracyScore: 78, errorType: 'mispronounced' as const },
  ];

  const sentenceAttempts = Array.from({ length: 16 }, (_, i) => {
    const sessionIdx = i % sessions.length;
    const sentenceId = sentenceIds[i % sentenceIds.length];
    const base = scorePool[i % scorePool.length];
    return {
      attemptId: `seed_s_attempt_${i + 1}`,
      userId,
      sessionId: sessions[sessionIdx].sessionId,
      sentenceId,
      difficulty: (2 + (i % 3)) as 2 | 3 | 4,
      category: 'food',
      createdAt: new Date(now - (6 - sessionIdx) * dayMs - (16 - i) * 5 * 60 * 1000).toISOString(),
      overallScore: base,
      accuracyScore: Math.min(100, base + 2),
      fluencyScore: Math.max(60, base - 3),
      completenessScore: 100,
      prosodyScore: Math.max(60, base - 5),
      passed: base >= 80,
      recordingDurationSeconds: 3 + (i % 4),
      wordScores: sentenceId === 'gemini_food_001' ? estouComFomeWordScores : undefined,
    };
  });

  const wordAttempts = Array.from({ length: 22 }, (_, i) => {
    const sessionIdx = i % sessions.length;
    const wordId = wordIds[i % wordIds.length];
    const base = scorePool[(i + 3) % scorePool.length];
    return {
      attemptId: `seed_w_attempt_${i + 1}`,
      userId,
      sessionId: sessions[sessionIdx].sessionId,
      wordId,
      difficulty: (2 + ((i + 1) % 3)) as 2 | 3 | 4,
      category: 'basics_greetings',
      createdAt: new Date(now - (6 - sessionIdx) * dayMs - (22 - i) * 3 * 60 * 1000).toISOString(),
      overallScore: base,
      accuracyScore: Math.min(100, base + 1),
      fluencyScore: Math.max(60, base - 2),
      passed: base >= 80,
      practiceMode: 'pronunciation',
    };
  });

  const practiceLog = {
    userId,
    sessions,
    sentenceAttempts,
    wordAttempts,
    serverSessionIds: {},
  };

  const pastIso = (hours: number) =>
    new Date(now - hours * 60 * 60 * 1000).toISOString();

  const progressEntries: Record<string, unknown> = {};
  sentenceIds.forEach((id, idx) => {
    progressEntries[`sentence_${id}`] = {
      itemId: id,
      itemType: 'sentence',
      lastRating: idx % 2 === 0 ? 'good' : 'hard',
      lastReviewedAt: pastIso(24 + idx * 3),
      nextReviewAt: pastIso(1 + idx),
      reviewCount: 2 + idx,
    };
  });
  wordIds.forEach((id, idx) => {
    progressEntries[`word_${id}`] = {
      itemId: id,
      itemType: 'word',
      lastRating: idx % 2 === 0 ? 'review' : 'know',
      lastReviewedAt: pastIso(30 + idx * 4),
      nextReviewAt: pastIso(2 + idx),
      reviewCount: 1 + idx,
    };
  });

  return { practiceLog, progressEntries };
}

async function seedAppState(page: Page) {
  const { practiceLog, progressEntries } = buildSeedPayload();
  await page.addInitScript(
    ({ practiceLog, progressEntries }) => {
      localStorage.setItem('luso_auth_token', 'e2e-screenshot-token');
      localStorage.setItem('luso_practice_log_v1', JSON.stringify(practiceLog));
      localStorage.setItem('lusopronounce_progress', JSON.stringify(progressEntries));
    },
    { practiceLog, progressEntries },
  );
}

async function captureRoute(page: Page, screen: Screen, outputPath: string) {
  await page.goto(screen.route, { waitUntil: 'domcontentloaded' });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });

  await page.addStyleTag({
    content:
      '*{animation-duration:0s !important;animation-delay:0s !important;transition-duration:0s !important;scroll-behavior:auto !important;}',
  });

  const readyTarget = page
    .locator('main')
    .getByRole(screen.role || 'heading', { name: screen.readyText, exact: true })
    .first();
  await expect(readyTarget).toBeVisible({ timeout: 15_000 });
  await expect(readyTarget).toHaveCSS('opacity', '1', { timeout: 15_000 });

  if (screen.postNav) {
    await screen.postNav(page);
  }

  await page.waitForTimeout(300);
  await page.screenshot({ path: outputPath, fullPage: screen.fullPage ?? false });
}

test.use({
  viewport: { width: 1600, height: 1000 },
  launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {},
});

test.describe('LinkedIn screenshots', () => {
  test('capture main screens with seeded practice history', async ({ page }) => {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    await seedAppState(page);

    for (const screen of screenMatrix) {
      const outputPath = path.join(OUTPUT_DIR, screen.fileName);
      await captureRoute(page, screen, outputPath);
    }
  });
});
