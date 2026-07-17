import { mkdirSync } from 'fs';
import path from 'path';
import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Full-app screenshot tour.
 *
 * Captures every user-facing page in the app populated with realistic data,
 * using a seeded dummy account (no real backend required):
 *   - localStorage is seeded with an auth token + practice history + SRS
 *     progress + settings, so protected routes render with data.
 *   - every `/api/*` endpoint is mocked with representative dummy payloads,
 *     so pages that fetch from the backend (custom sentences, admin lexicon,
 *     auth providers, assessment scoring) show populated content.
 *
 * Output: docs/assets/pages/*.png
 *
 * Run with: npx playwright test e2e/all-pages-screenshots.spec.ts --workers=1
 */

const OUTPUT_DIR = path.resolve(process.cwd(), 'docs/assets/pages');
// Focused, tour-ready element screenshots (served by the frontend at /tour/*).
const TOUR_DIR = path.resolve(process.cwd(), 'public/tour');

// ---------------------------------------------------------------------------
// Seed data (localStorage) — a plausible week of practice for a dummy account.
// ---------------------------------------------------------------------------

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

  const sessions = Array.from({ length: 6 }, (_, i) => {
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

  const estouComFomeWordScores = [
    { token: 'Estou', overallScore: 82, accuracyScore: 84, errorType: 'none' as const },
    { token: 'com', overallScore: 93, accuracyScore: 95, errorType: 'none' as const },
    { token: 'fome', overallScore: 58, accuracyScore: 60, errorType: 'mispronounced' as const },
  ];

  const sentenceAttempts = Array.from({ length: 20 }, (_, i) => {
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
      createdAt: new Date(now - (6 - sessionIdx) * dayMs - (20 - i) * 5 * 60 * 1000).toISOString(),
      overallScore: base,
      accuracyScore: Math.min(100, base + 2),
      fluencyScore: Math.max(60, base - 3),
      completenessScore: 100,
      prosodyScore: Math.max(60, base - 5),
      passed: base >= 80,
      recordingDurationSeconds: 3 + (i % 4),
      retriesInThisSession: i % 3 === 0 ? 1 : 0,
      wordScores: sentenceId === 'gemini_food_001' ? estouComFomeWordScores : undefined,
    };
  });

  const wordAttempts = Array.from({ length: 26 }, (_, i) => {
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
      createdAt: new Date(now - (6 - sessionIdx) * dayMs - (26 - i) * 3 * 60 * 1000).toISOString(),
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

  const pastIso = (hours: number) => new Date(now - hours * 60 * 60 * 1000).toISOString();

  // Make several items DUE now so the Review queue and due counts are populated.
  const progressEntries: Record<string, unknown> = {};
  sentenceIds.forEach((id, idx) => {
    progressEntries[`sentence_${id}`] = {
      itemId: id,
      itemType: 'sentence',
      lastRating: idx % 2 === 0 ? 'good' : 'hard',
      lastReviewedAt: pastIso(24 + idx * 3),
      nextReviewAt: pastIso(1 + idx), // in the past => due
      reviewCount: 2 + idx,
    };
  });
  wordIds.forEach((id, idx) => {
    progressEntries[`word_${id}`] = {
      itemId: id,
      itemType: 'word',
      lastRating: idx % 2 === 0 ? 'review' : 'know',
      lastReviewedAt: pastIso(30 + idx * 4),
      nextReviewAt: pastIso(2 + idx), // due
      reviewCount: 1 + idx,
    };
  });

  // Attempt telemetry (drives the Dev Metrics page).
  const errorClasses = [null, null, null, null, 'AZURE_TIMEOUT', 'CONVERT_FAILED'];
  const attemptTelemetry = Array.from({ length: 24 }, (_, i) => {
    const failed = i % 6 >= 4;
    const azureMs = 300 + (i % 7) * 55;
    const convertMs = 40 + (i % 5) * 12;
    const normalizeMs = 3 + (i % 4);
    return {
      attemptId: `seed_s_attempt_${i + 1}`,
      requestId: `req-${1000 + i}`,
      timeToFeedbackMs: failed ? null : azureMs + convertMs + normalizeMs + 120 + (i % 9) * 20,
      clientTimingsMs: {
        submitToResponseMs: azureMs + convertMs + 90,
        responseToRenderMs: 30 + (i % 5) * 8,
      },
      serverTimingsMs: {
        convertMs,
        azureMs,
        normalizeMs,
      },
      flags: { fallbackUsed: i % 8 === 0, canceled: false },
      error: {
        errorClass: errorClasses[i % errorClasses.length],
        httpStatus: failed ? 504 : 200,
      },
      createdAt: new Date(now - i * 17 * 60 * 1000).toISOString(),
    };
  });

  const speechServiceHealth = {
    checkedAt: new Date(now).toISOString(),
    ok: true,
    requestId: 'health-seed',
    errorClass: null,
    httpStatus: 200,
    message: null,
  };

  return { practiceLog, progressEntries, attemptTelemetry, speechServiceHealth };
}

async function seedAppState(page: Page) {
  const { practiceLog, progressEntries, attemptTelemetry, speechServiceHealth } = buildSeedPayload();
  await page.addInitScript(
    ({ practiceLog, progressEntries, attemptTelemetry, speechServiceHealth }) => {
      localStorage.setItem('luso_auth_token', 'e2e-screenshot-token');
      // Mark cloud migration as done so LocalStorageMigrator does not POST
      // /api/migrate/local-storage on mount (keeps the suite self-contained).
      localStorage.setItem('luso_cloud_migrated', 'true');
      localStorage.setItem('luso_practice_log_v1', JSON.stringify(practiceLog));
      localStorage.setItem('lusopronounce_progress', JSON.stringify(progressEntries));
      localStorage.setItem('lusopronounce_preferredWordVoice', 'female');
      localStorage.setItem('luso.metrics.attempts.v1', JSON.stringify(attemptTelemetry));
      localStorage.setItem('luso.metrics.speech-health.v1', JSON.stringify(speechServiceHealth));
    },
    { practiceLog, progressEntries, attemptTelemetry, speechServiceHealth },
  );
}

async function enableE2EMedia(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __E2E__: unknown }).__E2E__ = {
      enabled: true,
      mediaScenario: 'success',
      mediaStopDelayMs: 8,
    };
  });
}

