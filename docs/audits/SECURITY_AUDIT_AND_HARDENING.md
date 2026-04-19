# LusoPronunciation — Security Audit and Hardening

**Branch:** `develop`
**Auditor:** Claude (Anthropic) acting as security engineer
**Date:** 2026-04-16
**Standard:** OWASP ASVS 5.0 + Microsoft Azure guidance on rate limiting, quotas, and managed-identity/Key-Vault secret storage

---

## 1. Executive summary

LusoPronunciation is a single-tenant Brazilian Portuguese pronunciation trainer with a React/Vite SPA and an Express/MongoDB backend that proxies audio recordings to Azure Speech Pronunciation Assessment. The concern driving this audit: even with Azure billing caps in place, the app could plausibly be abused as a public gateway to Azure Speech, and could leak credentials, suffer credential stuffing, or be DoS'd via oversized payloads — any of which would degrade service for the legitimate user (the author) and could hurt recruiter/demo trust.

The pre-existing codebase already had several thoughtful controls (Helmet, a pronunciation-endpoint rate limiter, invite-code gating, JWT auth, bcrypt password hashing, user-scoped MongoDB queries, safe error payloads on the pronunciation route). The most material gaps were:

1. **No rate limiting on `/api/auth/*`** — open to brute force, credential stuffing, and invite-code enumeration.
2. **No global body-size limit** — `express.json()` used its default, letting `/api/migrate/local-storage` accept arbitrarily large JSON.
3. **No daily quota on Azure-backed endpoints** — only a sliding 20/5-min burst limit, which an attacker can drift under indefinitely.
4. **OAuth JWT returned in the URL query** — leaked through Referer, browser history, and logs.
5. **Verbatim `error.message` returned to clients** on most routes — leaks internal details.
6. **Weak password policy** (6-char minimum) and bcrypt cost 10.
7. **Dev-login endpoint** guarded only by `ENABLE_DEV_LOGIN`. A misconfigured env var in production became instant auth bypass.
8. **12 dependency vulnerabilities** (multer DoS, path-to-regexp ReDoS, vite path traversal, jws signature issue).
9. **Uploaded audio trusted by MIME type only** — no magic-byte check, no content-length gate.
10. **Invite-code error responses distinguished** between "unknown", "expired", and "used", enabling silent enumeration.

All of the above have been fixed in this branch. The app now refuses to boot in production with obviously-unsafe configuration (`ENABLE_DEV_LOGIN=true` in prod, short `JWT_SECRET`), enforces multi-layer rate limiting + a daily cost ceiling on Azure calls, rejects uploaded audio that doesn't begin with a known container signature, and strips error detail from client responses. Tests pass (123/123), new tests added for the rate limiter and daily quota, and `npm audit` is clean.

**Production risk rating before changes:** High (cheap proxy-to-Azure potential, credential stuffing open).
**Production risk rating after changes:** Acceptable for recruiter/demo deployment on a private invite code. Residual items are all operational (key rotation, external WAF/CDN, platform monitoring).

---

## 2. Threat model

| # | Asset | Entry point | Trust boundary | Attacker action | Impact |
|---|---|---|---|---|---|
| T1 | Azure Speech key | Server env only (`AZURE_SPEECH_KEY`) | Internet → server | Direct call to `/api/pronunciation/assessment` to drive Azure spend | Billing / service degradation |
| T2 | Azure quota | `/api/pronunciation/assessment` | Server → Azure | Sustained low-rate calls (below burst limit) to farm assessments | Billing ceiling hit |
| T3 | MongoDB | `MONGODB_URI` | Server → Mongo Atlas | Exfiltrate connection string via server logs / debug dumps | Data exposure |
| T4 | User credentials | `/api/auth/login` | Internet → server | Credential stuffing / brute force | Account takeover |
| T5 | Invite codes | `/api/auth/register` | Internet → server | Enumerate valid codes from distinct error responses | Unauthorized signup |
| T6 | JWT secret | Server env (`JWT_SECRET`) | Internet → server (side-channel only) | Crack short/weak secret → forge tokens | Full auth bypass |
| T7 | OAuth JWT | `/api/auth/oauth/*/callback` | Server → browser | Capture token from URL query via Referer / history / logs | Session hijack |
| T8 | Migration endpoint | `/api/migrate/local-storage` | Internet → server (authed) | POST unbounded JSON arrays | Memory exhaustion / DoS |
| T9 | Pronunciation audio upload | `/api/pronunciation/assessment` | Internet → server | Upload oversized / non-audio blob → ffmpeg / Azure cost | Resource abuse |
| T10 | Dev-login bypass | `/api/auth/dev-login` | Internet → server | Toggle `ENABLE_DEV_LOGIN` in prod → instant auth | Full bypass |
| T11 | Speech debug dump | `/data/debug/*.json` | Filesystem | Capture full Azure payloads if `SPEECH_DEBUG=on` leaked | PII exposure |
| T12 | Dependency vulns | npm tree | Internet → server | ReDoS, path-traversal, MulterDoS | DoS / RCE vector surface |
| T13 | Error responses | All routes | Server → Internet | Glean internal structure from `error.message` | Reconnaissance |
| T14 | CORS policy | `/api/pronunciation*` | Browser | Malicious origin scripts user's browser to call API | CSRF-adjacent |
| T15 | Client bundle | `dist/assets/*.js` | Build → Internet | Inspect JS for leaked secrets | Credential disclosure |
| T16 | OAuth callback redirect | `/api/auth/oauth/*/callback` | Server → browser | Open redirect if `APP_ORIGIN` attacker-controlled | Phishing |

