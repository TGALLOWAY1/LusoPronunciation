# LusoPronounce Deployment Assessment

## Executive Summary

LusoPronounce is a **well-architected** Brazilian Portuguese pronunciation trainer built with React 19, Express 5, MongoDB, and Azure Cognitive Services. The codebase is **deployable with moderate changes** — the core architecture is sound, but several gaps must be addressed for a production Azure deployment.

**Key findings:**
- The app is already structured as a unified server (Express serves both API and built frontend)
- Authentication (JWT + bcrypt) is implemented and functional
- Azure Speech integration uses the REST API (not the SDK on the server), making it portable
- The main blockers are: static data file serving, CORS configuration, ffmpeg availability, and no Azure-specific deployment config
- Estimated monthly cost for a portfolio deployment: **$5–15/month** at low scale

**Recommended path:** Deploy as a single **Azure App Service (B1 tier)** with **MongoDB Atlas free tier** and **Azure Blob Storage** for audio — the simplest, cheapest architecture that works.

---

## 1. Current Architecture

### System Flow

```
User (Browser)
     │
     ▼
React 19 SPA (Vite-built, served from Express)
     │  Records audio via MediaRecorder (webm/opus)
     │  Manages state via React Context + localStorage
     │
     ▼  fetch('/api/...')
Express 5 Server (Node.js, port 4000)
     │
     ├── POST /api/auth/register ─── bcrypt hash ──→ MongoDB (User)
     ├── POST /api/auth/login ────── JWT (7-day) ──→ Client localStorage
     │
     ├── POST /api/pronunciation/assessment
     │        │
     │        ├── 1. Multer receives audio blob (in-memory, max 10MB)
     │        ├── 2. ffmpeg converts webm/opus → WAV (16kHz, 16-bit, mono)
     │        ├── 3. REST call to Azure Speech Service (pronunciation assessment)
     │        ├── 4. Normalize response → word scores + phoneme feedback
     │        └── 5. Return to client (client stores via practice log)
     │
     ├── POST /api/practice-sessions ──→ MongoDB (PracticeSession)
     ├── POST /api/pronunciation-attempts ──→ MongoDB (PronunciationAttempt)
     ├── GET  /api/pronunciation-attempts ──→ MongoDB (paginated)
     │
     ├── POST /api/flashcards/ensure ──→ MongoDB (Flashcard, SM-2 SRS)
     ├── GET  /api/flashcards/due ──→ MongoDB (due items)
     ├── POST /api/flashcards/review ──→ MongoDB (update SRS state)
     │
     └── GET  /api/health ──→ DB connection status
```

### Frontend Stack
| Component | Technology |
|-----------|-----------|
| Framework | React 19.2 + TypeScript 5.9 |
| Build | Vite 7.2 |
| Routing | React Router DOM 7.9 (BrowserRouter) |
| Styling | Tailwind CSS 3.4 |
| State | React Context (3 stores: settings, progress, practice log) |
| Persistence | localStorage (primary) + server sync (dual-write) |
| Audio | MediaRecorder API (webm/opus) |
| Icons | Lucide React |

### Backend Stack
| Component | Technology |
|-----------|-----------|
| Runtime | Node.js + Express 5 |
| Database | MongoDB via Mongoose 9 |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Speech | Azure Speech REST API (not SDK) |
| Audio | ffmpeg (via ffmpeg-static or system) |
| Upload | Multer (in-memory) |
| Security | Custom CORS, in-memory rate limiting |

### Database Models (MongoDB)
- **User** — email (unique), passwordHash, displayName, settings
- **PracticeSession** — userId, mode, timestamps, aggregate scores
- **PronunciationAttempt** — userId, sessionId, contentId, scores (overall/accuracy/fluency/completeness), wordScores with phonemes, raw Azure response
- **Flashcard** — userId, contentId, SM-2 SRS fields (interval, easeFactor, reps, lapses, nextDueAt)
- **InviteCode** — code, maxUses, usedCount, expiresAt, isActive

### Environment Variables
| Variable | Required | Purpose |
|----------|----------|---------|
| `AZURE_SPEECH_KEY` | Yes | Azure Speech subscription key |
| `AZURE_SPEECH_REGION` | Yes | Azure region (e.g., eastus) |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | JWT signing key |
| `PORT` | No (default: 4000) | Server port |
| `REQUIRE_INVITE_CODE` | No (default: true) | Gate registration |
| `CORS_ALLOWED_ORIGINS` | For prod | Comma-separated allowed origins |
| `SPEECH_RATE_LIMIT_*` | No | Rate limit tuning |
| `SPEECH_MAX_UPLOAD_BYTES` | No (default: 10MB) | Max audio upload |