// ---------------------------------------------------------------------------
// API mocks — dummy backend payloads for every endpoint the pages hit.
// ---------------------------------------------------------------------------

const nowIso = new Date().toISOString();

function customSentence(id: string, en: string, pt: string, status: string) {
  const tokens = pt
    .replace(/[.?!]/g, '')
    .split(' ')
    .filter(Boolean)
    .map((w, position) => ({
      position,
      surfaceForm: w,
      normalizedForm: w.toLowerCase(),
      resolutionType: position % 3 === 2 ? 'generated' : 'exact_match',
      confidence: position % 3 === 2 ? 'medium' : 'high',
    }));
  return {
    id,
    userId: 'local_user',
    sourceTextEn: en,
    targetTextPt: pt,
    normalizedTextPt: pt.toLowerCase(),
    locale: 'pt-BR',
    ttsAudioUrl: `/audio/custom/${id}.wav`,
    status,
    tokens,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

const CUSTOM_SENTENCES = [
  customSentence('custom_001', 'Where is the train station?', 'Onde fica a estação de trem?', 'ready'),
  customSentence('custom_002', 'I would like a coffee, please.', 'Eu gostaria de um café, por favor.', 'ready'),
  customSentence('custom_003', 'Can you help me find this address?', 'Você pode me ajudar a encontrar este endereço?', 'partial_support'),
];

function lexiconItem(
  id: string,
  form: string,
  frequency: number,
  uniqueUsers: number,
  examples: string[],
) {
  return {
    id,
    surfaceForm: form.toLowerCase(),
    displayForm: form,
    frequency,
    uniqueUsers,
    firstSeenAt: nowIso,
    lastSeenAt: nowIso,
    lastResolutionType: 'generated',
    status: 'pending',
    examples: examples.map((contextText, i) => ({
      sentenceId: `${id}_ex_${i}`,
      contextText,
      observedAt: nowIso,
    })),
  };
}

const LEXICON_ITEMS = [
  lexiconItem('lex_001', 'churrasco', 14, 6, [
    'Vamos fazer um churrasco no domingo.',
    'O churrasco brasileiro é famoso no mundo todo.',
  ]),
  lexiconItem('lex_002', 'saudade', 9, 5, [
    'Estou com saudade da minha família.',
    'A saudade aperta quando chega a noite.',
  ]),
  lexiconItem('lex_003', 'feijoada', 7, 4, ['A feijoada é servida com arroz e couve.']),
  lexiconItem('lex_004', 'brigadeiro', 5, 3, ['Fiz brigadeiro para a festa de aniversário.']),
];

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
      { Phoneme: 'OW', PronunciationAssessment: { AccuracyScore: 62 } },
      { Phoneme: 'M', PronunciationAssessment: { AccuracyScore: 91 } },
      { Phoneme: 'AH', PronunciationAssessment: { AccuracyScore: 58 } },
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
            { Word: 'Estou', PronunciationAssessment: { AccuracyScore: 82, ErrorType: 'None' }, Phonemes: wordPhonemes.Estou },
            { Word: 'com', PronunciationAssessment: { AccuracyScore: 93, ErrorType: 'None' }, Phonemes: wordPhonemes.com },
            { Word: 'fome', PronunciationAssessment: { AccuracyScore: 68, ErrorType: 'Mispronunciation' }, Phonemes: wordPhonemes.fome },
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
        { word: 'Estou', accuracy: 82, errorType: 'none' },
        { word: 'com', accuracy: 93, errorType: 'none' },
        { word: 'fome', accuracy: 68, errorType: 'mispronounced' },
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

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function mockBackend(page: Page) {
  let attemptCounter = 0;

  // Speech-health ping fired on app mount.
  await page.route('**/api/pronunciation/speech-health', (route) =>
    json(route, { ok: true, checkedAt: nowIso, requestId: 'health-mock' }),
  );

  // Practice session lifecycle (fire-and-forget dual writes).
  await page.route('**/api/practice-sessions', (route) =>
    json(route, { id: 'srv_session_1', userId: 'local_user', mode: 'sentences', startedAt: nowIso, createdAt: nowIso }),
  );
  await page.route('**/api/practice-sessions/**/complete', (route) =>
    json(route, { id: 'srv_session_1', userId: 'local_user', mode: 'sentences', startedAt: nowIso, createdAt: nowIso, endedAt: nowIso }),
  );
  await page.route('**/api/pronunciation-attempts**', (route) => {
    if (route.request().method() === 'GET') {
      return json(route, { attempts: [], total: 0, limit: 20, offset: 0 });
    }
    return json(route, { id: `srv_attempt_${++attemptCounter}` });
  });
  await page.route('**/api/flashcards/**', (route) =>
    json(route, {
      id: 'card_1',
      userId: 'local_user',
      contentId: 'gemini_food_001',
      contentType: 'sentence',
      nextDueAt: nowIso,
      intervalDays: 1,
      easeFactor: 2.5,
      reps: 1,
      lapses: 0,
      historyCount: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    }),
  );

  // Assessment scoring (record -> submit).
  await page.route('**/api/pronunciation/assessment', (route) =>
    json(route, buildAssessmentPayload(`screenshot-${++attemptCounter}`)),
  );

  // Custom sentences — one handler that disambiguates list vs single vs mutations.
  await page.route('**/api/sentences/custom**', (route) => {
    const req = route.request();
    const method = req.method();
    const pathname = new URL(req.url()).pathname; // e.g. /api/sentences/custom or /api/sentences/custom/custom_001
    const afterBase = pathname.split('/api/sentences/custom')[1] ?? '';
    const id = afterBase.replace(/^\//, '');

    if (method === 'DELETE') return route.fulfill({ status: 204, body: '' });
    if (method === 'POST') {
      const created = CUSTOM_SENTENCES[0];
      return json(route, { sentence: created, tokens: created.tokens, audioUrl: created.ttsAudioUrl, status: created.status });
    }
    if (id) {
      // GET a single custom sentence by id
      const found = CUSTOM_SENTENCES.find((s) => s.id === id) ?? CUSTOM_SENTENCES[0];
      return json(route, found);
    }
    // GET the list
    return json(route, { sentences: CUSTOM_SENTENCES, total: CUSTOM_SENTENCES.length, limit: 50, offset: 0 });
  });

  // Admin lexicon review queue.
  await page.route('**/api/admin/lexicon/review**', (route) =>
    json(route, {
      items: LEXICON_ITEMS,
      total: LEXICON_ITEMS.length,
      limit: 100,
      offset: 0,
      status: 'pending',
    }),
  );
  await page.route('**/api/admin/lexicon/aggregate', (route) =>
    json(route, { observations: 42, groups: 12, upserted: 12, skippedNonPending: 0 }),
  );

  // Auth providers (for the /auth page).
  await page.route('**/api/auth/providers', (route) =>
    json(route, { providers: ['email', 'dev', 'google', 'github', 'linkedin'] }),
  );

  // LocalStorage migration (defensive — the seed also sets luso_cloud_migrated).
  await page.route('**/api/migrate/**', (route) =>
    json(route, {
      importedSessions: 0,
      importedAttempts: 0,
      skippedSessions: 0,
      skippedAttempts: 0,
      errors: [],
    }),
  );
}

async function prep(page: Page) {
  await disableAnimations(page);
  await seedAppState(page);
  await enableE2EMedia(page);
  await mockBackend(page);
}

async function disableAnimations(page: Page) {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
}

async function settle(page: Page) {
  await page.addStyleTag({
    content:
      '*{animation-duration:0s !important;animation-delay:0s !important;transition-duration:0s !important;scroll-behavior:auto !important;caret-color:transparent !important;}',
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}

async function shoot(page: Page, name: string, fullPage = true) {
  await settle(page);
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${name}.png`), fullPage });
}

/**
 * Capture a single element (by data-testid) as a cropped, tour-ready PNG in
 * public/tour/. Used to embed real, focused pieces of the assessment UI in the
 * marketing Tour instead of a fabricated mockup.
 */
async function captureTourShot(page: Page, testId: string, name: string) {
  const el = page.locator(`[data-testid="${testId}"]`).first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await el.screenshot({ path: path.join(TOUR_DIR, `${name}.png`) });
}

test.use({
  viewport: { width: 1440, height: 1024 },
  launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {},
});

test.describe('Full app screenshot tour', () => {
  test.beforeAll(() => {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    mkdirSync(TOUR_DIR, { recursive: true });
  });

  test.beforeEach(async ({ page }) => {
    await prep(page);
  });

  test('marketing — tour', async ({ page }) => {
    await page.goto('/tour', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
    await shoot(page, '01-tour');
  });

  test('marketing — demo', async ({ page }) => {
    await page.goto('/demo', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Pick a sentence', { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    await shoot(page, '02-demo');
  });

  test('auth — sign in', async ({ page }) => {
    // Clear the token so the auth page renders instead of redirecting.
    await page.addInitScript(() => localStorage.removeItem('luso_auth_token'));
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#email').first()).toBeVisible({ timeout: 15_000 });
    await shoot(page, '03-auth', false);
  });

  test('practice — sentences (before recording)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Sentences' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible({ timeout: 20_000 });
    await shoot(page, '04-practice-sentences');
  });

  test('practice — sentences (assessment result)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Start recording' }).click();
    await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Stop recording' }).click();
    await expect(page.getByRole('button', { name: 'Submit recording' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Submit recording' }).click();

    await expect(page.locator('[aria-label="Next step coaching"]')).toBeVisible({ timeout: 20_000 });
    await shoot(page, '05-practice-sentences-result');

    // Focused, tour-ready element captures of the *real* scored result, saved
    // into public/tour/ so the marketing Tour can embed genuine app UI (not a
    // hand-built mockup). Captured here because this flow already produces a
    // populated, authentic assessment result.
    await captureTourShot(page, 'score-strip', 'app-scored-result');
    await captureTourShot(page, 'sound-details-panel', 'app-sound-coaching');
  });

  test('practice — words', async ({ page }) => {
    await page.goto('/?tab=words', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Words', exact: true })).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(800);
    await shoot(page, '06-practice-words');
  });

  test('review — queue', async ({ page }) => {
    // Review.tsx shuffles the due queue with Math.random(), so seed exactly one
    // due item here to keep 07-review-queue.png deterministic across reruns.
    await page.addInitScript(() => {
      const pastIso = new Date(Date.parse('2026-07-04T00:00:00Z')).toISOString();
      const futureIso = new Date(Date.parse('2026-07-30T00:00:00Z')).toISOString();
      const entries: Record<string, unknown> = {
        sentence_gemini_food_001: {
          itemId: 'gemini_food_001',
          itemType: 'sentence',
          lastRating: 'hard',
          lastReviewedAt: pastIso,
          nextReviewAt: pastIso, // due
          reviewCount: 3,
        },
      };
      for (const id of ['gemini_food_002', 'gemini_food_003', 'gemini_food_004', 'gemini_food_005']) {
        entries[`sentence_${id}`] = {
          itemId: id,
          itemType: 'sentence',
          lastRating: 'good',
          lastReviewedAt: pastIso,
          nextReviewAt: futureIso, // not due
          reviewCount: 2,
        };
      }
      localStorage.setItem('lusopronounce_progress', JSON.stringify(entries));
    });
    await page.goto('/review', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Review Queue' })).toBeVisible({ timeout: 20_000 });
    await shoot(page, '07-review-queue');
  });

  test('review — recent attempts', async ({ page }) => {
    await page.goto('/review', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Recent Attempts' })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Recent Attempts' }).click();
    await expect(page.getByText('Practice again').first()).toBeVisible({ timeout: 10_000 });
    await shoot(page, '08-review-recent');
  });

  test('progress — analytics', async ({ page }) => {
    await page.goto('/progress', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(800);
    await shoot(page, '09-progress');
  });

  test('builder — sentence builder', async ({ page }) => {
    await page.goto('/builder', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Sentence Builder', exact: true })).toBeVisible({ timeout: 20_000 });
    await shoot(page, '10-builder');
  });

  test('custom sentences — list', async ({ page }) => {
    await page.goto('/sentences/custom', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'My Sentences', exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Onde fica a estação de trem?').first()).toBeVisible({ timeout: 10_000 });
    await shoot(page, '11-custom-sentences-list');
  });

  test('custom sentences — practice one', async ({ page }) => {
    await page.goto('/practice/custom/custom_001', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Onde fica a estação de trem?').first()).toBeVisible({ timeout: 20_000 });
    await shoot(page, '12-custom-sentence-practice');
  });

  test('admin — lexicon review', async ({ page }) => {
    await page.goto('/admin/lexicon', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Lexicon Review', exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('churrasco', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await shoot(page, '13-admin-lexicon');
  });

  test('settings', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({ timeout: 20_000 });
    await shoot(page, '14-settings', false);
  });

  test('dev — analytics', async ({ page }) => {
    await page.goto('/dev/analytics', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Dev Analytics Dashboard' })).toBeVisible({ timeout: 20_000 });
    await shoot(page, '15-dev-analytics');
  });

  test('dev — metrics', async ({ page }) => {
    await page.goto('/dev/metrics', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Attempt Metrics' })).toBeVisible({ timeout: 20_000 });
    await shoot(page, '16-dev-metrics');
  });

  test('dev — pronunciation fixtures', async ({ page }) => {
    await page.goto('/dev/pronunciation-fixtures', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await shoot(page, '17-dev-fixtures');
  });
});