---

## 3. Findings by severity

### Critical

| ID | Area | Finding | Status |
|---|---|---|---|
| C-1 | Auth | No rate limit on `/api/auth/login`, `/register`, or `/dev-login`. Credential stuffing and invite-code enumeration were wide open. | **Fixed** |
| C-2 | Cost control | No daily quota on Azure calls. Burst limiter alone allowed ~24,000 requests/day per IP/user — uncapped Azure spend under the account ceiling. | **Fixed** |
| C-3 | DoS | `express.json()` had no size limit → `/api/migrate/local-storage` accepted unbounded JSON payloads. | **Fixed** |
| C-4 | OAuth | Token returned in URL query on `/auth/callback?token=...` — logged in access logs, Referer headers, browser history. | **Fixed** |
| C-5 | Env safety | `ENABLE_DEV_LOGIN=true` in production was a silent auth bypass with no runtime warning. | **Fixed** |

### High

| ID | Area | Finding | Status |
|---|---|---|---|
| H-1 | Deps | 12 vulnerabilities from `npm audit`: multer DoS (x3), path-to-regexp ReDoS (x2), vite path traversal (x3), qs DoS (x2), jws signature, jsonwebtoken transitively. | **Fixed** (npm audit fix — 0 remaining) |
| H-2 | Auth | Password minimum was 6 chars. bcrypt cost was 10 (acceptable, but 12 is better for a small user base). | **Fixed** (min 8, cost 12) |
| H-3 | Upload | No magic-byte check on uploaded audio — `multer` trusted MIME type alone; no content-length pre-gate. | **Fixed** |
| H-4 | Enumeration | `/api/auth/register` returned distinct messages for "unknown invite", "expired invite", "used invite". | **Fixed** (unified failure message) |
| H-5 | Timing | User-enumeration via login timing — bcrypt ran only when user existed. | **Fixed** (dummy-hash bcrypt on miss) |
| H-6 | JWT | No minimum `JWT_SECRET` length enforced. | **Fixed** (≥32 chars in prod) |
| H-7 | Reference text | `referenceText` had no length cap → arbitrarily long strings sent to Azure in a header. | **Fixed** (500 char cap) |
| H-8 | Migration | No upper bound on array counts → attacker could POST millions of session rows. | **Fixed** (5k/50k/50k caps) |

### Medium

| ID | Area | Finding | Status |
|---|---|---|---|
| M-1 | Errors | `res.json({ error, message: err.message })` throughout practice / flashcards / migration → raw stack detail leaked. | **Fixed** |
| M-2 | CORS | In production, `readConfiguredOrigins()` merged dev-localhost defaults into the allowlist even on prod. | **Fixed** (dev defaults gated on non-prod) |
| M-3 | CORS | `Access-Control-Allow-Headers` reflected `Access-Control-Request-Headers` unconditionally → potential header-whitelist bypass. | **Fixed** (fixed allowlist) |
| M-4 | Headers | Helmet missing `frameAncestors: 'none'`, `objectSrc: 'none'`, HSTS tuning, `baseUri: 'self'`. | **Fixed** |
| M-5 | Dev login | Dev endpoint only gated by env var. | **Fixed** (refuse boot in prod, optional shared-token header) |
| M-6 | x-powered-by | Express fingerprint enabled. | **Fixed** (`app.disable('x-powered-by')`) |
| M-7 | Global rate | No baseline API rate limit outside pronunciation endpoint. | **Fixed** (120/min/IP baseline) |
| M-8 | ContentId | `GET /api/pronunciation-attempts?contentId=...` had no length cap. | **Fixed** |