### Dev-Only Assumptions
1. **Vite proxy** — `/api` requests proxied to `localhost:4000` during dev; production serves both from Express
2. **CORS defaults** — Hardcoded `localhost:3000/5173`; production requires `CORS_ALLOWED_ORIGINS` env var
3. **Rate limiting** — In-memory store, not distributed; fine for single-instance deployment
4. **Temp files** — ffmpeg uses OS tmpdir per request; requires writable filesystem
5. **Data files** — Fetched via HTTP from `/data/*.json` and `/STATIC DATA/*.json`; these directories may not be served in production
6. **Audio files** — Word audio bundled in dist; sentence audio served from `/public/audio/`

---

## 2. Deployment Blockers

### CRITICAL — Must Fix Before Deployment

#### 2.1 Static Data Files Not Served
**Impact:** App will fail to load sentences/words — core feature broken

The frontend fetches data at runtime:
- `fetch('/data/masterSentences.json')` — 284KB
- `fetch('/data/masterWords.json')` — 201KB
- `fetch('/data/audio_index.json')` — 168KB
- `fetch('/STATIC DATA/sentences.json')` / `words.json`

These files exist on disk but are **not in Vite's `public/` directory** and **not served by Express** (which only serves `dist/`).

**Fix:** Copy `data/` directory contents into `public/data/` so Vite includes them in the build output. Or add Express static middleware for the data directory.

#### 2.2 CORS Not Configured for Production
**Impact:** All pronunciation assessment requests blocked with 403

Default allowed origins are `localhost` only. Production domain must be set via:
```
CORS_ALLOWED_ORIGINS=https://lusopronounce.azurewebsites.net
```

**Fix:** Set environment variable during deployment. Also consider that Azure Static Web Apps + Functions would require a different CORS approach.

#### 2.3 ffmpeg Not Guaranteed in Deployment Environment
**Impact:** Audio conversion fails → pronunciation assessment fails

The server requires ffmpeg to convert browser audio (webm/opus) to WAV for Azure. It checks:
1. `AUDIO_CONVERT_FFMPEG_PATH` env var
2. `ffmpeg-static` npm package (in `optionalDependencies`)
3. System `ffmpeg` command

**Fix:** Move `ffmpeg-static` from `optionalDependencies` to `dependencies`, or ensure the deployment environment has ffmpeg installed (Azure App Service Linux has it, Azure Functions does not).

### HIGH PRIORITY — Should Fix

#### 2.4 No Production Start Script
**Impact:** Deployment platform may not know how to start the server

`package.json` has `"start": "node --import tsx/esm src/server/app.ts"` — this uses `tsx` which is a dev dependency.

**Fix:** Either:
- Add `tsx` to production dependencies, or
- Compile server TypeScript separately (e.g., with `tsc` targeting server files), or
- Use `ts-node` in production, or
- Add a build step that bundles the server

#### 2.5 Railway.json Exists But No Azure Config
The project has a `railway.json` config but no Azure-specific deployment files (no `azure-pipelines.yml`, no `web.config`, no Azure Functions project).

**Fix:** Create appropriate Azure deployment configuration.

### MODERATE — Should Address

#### 2.6 Invite Code System Blocks Registration
By default, `REQUIRE_INVITE_CODE=true`. New users cannot register without a valid invite code, and there's no admin UI to create codes.

**Fix:** Either set `REQUIRE_INVITE_CODE=false` for the portfolio demo, or seed an invite code in MongoDB.

#### 2.7 No Audio Recording Storage
Recorded audio is processed in-memory and discarded after scoring. Users cannot replay their own recordings later (only scores are saved).

**Fix for V1:** Acceptable — just save scores. Future: upload to Blob Storage.

#### 2.8 Security Hardening
- No HTTPS enforcement (relies on platform)
- No helmet.js middleware
- No request body size limit on non-pronunciation routes
- JWT secret must be strong in production

---

## 3. Azure Architecture (Low Cost)

### Recommended Architecture: Single App Service

