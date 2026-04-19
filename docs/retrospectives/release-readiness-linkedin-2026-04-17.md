# LusoPronounce Release Readiness Assessment (LinkedIn Launch)

Date: 2026-04-17
Scope: "Ship to LinkedIn" readiness (not full production hardening)

## 1) Final Verdict

**GO WITH FIXES**

The core loop is fundamentally working (record → assess → render feedback), and the test/build baseline is healthy. However, there are a few launch-blocking issues for a public recruiter demo: cross-origin deployment traps, invite-code onboarding friction, and missing cost-abuse guardrails for open signups.

## 2) Critical Breakage Risk

### Blocker A — split frontend/backend deploy will fail without routing/CORS alignment
- **Why it matters:** the frontend uses relative `/api/*` calls and assumes same-origin/proxy behavior.
- **Evidence:** pronunciation client calls `/api/pronunciation/assessment`; Vite proxy only exists in local dev.
- **Files:** `src/hooks/useLivePronunciationPractice.ts`, `vite.config.ts`, `src/server/app.ts`, `src/server/middleware/pronunciationSecurity.ts`.
- **Fix approach (actionable):**
  1. Add `VITE_API_BASE_URL` (empty by default).
  2. Wrap all fetches with `buildApiUrl(path)` helper.
  3. If deploying frontend and backend on different origins, add global CORS middleware for non-pronunciation routes and include frontend origin allowlist.
  4. Keep pronunciation-specific stricter CORS for speech route.

### Blocker B — CSP `connect-src` is same-origin only
- **Why it matters:** if frontend and API are on different origins, browser can block API requests even if CORS is correct.
- **Evidence:** Helmet CSP `connectSrc` only includes `'self'` and `blob:`.
- **Files:** `src/server/app.ts`.
- **Fix approach (actionable):**
  1. Add `CSP_CONNECT_SRC` env var (comma separated).
  2. Merge it into Helmet `connectSrc`.
  3. For same-origin deploy, keep default as-is.

### Blocker C — startup env validation is non-fatal after listen
- **Why it matters:** app can appear "up" while required env vars are missing; recruiters hit broken flows post-login.
- **Evidence:** server listens first, catches missing env / Mongo errors, logs, and continues.
- **Files:** `src/server/app.ts`, `src/server/config/startupChecks.ts`.
- **Fix approach (actionable):**
  1. In `NODE_ENV=production`, fail-fast on missing required env vars before binding port.
  2. Keep non-fatal behavior only for local/dev if desired.

## 3) Abuse & Cost Risk (Azure Protection)

### Abuse paths
1. **Open registration + per-user daily quota can be bypassed by creating many accounts** (severity: **HIGH** for cost exposure if invite gate disabled).
2. **In-memory rate limits reset on restart / scale-out instances** (severity: **MEDIUM**).
3. **Pronunciation endpoint itself is well-protected (auth + burst + daily quota + upload gates)** (severity: **LOW residual risk**).

### Minimum viable protection (no overengineering)
1. Keep `REQUIRE_INVITE_CODE=true` for initial LinkedIn launch; seed finite invite codes.
2. Lower speech limits for demo period:
   - `SPEECH_RATE_LIMIT_MAX_REQUESTS=8`
   - `SPEECH_DAILY_QUOTA=30`
3. Lower global API burst cap temporarily (e.g., `GLOBAL_API_MAX=80`).
4. Add a hard registration cap flag (e.g., `MAX_NEW_USERS_PER_DAY`) or temporarily disable public signup after initial test group.

## 4) Deployment Readiness

## Recommended fast path (1–2 days)
**Best speed/reliability:** single-origin deploy (Railway) serving API + built SPA from Express.

### Why
- Existing server already serves static `dist` and SPA fallback.
- Avoids cross-origin CORS/CSP complexity entirely.

### Required env vars
- `AZURE_SPEECH_KEY`
- `AZURE_SPEECH_REGION`
- `MONGODB_URI`
- `JWT_SECRET`
- `NODE_ENV=production`
- `APP_ORIGIN=https://<your-domain>`
- `REQUIRE_INVITE_CODE=true` (for launch phase)