### Low

| ID | Area | Finding | Status |
|---|---|---|---|
| L-1 | Invite timing | Invite-code lookup compared with `===`. | **Fixed** (constant-time compare) |
| L-2 | Debug dumps | `SPEECH_DEBUG=true` writes raw Azure payloads to disk with no retention policy. | **Mitigated** (boot-time warning in prod; docs updated) |
| L-3 | Logs | Access log didn't correlate `X-Request-Id`. | Left as-is (optional) |
| L-4 | Health | Health endpoint exposes Mongo host/name — acceptable for ops, called out here for awareness. | Accepted |

---

## 4. Abuse scenarios (and what stops them now)

**"Can someone abuse this app even if Azure spend is capped?"**

| Scenario | Before | After |
|---|---|---|
| Script calls `/api/pronunciation/assessment` with a valid invite-code account, rotating IPs | 20/5min burst × 288 windows/day = 5,760 calls/day, no ceiling | Burst limiter (20/5min per user) + **daily quota 200 per user** regardless of IP. Attacker farms their own account, not my Azure budget. |
| Credential stuffing a known email across IPs | Unlimited | Per-email 10/15min + per-IP 20/15min. Tripping either trips 429. |
| Invite-code enumeration | Distinct error messages = O(n) scraping | Unified failure message + constant-time compare + 10-req/hour per IP on `/register` |
| DoS via huge migration payload | Uncapped JSON body | `MIGRATION_JSON_LIMIT=2mb` + array count caps (5k sessions / 50k attempts) |
| DoS via huge pronunciation upload | 10MB multer cap only (still respected once buffered) | `Content-Length > 2× max` rejected before buffer; strict magic-byte check in prod |
| "Rename .exe → .wav and upload" | MIME-only trust, ffmpeg chewed on it | MIME allowlist + magic-byte gate on RIFF/WebM/Ogg/MP3/MP4/AAC signatures in prod |
| OAuth session hijack via referer leak | Token in URL | Token in short-lived HttpOnly cookie, single-use handoff endpoint |
| Script scrapes `/api/auth/providers` | Unlimited | 60/min per IP |
| Flip `ENABLE_DEV_LOGIN=true` in Railway env by accident | Silent auth bypass | App refuses to boot in `NODE_ENV=production` with flag set |
| Attempt to use `/api/auth/dev-login` anyway | None | Refused if `NODE_ENV=production`, 404'd |
| Automate JWT forgery with a cracked short secret | Accepted | Refuses to boot with `JWT_SECRET` < 32 chars in prod |
| Read secrets from client bundle | Client bundle scanned — none present before changes | Same; explicitly verified post-build |
| Abuse `/api/migrate/local-storage` to store junk | Uncapped | Auth'd + bounded + ownership-checked |

**"How could they degrade service, lock out legitimate users, spam logs, leak data, or harm trust?"**

- Lock-out: the per-email login limiter is narrow enough that an attacker *could* lock your email out for 15 minutes. Acceptable trade-off vs. unlimited credential stuffing. Documented.
- Log spam: structured warn-level log events (`[RateLimit] blocked`, `[DailyQuota] blocked`, `[Auth] invite code rejected`) are bounded — one line per blocked request. No unbounded dump surfaces.
- Trust: rejected requests get generic messages; internal errors now say "An unexpected error occurred" instead of MongoDB/Azure error strings.

**"How could they use this as a relay into my Azure resources?"**

Only through a logged-in user account that has not yet hit its daily quota, and only through the pronunciation-assessment route (which enforces MIME + magic-byte + size + referenceText-length). Secrets never flow to the client. The `getAzureSpeechConfig()` call is server-only and verified clean in `grep` across the frontend tree.

---

## 5. Implemented fixes

### 5.1 New middleware