```
┌──────────────────────────────────────────────────────┐
│                    AZURE CLOUD                        │
│                                                       │
│  ┌─────────────────────────────────────────────┐     │
│  │  Azure App Service (B1 - Linux)             │     │
│  │  $13/month                                   │     │
│  │                                               │     │
│  │  Express 5 Server                             │     │
│  │  ├── Serves React SPA (dist/)                │     │
│  │  ├── /api/auth/* (JWT auth)                  │     │
│  │  ├── /api/pronunciation/* (assessment)       │     │
│  │  ├── /api/practice-sessions/*                │     │
│  │  ├── /api/flashcards/*                       │     │
│  │  └── ffmpeg (audio conversion)               │     │
│  └──────────┬────────────┬───────────────────────┘     │
│             │            │                             │
│             ▼            ▼                             │
│  ┌──────────────┐  ┌─────────────────────┐           │
│  │ Azure Speech  │  │  MongoDB Atlas      │           │
│  │ Service       │  │  (M0 Free Tier)     │           │
│  │ (Pay-as-go)   │  │  512MB, shared)     │           │
│  │ $1/1000 calls │  │  $0/month           │           │
│  └──────────────┘  └─────────────────────┘           │
│                                                       │
│  ┌──────────────────────────────────────────────┐     │
│  │  Azure Blob Storage (optional, future)       │     │
│  │  For audio recordings if replay needed       │     │
│  │  ~$0.02/GB/month                              │     │
│  └──────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────┘
```

### Why This Architecture

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Compute** | Azure App Service B1 ($13/mo) | Single container, always-on, supports Node.js + ffmpeg, includes SSL + custom domain, no cold starts |
| **Database** | MongoDB Atlas M0 (Free) | Free tier is 512MB shared cluster; more than enough for a portfolio app with hundreds of users. No Azure lock-in. |
| **Speech** | Azure Speech Service (S0 pay-as-go) | Already integrated; $1 per 1,000 transactions. At 10 users doing 20 assessments/day = 6,000/month = ~$6 |
| **Storage** | Azure Blob (optional) | Only needed if audio replay is added. $0.02/GB/month. |
| **Auth** | Keep existing JWT | Already implemented, works well, no additional cost |
| **DNS/SSL** | App Service managed | Free SSL with `*.azurewebsites.net` subdomain; custom domain supported |

### Why NOT Serverless (Azure Functions)

The current architecture is **not a good fit for serverless** because:
1. **ffmpeg dependency** — Azure Functions doesn't have ffmpeg installed; would need a custom Docker image or a separate conversion service
2. **In-memory file processing** — The audio pipeline writes temp files, which is awkward on serverless
3. **Cold start latency** — Pronunciation assessment needs fast response; cold starts add 3-10 seconds
4. **Express middleware chain** — Would need rewriting for Azure Functions HTTP triggers
5. **Cost at low scale** — App Service B1 is cheaper than Functions + premium plan when you need always-on

### Alternative: Even Cheaper with Free Tier

Azure App Service has an **F1 Free tier** (60 CPU-minutes/day, 1GB RAM, no custom domain, no always-on). This could work for initial testing but:
- 60 CPU-minutes/day may be tight with ffmpeg conversions
- No custom domain (stuck with `*.azurewebsites.net`)
- Sleeps after inactivity (cold starts)
- No SSL for custom domains

**Recommendation:** Start with F1 Free for testing, upgrade to B1 ($13/mo) for the portfolio showcase.

---

## 4. Estimated Monthly Cost

### Scenario: 2 Active Users (~40 assessments/month)

| Service | Tier | Usage | Monthly Cost |
|---------|------|-------|-------------|
| App Service | F1 Free | 60 CPU-min/day | **$0** |
| MongoDB Atlas | M0 Free | <100MB data | **$0** |
| Azure Speech | S0 | 40 transactions | **$0.04** |
| Bandwidth | included | <1GB | **$0** |
| **Total** | | | **~$0.04/month** |

### Scenario: 10 Active Users (~3,000 assessments/month)

| Service | Tier | Usage | Monthly Cost |
|---------|------|-------|-------------|
| App Service | B1 Basic | Always-on, 1.75GB RAM | **$13.00** |
| MongoDB Atlas | M0 Free | <500MB data | **$0** |
| Azure Speech | S0 | 3,000 transactions | **$3.00** |
| Bandwidth | 5GB/month | included in B1 | **$0** |
| Blob Storage | LRS | 1GB (if audio saved) | **$0.02** |
| **Total** | | | **~$16/month** |

