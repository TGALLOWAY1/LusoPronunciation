# TODO — Launch Checklist

Manual steps for the LinkedIn / portfolio launch. The code-level gaps from `docs/release-readiness-linkedin-2026-04-17.md` are already addressed in this branch; what remains needs a human, credentials, or a live environment.

Work the list top to bottom.

## 1. Deploy the backend + SPA to Railway

- Create a new Railway project from this repo; Railway will pick up `Dockerfile` + `railway.json` automatically.
- Attach a MongoDB (Railway plugin, MongoDB Atlas free tier, or equivalent).
- Confirm the health check at `/api/health` goes green after the first deploy.

## 2. Set production environment variables

In Railway's variables panel, set:

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` |
| `AZURE_SPEECH_KEY` | Azure Speech resource key |
| `AZURE_SPEECH_REGION` | e.g. `eastus`, `brazilsouth` |
| `MONGODB_URI` | full SRV connection string |
| `JWT_SECRET` | generate with `openssl rand -hex 32` |
| `APP_ORIGIN` | e.g. `https://lusopronounce.up.railway.app` |
| `APP_ORIGINS` | same as `APP_ORIGIN` (plus custom domain if any) |
| `CORS_ALLOWED_ORIGINS` | same list |
| `SPEECH_CORS_ALLOWED_ORIGINS` | same list |
| `REQUIRE_INVITE_CODE` | `true` |

Server startup will now exit non-zero if any of `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `MONGODB_URI`, or `JWT_SECRET` is missing — if the deploy loops on restart, check these first.

## 3. Apply launch-safe rate limits

Tighter caps while the invite pool is small:

- `GLOBAL_API_MAX=80`
- `SPEECH_RATE_LIMIT_MAX_REQUESTS=8`
- `SPEECH_DAILY_QUOTA=30`

Relax these once you see real traffic patterns. Defaults live in `.env.example`.

## 4. Seed at least one invite code

Run once against the production database (Railway shell or locally with prod `MONGODB_URI`):

```bash
npm run invite:seed -- --code=LAUNCH-ACCESS --maxUses=25
```

Seed a second one with a small cap (e.g. `--maxUses=5`) for the LinkedIn comment giveaway.

## 5. Configure OAuth callback URLs

In each provider's developer console, add the production callback:

- GitHub OAuth app → **Authorization callback URL**:
  `${APP_ORIGIN}/api/auth/oauth/github/callback`
- LinkedIn OAuth app → **Redirect URLs**:
  `${APP_ORIGIN}/api/auth/oauth/linkedin/callback`
- Google Cloud Console → **APIs & Services → Credentials → OAuth 2.0 Client IDs**:
  - Application type: **Web application**
  - Authorized JavaScript origins: `${APP_ORIGIN}`
  - Authorized redirect URI: `${APP_ORIGIN}/api/auth/oauth/google/callback`
  - On the **OAuth consent screen** page: set user type to **External**, add your email as a test user while the app is in Testing, and request scopes `openid`, `email`, `profile`.

Set the corresponding client ID / secret pair in Railway for each provider you want to expose:

- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
- `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

Buttons only appear on the login page for providers whose env vars are set — skip any provider you don't want live.

## 6. Update the README demo link

Edit `README.md` → **Demo** section → replace `_<add your Railway URL here once deployed>_` with the real Railway URL (or custom domain). Commit on `main`.

## 7. External smoke test

From a fresh browser profile (no cached auth):

1. Open the live URL, register with the public invite code.
2. Record one sentence on Practice → confirm word + phoneme feedback renders.
3. Kill network mid-recording → confirm the friendly error copy + **Try again** button.
4. `curl https://<your-domain>/api/health` → verify body includes `"ok": true`, `"mongo.connected": true`, `"speech.configured": true`.
5. Skim Railway logs for the last 10 minutes — no unhandled errors.

## 8. Draft and publish the LinkedIn post

Use the structure from `docs/release-readiness-linkedin-2026-04-17.md` §9A:

1. Hook — "I built a Portuguese pronunciation coach that gives per-word + phoneme feedback in seconds."
2. Problem — sentence-level scoring isn't actionable; I wanted sound-level feedback.
3. Demo proof — a short GIF of one record → score loop.
4. Tech bullets — React + Express + Azure Speech + deterministic coaching engine.
5. CTA — "Comment 'demo' for an invite code" (hand out the capped code from §4).

Record the GIF with Loom/Kap before posting; aim for <20s showing the recording → word scores → phoneme expansion flow.

## 9. Optional / later

- Custom domain via Railway (swap `APP_ORIGIN`, update OAuth callbacks, update README).
- HSTS preload submission (only after you're sure HTTPS is stable long-term; flip `preload: true` in `src/server/app.ts`).
- Redis-backed rate limiting if the app ever scales beyond a single instance.
- A proper "Demo Mode" that runs without auth or Azure spend (design sketch lives in §9B of the release-readiness doc).