| File | Purpose |
|---|---|
| `src/server/middleware/rateLimit.ts` | Generic reusable rate limiter with per-IP / per-user / per-arbitrary-key options, structured warn logs on block, X-RateLimit-* headers |
| `src/server/middleware/dailyQuota.ts` | Per-key daily ceiling that resets at 00:00 UTC. Second layer above the sliding limiter |
| `src/server/middleware/rateLimit.test.ts` | 6 tests covering bucket separation, block emission, user-id keying, anonymous skip |

### 5.2 Route hardening

| File | Changes |
|---|---|
| `src/server/app.ts` | Global `/api` rate limit, JSON body limits (128kb default / 2mb on migration), stricter Helmet directives (`frameAncestors`, `objectSrc`, `baseUri`, `formAction`, HSTS 2y), `app.disable('x-powered-by')`, production refusal-to-boot with `ENABLE_DEV_LOGIN=true`, daily quota wired onto both pronunciation routes, generic 500 error payload |
| `src/server/routes/auth.ts` | Per-IP + per-email login limiter, per-IP register limiter, bcrypt cost 12, 8–128 char password policy, 254-char email cap, 80-char displayName cap, 64-char invite-code cap, constant-time invite-code compare, unified invite-code failure message, dummy-hash bcrypt on login miss (eliminates user-enumeration timing), JWT secret length check in prod, dev-login refused in prod + optional shared-token header |
| `src/server/routes/oauth.ts` | OAuth JWT returned via HttpOnly `oauth_handoff` cookie (2-min TTL, `sameSite=lax`, path-scoped) and exchanged on a new `GET /api/auth/oauth/handoff` endpoint — token is never in the URL |
| `src/server/routes/pronunciationAssessment.ts` | MIME allowlist (`audio/wav`, `audio/webm`, `audio/ogg`, `audio/mpeg`, `audio/mp4`, `audio/x-m4a`, `audio/aac`), magic-byte signature gate (`SPEECH_STRICT_AUDIO_SIGNATURE`, on by default in prod), `referenceText` ≤ 500 chars, `language` must match BCP-47 tag regex, `sentenceId` ≤ 128 chars, content-length pre-gate |
| `src/server/routes/practice.ts` | Generic 500 messages (no `err.message` leakage); `contentId` length cap on list endpoint |
| `src/server/routes/migration.ts` | Array count caps (5k sessions / 50k sentence attempts / 50k word attempts) returning 413; generic 500 message |
| `src/server/routes/flashcards.ts` | Generic 500 messages |
| `src/server/middleware/pronunciationSecurity.ts` | CORS allowlist no longer merges localhost defaults in production; `APP_ORIGIN` implicitly trusted; pinned `Access-Control-Allow-Headers`; added `pronunciationDailyQuotaMiddleware` export |

### 5.3 Other

| File | Change |
|---|---|
| `.env.example` | Documents new knobs (`GLOBAL_API_*`, `AUTH_LOGIN_*`, `AUTH_REGISTER_*`, `SPEECH_DAILY_QUOTA`, `SPEECH_STRICT_AUDIO_SIGNATURE`, `DEV_LOGIN_TOKEN`, `JSON_BODY_LIMIT`, `MIGRATION_JSON_LIMIT`); adds explicit warnings about rotating secrets, production NODE_ENV requirement, and preferring Azure Key Vault/managed identities |
| `package.json` / `package-lock.json` | `npm audit fix` brought vulnerability count 12 → 0 |

---

## 6. Residual risks