### Scenario: 100 Active Users (~30,000 assessments/month)

| Service | Tier | Usage | Monthly Cost |
|---------|------|-------|-------------|
| App Service | B1 Basic | Same tier handles this | **$13.00** |
| MongoDB Atlas | M2 | 2GB, dedicated | **$9.00** |
| Azure Speech | S0 | 30,000 transactions | **$30.00** |
| Bandwidth | 50GB/month | ~$4 overage | **$4.00** |
| Blob Storage | LRS | 10GB | **$0.20** |
| **Total** | | | **~$56/month** |

### Cost Optimization Tips
- Use **Azure Speech free tier** first: 5,000 free transactions/month (F0 tier)
- MongoDB Atlas free tier is sufficient up to ~50 active users
- App Service F1 is free but limited; B1 at $13/mo is the sweet spot
- Audio blob storage is negligible cost; don't over-optimize

---

## 5. Authentication Design

### Current Implementation (Keep It)

The app already has a solid JWT authentication system. **No need to add Azure Entra, Clerk, or Firebase Auth** — they add complexity and cost without benefit for a portfolio app.

### Current Auth Flow

```
Registration:
  Client → POST /api/auth/register { email, password, inviteCode? }
         → Server validates invite code (if required)
         → bcrypt hash password (10 rounds)
         → Create User document in MongoDB
         → Sign JWT { userId, email } (expires 7 days)
         → Return { token, user }
         → Client stores token in localStorage

Login:
  Client → POST /api/auth/login { email, password }
         → Server loads user by email
         → bcrypt.compare(password, hash)
         → Sign JWT { userId, email } (expires 7 days)
         → Return { token, user }
         → Client stores token in localStorage
         → Client pings /api/pronunciation/speech-health

API Calls:
  Client → fetch('/api/...', { headers: { Authorization: 'Bearer <token>' } })
         → requireAuth middleware validates JWT
         → Attaches { userId, email } to req.user
         → Route handler uses req.user.userId for data isolation
```

### Recommended Security Improvements for Production

1. **Strong JWT_SECRET** — Generate with `openssl rand -hex 64`
2. **HTTPS only** — Azure App Service handles this automatically
3. **HttpOnly cookies** (future improvement) — Currently tokens are in localStorage, which is XSS-vulnerable. For V1, this is acceptable given the low-risk nature of the data.
4. **Rate limit login attempts** — Currently only pronunciation endpoints are rate-limited; add rate limiting to `/api/auth/login`
5. **Invite codes for V1** — Keep `REQUIRE_INVITE_CODE=true` and seed 1-2 codes. This limits abuse and looks intentional to recruiters ("invite-only beta").

### Why Not Third-Party Auth

| Option | Pros | Cons |
|--------|------|------|
| Azure Entra External ID | Native to Azure | Complex setup, overkill for portfolio, Microsoft-specific UI |
| Clerk | Beautiful UI | $0 for 10k MAU but adds dependency, requires frontend changes |
| Firebase Auth | Free tier | Google dependency, different ecosystem, JWT federation needed |
| Supabase Auth | Free tier | Pulls toward Supabase ecosystem, PostgreSQL bias |
| **Keep existing JWT** | **Zero cost, already built, full control, demonstrates auth skills** | **No social login, no MFA** |

**Recommendation:** Keep the existing JWT auth. It demonstrates you understand auth fundamentals (hashing, tokens, middleware). A recruiter will appreciate seeing a hand-rolled auth system over a plug-and-play service.

---

## 6. Audio Upload Architecture

### Current Pipeline (Works Well)

```
Browser                          Server                         Azure
  │                                │                              │
  ├─ MediaRecorder (webm/opus)     │                              │
  ├─ Quality gate (duration,       │                              │
  │  silence detection)            │                              │
  │                                │                              │
  ├─ POST /api/pronunciation/      │                              │
  │  assessment (FormData)         │                              │
  │  [audio blob + metadata]       │                              │
  │                                │                              │
  │                    Multer ─────┤                              │
  │                    (in-memory,  │                              │
  │                     max 10MB)   │                              │
  │                                │                              │
  │                    ffmpeg ─────┤                              │
  │                    webm→WAV     │                              │
  │                    (16kHz,      │                              │
  │                     16-bit,     │                              │
  │                     mono)       │                              │
  │                                │                              │
  │                                ├─ REST POST ─────────────────→│
  │                                │  audio/wav +                  │
  │                                │  Pronunciation-Assessment     │
  │                                │  header (base64 config)       │
  │                                │                              │
  │                                │←── JSON response ────────────┤
  │                                │  word scores, phonemes,       │
  │                                │  overall scores               │
  │                                │                              │
  │←── JSON response ──────────────┤                              │
  │  normalized AttemptScore        │                              │
  │                                │                              │
  ├─ Store in PracticeLogStore     │                              │
  │  (localStorage + API sync)     │                              │
  └─ Update flashcard (SRS)        │                              │
```