### If you insist on Vercel frontend + separate backend
- Add `VITE_API_BASE_URL` and URL helper.
- Add global CORS for auth/practice/flashcards/etc.
- Update pronunciation allowlist env (`SPEECH_CORS_ALLOWED_ORIGINS` or equivalent).
- Expand CSP `connect-src` to backend origin.
- Verify OAuth callback URLs and cookie/token behavior.

## 5) UX & Trust Risks (Top 5)

1. **Onboarding friction if invite is required but no code is provided in launch post.**
   - Quick fix: include one public low-cap invite code for recruiters.
2. **No live demo URL in README Demo section.**
   - Quick fix: add production URL + one-line "try this first" instruction.
3. **Analytics-heavy surfaces can distract from core wow moment.**
   - Quick fix: land users directly on sentence practice with a preselected sentence.
4. **Error messages can still feel technical (route/config wording).**
   - Quick fix: replace with user-facing language + one retry CTA.
5. **Auth-required home means first-run value is delayed.**
   - Quick fix: add "Try Demo" flow that runs a canned sample assessment without API spend.

## 6) Error Handling & Resilience

### Missing/weak states
1. Backend "partially alive" state can mask env/config failures.
2. Frontend catches many errors but lacks a clear structured fallback pathway (e.g., "Use demo sample instead").
3. No recruiter-facing service status banner before recording begins.

### Fast fallback behaviors
1. Add startup readiness endpoint that includes speech + DB readiness flags and gate the record button until healthy.
2. If live assessment fails, immediately offer:
   - "Retry"
   - "Use Demo Sample"
3. Add a "degraded mode" badge when only local features are available.

## 7) Demo Experience Quality

### Friction points
- Must register/login before value is shown.
- Invite-code launch can fail if no seeded code exists.
- No explicit first-run walkthrough to complete one successful loop quickly.

### High-impact first-run improvements
1. Add a "Start 60-second demo" card on first login.
2. Auto-select one sentence and highlight the exact 3-step loop.
3. Preflight checks (mic permission, API reachable, auth valid) before enabling record.

## 8) 24–48 Hour Action Plan

## Day 1 — Critical fixes
- [ ] Decide deploy mode (single-origin Railway strongly recommended).
- [ ] Implement fail-fast env validation in production startup.
- [ ] Set launch-safe env limits for rate/quota.
- [ ] Seed invite codes and verify registration end-to-end.
- [ ] Add basic readiness/preflight check in UI before record.

## Day 2 — Deploy + polish
- [ ] Deploy production build.
- [ ] Run one clean external-user smoke test from fresh browser profile.
- [ ] Add Demo URL and "How to test in 60s" in README.
- [ ] Add lightweight "Use Demo Sample" fallback path for outages.
- [ ] Publish LinkedIn launch with scoped invite instructions.

## 9) LinkedIn Launch Conversion (highest leverage content)

### A) Turn this into a LinkedIn launch post
Use a concise story structure:
1. **Hook:** "I built a Portuguese pronunciation coach that gives per-word + phoneme feedback in seconds."
2. **Problem:** "Most tools score whole sentences; I wanted actionable sound-level feedback."
3. **Demo proof:** GIF + one concrete before/after learning loop.
4. **Tech credibility bullets:** React + Express + Azure speech assessment + deterministic coaching.
5. **CTA:** "Comment 'demo' for an invite code" (or include one capped code).

### B) "Demo Mode" architecture prompt (recommended next step)
Prompt idea:
- "Design a Demo Mode for LusoPronounce that lets unauthenticated users run exactly one full record→score experience using cached fixture audio + fixture assessment payload, with zero Azure calls, clear 'Demo data' labeling, and seamless upgrade to real mode after signup. Keep implementation under 1 day and avoid backend rewrites."

Expected output should include:
1. Route/component changes
2. Data source toggles
3. Abuse safeguards (no unlimited compute)
4. UX copy for demo vs live mode
5. Acceptance checklist for recruiter-safe launch