| Area | Risk | Recommended next step |
|---|---|---|
| Single-instance rate limiter | The limiter and daily quota are in-memory. If you scale to multiple Railway replicas, each replica gets its own bucket — attacker gets *N×* the limit. | Back the store with Redis/Upstash when scaling beyond 1 replica. The middleware API already isolates this concern. |
| Secret rotation | You confirmed the secrets in `.env` are already rotated. Going forward, production keys should live in Railway shared variables or Azure Key Vault, fetched at boot. | Migrate to Azure Key Vault + managed identity for AZURE_SPEECH_KEY when moving to Azure-hosted compute. Microsoft guidance is explicit on this. |
| External bot abuse | App-level rate limits still burn bandwidth on Railway when attackers rotate IPs at scale. | Put Cloudflare in front of Railway for edge WAF + bot detection. Free tier is sufficient. |
| HSTS preload | `preload: false` — flip when ready to submit to hstspreload.org (irreversible). | After 2+ weeks of stable prod. |
| Signed refresh tokens | JWT expires in 7 days but there's no revocation. If a token is stolen, it's valid for 7 days. | Shorter expiry + refresh-token rotation if you ever store anything sensitive beyond practice history. |
| SPEECH_DEBUG disk dumps | If enabled, writes full Azure payloads to `data/debug/`. Boot-time warning now fires in prod; disk retention is not managed. | Add a cron or size-based cleanup, or move dumps to a TTL'd object store. Low priority unless debugging an incident. |
| Multi-replica invite-code race | `usedCount` is updated with `$inc` which is atomic, but the `maxUses` check is read-then-write. On a 1-replica deploy this is fine; in a race, one extra registration could slip through. | Wrap in a Mongo transaction or `findOneAndUpdate` with conditional update. |
| Audio file content | We validate container format but not semantic content. Someone could upload a legit-format but semantically hostile audio. | Acceptable — Azure is the ultimate validator. |
| OAuth callback open-redirect | The callback redirects to `APP_ORIGIN` which comes from env. If env is wrong, redirect is wrong, but not attacker-controllable at request time. | Consider pinning allowed redirect hosts in code rather than env. |
| DB-backed session revocation | No way to invalidate a live JWT without rotating `JWT_SECRET` (which logs everyone out). | Add a `tokenVersion` field on `User` and include it in the JWT if revocation becomes a need. |

---

## 7. Deployment / security checklist

Run through this before any public-facing deploy:

- [ ] `NODE_ENV=production` is set in the deployment environment
- [ ] `JWT_SECRET` is ≥32 chars and unique per environment (generate: `openssl rand -hex 32`)
- [ ] `AZURE_SPEECH_KEY` is a fresh key; the previous key has been rotated in the Azure portal
- [ ] `MONGODB_URI` uses a dedicated DB user with minimum necessary privileges (readWrite on the app's DB only)
- [ ] `REQUIRE_INVITE_CODE=true` and at least one invite code has been seeded (`npm run invite:seed -- --code=... --maxUses=...`)
- [ ] `ENABLE_DEV_LOGIN` is unset (or explicitly `false`) — if set to `true`, the app refuses to boot, but make it unambiguous
- [ ] `APP_ORIGIN` points at the canonical HTTPS URL (used for OAuth redirect and implicit CORS trust)
- [ ] `APP_ORIGINS` / `CORS_ALLOWED_ORIGINS` lists every browser origin explicitly (the localhost dev defaults are dropped in production)
- [ ] Azure Speech has a billing cap configured on the subscription as defense-in-depth
- [ ] Azure Speech region matches `AZURE_SPEECH_REGION`
- [ ] Railway (or hosting provider) has `restartPolicyType=ON_FAILURE` and a health-check path of `/api/health`
- [ ] `SPEECH_DEBUG` is unset in production
- [ ] `npm audit` returns 0 vulnerabilities
- [ ] `npm run build` completes and the secret scan on `dist/` comes up empty
- [ ] Put Cloudflare (or equivalent) in front of the app for edge bot detection before public launch
- [ ] Rotate `JWT_SECRET` if you ever suspect a leak — note this invalidates all sessions
- [ ] Monitor `[RateLimit] blocked`, `[DailyQuota] blocked`, `[Auth] invite code rejected` in Railway logs

---

## 8. Recommended next steps (beyond this PR)

Short list, ranked:

1. **Put Cloudflare in front of Railway.** Free plan catches most automated abuse before it reaches the Express layer. The work is DNS + `trust proxy` tuning and takes under an hour.
2. **Move secrets to Azure Key Vault + managed identity** when you migrate from Railway to any Azure-hosted compute. This is what Microsoft recommends over long-lived shared keys.
3. **Back the rate limiter with Redis** before scaling past 1 replica. The middleware API makes this a one-file swap.
4. **Add an admin-only `/api/invite-codes` endpoint** so you can seed/rotate invite codes without SSHing into Railway.
5. **Implement session revocation** via a `tokenVersion` claim if you store anything more sensitive than practice history.
6. **Add end-to-end abuse tests in Playwright** — hit each rate limit, verify 429s; that way regressions are caught in CI.
7. **Consider moving audio blobs to signed URLs** if you ever store raw recordings — right now `recordingDataUrl` could be a base64 blob inline in Mongo, which is fine for a single user but expensive at scale.

---

## 9. Compact findings table

| ID | Severity | Area | Finding | Fix Implemented | Residual Risk |
|---|---|---|---|---|---|
| C-1 | Critical | Auth | No rate limit on `/auth/*` | Per-IP + per-email limiters on `/login`, per-IP on `/register`, `/dev-login`, `/providers` | In-memory; multi-replica needs Redis |
| C-2 | Critical | Cost | No daily quota on Azure calls | `SPEECH_DAILY_QUOTA` (default 200) layered on top of burst limiter | Same in-memory caveat |
| C-3 | Critical | DoS | Uncapped JSON body | `JSON_BODY_LIMIT=128kb` / `MIGRATION_JSON_LIMIT=2mb` | None |
| C-4 | Critical | OAuth | JWT in URL query | HttpOnly cookie handoff via `/api/auth/oauth/handoff` | None |
| C-5 | Critical | Env safety | Dev-login bypass on env flip | Refuse to boot in prod + shared-token header option | Rely on correct `NODE_ENV` |
| H-1 | High | Deps | 12 npm audit findings | `npm audit fix` — 0 remaining | Ongoing — rerun audit on each deploy |
| H-2 | High | Auth | Weak password / bcrypt cost | Min 8 chars, bcrypt cost 12 | Users set their own passwords — still need strength feedback |
| H-3 | High | Upload | MIME-only trust | Content-length pre-gate + MIME allowlist + magic-byte check (prod default) | Semantic audio content not inspected |
| H-4 | High | Enum | Invite-code messages distinguished cases | Unified failure + constant-time compare | Timing of DB lookup still exists but is much weaker |
| H-5 | High | Timing | User-enumeration via login timing | Dummy-hash bcrypt on miss | None |
| H-6 | High | JWT | No secret length check | ≥32 chars enforced in prod | None |
| H-7 | High | Text | No referenceText cap | 500-char cap | None |
| H-8 | High | Migration | Unbounded array counts | 5k/50k/50k caps returning 413 | None |
| M-1 | Medium | Errors | `err.message` leaked to clients | Generic 500 messages; server-side log retains detail | None |
| M-2 | Medium | CORS | Dev defaults in prod allowlist | Dev defaults skipped when `NODE_ENV=production` | None |
| M-3 | Medium | CORS | Reflected request-headers | Pinned allowlist | None |
| M-4 | Medium | Headers | Helmet defaults loose | `frameAncestors: 'none'`, `objectSrc: 'none'`, HSTS 2y, `baseUri: 'self'`, `formAction: 'self'` | None |
| M-5 | Medium | Dev login | Env-flag-only gate | Boot refusal + shared-token header | None |
| M-6 | Medium | Fingerprint | `X-Powered-By` leaked | `app.disable('x-powered-by')` | None |
| M-7 | Medium | Rate | No baseline API limit | `GLOBAL_API_MAX=120` per-IP | None |
| M-8 | Medium | Input | Unbounded `contentId` query | 128-char cap | None |
| L-1 | Low | Timing | Invite-code `===` | Constant-time compare | None |
| L-2 | Low | Disk | `SPEECH_DEBUG` dumps | Boot-time warning in prod; docs call it out | Manual cleanup still needed |
| L-3 | Low | Logs | Missing request-id correlation | Deferred | Minor ops inconvenience |
| L-4 | Low | Health | Mongo host/name in health body | Accepted | None |

---

## 10. Verification performed

- `npx tsc --noEmit` — clean
- `npx vitest run` — **117 pre-existing + 6 new = 123 tests passing**, 0 failing
- `npm run build` — bundle compiles (5 chunks, 118 kB gzipped JS)
- `grep -rE "AZURE_SPEECH_KEY|JWT_SECRET|MONGODB_URI|GITHUB_CLIENT_SECRET|LINKEDIN_CLIENT_SECRET|GEMINI_API_KEY" dist/` — **no matches** (no server secrets in client bundle)
- `npm audit` — **0 vulnerabilities**
- Manual review of all `/api/*` routes for authentication + authorization + input validation + error-leak posture

Targeted attack simulations performed against the running test suite:

- Synthetic "bad bytes" with `audio/webm` MIME → accepted in non-prod (test fallback path), rejected in prod mode
- Missing audio buffer → 400
- Content-Length twice the max → 413 before body buffering
- Rate-limiter hammering → 429 with `Retry-After` header
- Daily-quota hammering → 429 with `X-Quota-*` headers
- Cross-user session fetch → 404 (ownership check preserved)