### Security Controls (Already Implemented)
- **File size limit:** 10MB (configurable via `SPEECH_MAX_UPLOAD_BYTES`)
- **In-memory processing:** No user audio persisted to disk permanently
- **Rate limiting:** 20 requests per 5 minutes per user/IP
- **Auth required:** Only authenticated users can submit
- **CORS validation:** Origin whitelist enforcement
- **Temp file cleanup:** Guaranteed cleanup in finally block
- **ffmpeg timeout:** 10-second conversion timeout prevents hanging

### Recommended Improvements for Production

1. **Add content-type validation** — Verify the uploaded file is actually audio (check magic bytes, not just MIME type)
2. **Reduce max upload size** — 10MB is generous; 2MB is sufficient for 30-second recordings at webm/opus quality
3. **Add request timeout** — Overall request timeout of 30 seconds (Azure assessment typically takes 2-5 seconds)
4. **Monitor ffmpeg memory** — Each conversion buffers the full file; at 10 concurrent users this could use 100MB+ of RAM

### Future: Audio Recording Storage (V2)

If users want to replay their recordings:
```
Upload → API → Blob Storage (with SAS token, 30-day TTL)
                    │
                    ├── Container: recordings/{userId}/{attemptId}.webm
                    ├── Access: Private (SAS tokens for playback)
                    └── Lifecycle: Auto-delete after 30 days
```

Cost: ~$0.02/GB/month. At 1MB per recording, 1,000 recordings = 1GB = $0.02/month.

---

## 7. Portfolio Credibility Improvements

### High Impact, Low Effort

1. **Recruiter Demo Mode**
   - Add a `/demo` route with pre-loaded sample data
   - Show example pronunciation assessments without requiring Azure credentials
   - Include a "View as recruiter" toggle that explains the architecture
   - *Demonstrates:* UX thinking, progressive disclosure

2. **Architecture Diagram Page**
   - Add a `/about` or `/architecture` page with the system diagram
   - Show the data flow from recording to scoring
   - Link to relevant code files
   - *Demonstrates:* System design thinking

3. **Pronunciation History Visualization**
   - Already have attempt data; add a chart showing score trends over time
   - Group by word/sentence difficulty
   - Show improvement trajectory
   - *Demonstrates:* Data visualization, analytics

4. **Phoneme Confusion Matrix**
   - The coaching engine already detects confusion patterns
   - Visualize which phoneme pairs are most commonly confused
   - *Demonstrates:* Domain expertise, data analysis

### Medium Impact, Medium Effort

5. **Real-Time Waveform Display**
   - Show audio waveform during recording (Web Audio API analyser node)
   - Provides visual feedback that the microphone is working
   - *Demonstrates:* Web Audio API proficiency

6. **Offline-First with Service Worker**
   - Add a service worker for offline capability
   - Cache static data, queue assessments when offline
   - *Demonstrates:* PWA skills, resilience engineering

7. **API Documentation Page**
   - Auto-generate or hand-write API docs
   - Show request/response examples
   - *Demonstrates:* API design, documentation skills

### Technical Depth Signals

8. **Performance Monitoring Dashboard** (already partially built in dev pages)
   - Expose latency metrics (recording → assessment → response)
   - Show Azure Speech API response times
   - *Demonstrates:* Observability, performance engineering

9. **Error Telemetry** (already partially built)
   - Surface the error taxonomy and failure rates
   - Show retry patterns and graceful degradation
   - *Demonstrates:* Production-readiness thinking

10. **Spaced Repetition Visualization**
    - Show the SM-2 algorithm in action (next review dates, ease factors)
    - Explain the learning science behind the system
    - *Demonstrates:* Algorithm implementation, learning science

---

## 8. Deployment Plan

### Phase 1: Repository Preparation (30 minutes)

**Step 1.1: Fix static data serving**
```bash
# Copy data files to public directory so Vite includes them in the build
mkdir -p public/data
cp data/masterSentences.json public/data/
cp data/masterWords.json public/data/
cp data/audio_index.json public/data/
# If 'STATIC DATA' is also needed:
mkdir -p "public/STATIC DATA"
cp "STATIC DATA/sentences.json" "public/STATIC DATA/"
cp "STATIC DATA/words.json" "public/STATIC DATA/"
```

**Step 1.2: Ensure ffmpeg-static is a production dependency**
```bash
npm install ffmpeg-static --save  # Move from optionalDependencies to dependencies
```

**Step 1.3: Add security headers**
Install and configure `helmet`:
```bash
npm install helmet
```
Add to `src/server/app.ts`:
```typescript
import helmet from 'helmet';
app.use(helmet());
```

**Step 1.4: Verify build succeeds**
```bash
npm run build
npm start  # Test locally in production mode
```

### Phase 2: Azure Resource Setup (20 minutes)

**Step 2.1: Create Azure resources**
```bash
# Login to Azure CLI
az login

# Create resource group
az group create --name rg-lusopronounce --location eastus

# Create App Service plan (B1 for production, F1 for testing)
az appservice plan create \
  --name plan-lusopronounce \
  --resource-group rg-lusopronounce \
  --sku B1 \
  --is-linux

# Create Web App
az webapp create \
  --name lusopronounce \
  --resource-group rg-lusopronounce \
  --plan plan-lusopronounce \
  --runtime "NODE:20-lts"

# Create Azure Speech Service (F0 free tier first)
az cognitiveservices account create \
  --name speech-lusopronounce \
  --resource-group rg-lusopronounce \
  --kind SpeechServices \
  --sku F0 \
  --location eastus \
  --yes
```

**Step 2.2: Get Speech Service key**
```bash
az cognitiveservices account keys list \
  --name speech-lusopronounce \
  --resource-group rg-lusopronounce
```

### Phase 3: Database Setup (10 minutes)

**Step 3.1: Create MongoDB Atlas free cluster**
1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create M0 free cluster (AWS us-east-1 or Azure eastus)
3. Create database user
4. Whitelist Azure App Service outbound IPs (or use 0.0.0.0/0 for simplicity)
5. Get connection string: `mongodb+srv://user:pass@cluster.mongodb.net/lusopronounce`

**Step 3.2: Seed invite code (optional)**
```bash
# Connect to MongoDB and insert an invite code
mongosh "mongodb+srv://..." --eval '
  db.invitecodes.insertOne({
    code: "PORTFOLIO2024",
    maxUses: 100,
    usedCount: 0,
    usedBy: [],
    createdBy: "admin",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  })
'
```

### Phase 4: Environment Configuration (5 minutes)

**Step 4.1: Set environment variables in Azure**
```bash
az webapp config appsettings set \
  --name lusopronounce \
  --resource-group rg-lusopronounce \
  --settings \
    AZURE_SPEECH_KEY="<your-key>" \
    AZURE_SPEECH_REGION="eastus" \
    MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/lusopronounce" \
    JWT_SECRET="$(openssl rand -hex 64)" \
    PORT="8080" \
    REQUIRE_INVITE_CODE="true" \
    CORS_ALLOWED_ORIGINS="https://lusopronounce.azurewebsites.net" \
    NODE_ENV="production"
```

### Phase 5: Deploy (10 minutes)

**Step 5.1: Configure deployment**
```bash
# Set deployment source to local git or GitHub
az webapp deployment source config-local-git \
  --name lusopronounce \
  --resource-group rg-lusopronounce

# OR use GitHub Actions (recommended)
az webapp deployment github-actions add \
  --name lusopronounce \
  --resource-group rg-lusopronounce \
  --repo TGALLOWAY1/LusoPronunciation \
  --branch main
```

**Step 5.2: Create startup command**
Azure App Service needs to know how to start the app:
```bash
az webapp config set \
  --name lusopronounce \
  --resource-group rg-lusopronounce \
  --startup-file "npm start"
```

**Step 5.3: Deploy and verify**
```bash
# Push to trigger deployment (if using Git)
git push azure main

# Check deployment logs
az webapp log tail --name lusopronounce --resource-group rg-lusopronounce

# Verify health
curl https://lusopronounce.azurewebsites.net/api/health
```

### Phase 6: Security Hardening (10 minutes)

**Step 6.1: Force HTTPS**
```bash
az webapp update \
  --name lusopronounce \
  --resource-group rg-lusopronounce \
  --https-only true
```

**Step 6.2: Custom domain (optional)**
```bash
# Add custom domain
az webapp config hostname add \
  --webapp-name lusopronounce \
  --resource-group rg-lusopronounce \
  --hostname lusopronounce.com

# Enable managed SSL
az webapp config ssl bind \
  --name lusopronounce \
  --resource-group rg-lusopronounce \
  --certificate-thumbprint <thumbprint> \
  --ssl-type SNI
```

### Phase 7: Post-Deployment Verification

```bash
# 1. Health check
curl https://lusopronounce.azurewebsites.net/api/health

# 2. Register a test user
curl -X POST https://lusopronounce.azurewebsites.net/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123","inviteCode":"PORTFOLIO2024"}'

# 3. Login
curl -X POST https://lusopronounce.azurewebsites.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# 4. Check Azure Speech health
curl https://lusopronounce.azurewebsites.net/api/pronunciation/speech-health \
  -H "Authorization: Bearer <token>"

# 5. Open in browser and test full flow
open https://lusopronounce.azurewebsites.net
```

---

## 9. V1 Scope Recommendations

### Keep for V1 (Core Value)
- User registration/login (JWT)
- Sentence and word pronunciation practice
- Audio recording → Azure assessment → scoring
- Word-by-word score display with phoneme feedback
- Practice session tracking
- Flashcard/SRS review system
- Responsive mobile/desktop layout

### Simplify for V1
- **Invite codes:** Keep enabled but seed 1-2 codes. Looks intentional ("invite-only beta")
- **Audio storage:** Don't save recordings. Score data is sufficient for V1
- **Rate limits:** Keep the in-memory rate limiter. It's fine for single-instance
- **Analytics:** Keep dev pages but don't expose to users yet
- **Coaching engine:** Keep it — it's a strong differentiator

### Remove/Defer for V1
- **Data migration endpoint** (`/api/migrate/local-storage`) — Not needed for fresh deployment
- **Dev-only pages** — Already tree-shaken in production build, no action needed
- **Multiple voice genders** — Keep both if audio files are already generated; skip generating new ones
- **Complex error telemetry** — localStorage telemetry is fine; don't add server-side telemetry infrastructure

### Infrastructure Simplifications
- **Use MongoDB Atlas free tier** instead of Azure CosmosDB — saves ~$25/month
- **Use Azure Speech F0 (free)** first — 5,000 transactions/month free
- **Start with F1 free App Service** — upgrade to B1 only when needed
- **Skip Blob Storage** until audio replay is implemented
- **Skip custom domain** initially — `lusopronounce.azurewebsites.net` is fine for portfolio

---

## 10. Final Recommendation

### The Fastest Path to Live

1. **Fix the 3 critical blockers** (~1 hour):
   - Copy data files to `public/` directory
   - Ensure ffmpeg-static is in production dependencies
   - Verify `npm run build && npm start` works locally

2. **Create Azure resources** (~30 minutes):
   - App Service (F1 free tier)
   - Speech Service (F0 free tier)
   - MongoDB Atlas (M0 free tier)

3. **Deploy and configure** (~30 minutes):
   - Set environment variables
   - Push code
   - Verify health endpoint
   - Test full registration → practice → scoring flow

4. **Upgrade when ready** (~10 minutes):
   - F1 → B1 ($13/month) for always-on and custom domain
   - F0 → S0 Speech when you exceed 5,000 transactions/month

### Total Estimated Time: 2-3 hours
### Total Estimated Cost: $0-16/month

### What Makes This Portfolio-Ready

The app already demonstrates:
- **Full-stack development** (React + Express + MongoDB)
- **External API integration** (Azure Speech)
- **Audio processing** (MediaRecorder, ffmpeg, WAV conversion)
- **Authentication** (JWT, bcrypt, middleware)
- **Spaced repetition algorithm** (SM-2)
- **Error handling** (typed errors, telemetry, graceful degradation)
- **Responsive design** (Tailwind, mobile-first)
- **Testing** (Vitest unit/contract, Playwright e2e)

The deployment itself demonstrates:
- **Cloud architecture** (Azure App Service, managed services)
- **Security** (CORS, rate limiting, input validation, HTTPS)
- **Cost optimization** (free tiers, right-sizing)
- **DevOps** (CI/CD, environment configuration, health checks)

This is a strong portfolio piece. Ship it.
