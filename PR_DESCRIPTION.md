# Migrate to Better Storage: Backend API, Auth, and MongoDB Persistence

## Overview

This PR introduces a complete backend infrastructure for LusoPronunciation, migrating from a localStorage-only approach to a MongoDB-backed system with authentication, while maintaining backward compatibility through dual-write patterns.

## What's Changed

### 🏗️ Backend Infrastructure

- **Express App Shell** (`src/server/app.ts`)
  - Full Express server with CORS and JSON body parsing
  - MongoDB connection management with health checks
  - Server starts only after successful DB connection
  - Runs on port 4000 (configurable via `PORT` env var)

- **MongoDB Client** (`src/server/db/mongoClient.ts`)
  - Singleton connection manager using Mongoose
  - Reads `MONGODB_URI` from environment
  - Exposes `connectMongo()`, `getMongoStatus()`, and `disconnectMongo()`
  - Health route reports MongoDB connection status

### 🔐 Authentication System

- **JWT-Based Auth** (`src/server/routes/auth.ts`, `src/server/middleware/auth.ts`)
  - `POST /api/auth/register` - User registration with email/password
  - `POST /api/auth/login` - User login with JWT token generation
  - Auth middleware (`requireAuth`) for protecting routes
  - Tokens expire after 7 days
  - Password hashing with bcrypt (10 salt rounds)

- **Frontend Auth Integration**
  - Auth API client with token management (`src/api/auth.ts`)
  - Login/Register UI (`src/pages/AuthPage.tsx`, `src/components/auth/AuthForm.tsx`)
  - `authenticatedFetch()` helper for API requests with automatic auth headers

### 📊 Data Models & Shared Types

- **Shared Types** (`src/shared/types/`)
  - `User`, `PracticeSession`, `PronunciationAttempt` types
  - `ContentType`, `PracticeContentRef`, `PronunciationScores` utilities
  - Used by both frontend and backend for type safety

- **MongoDB Models** (`src/server/models/`)
  - `UserModel` - User accounts with email, passwordHash, settings
  - `PracticeSessionModel` - Practice sessions with indexes on `{ userId, startedAt }`
  - `PronunciationAttemptModel` - Pronunciation attempts with indexes on `{ userId, createdAt }` and `{ userId, contentId }`
  - `FlashcardModel` - SRS flashcards with indexes on `{ userId, nextDueAt }`

- **Mappers** (`src/server/mappers/`)
  - Convert MongoDB documents to DTOs
  - Handle `_id` → `id` conversion and date formatting

### 🎯 Practice Data Persistence

- **Practice Routes** (`src/server/routes/practice.ts`)
  - `POST /api/practice-sessions` - Create practice session
  - `PATCH /api/practice-sessions/:id/complete` - Complete session
  - `POST /api/pronunciation-attempts` - Log pronunciation attempt
  - `GET /api/pronunciation-attempts` - Fetch attempts with pagination
  - All routes require authentication and enforce user ownership

- **Dual-Write Integration**
  - `practiceLogStore.tsx` now writes to both localStorage (existing UX) and API (when authenticated)
  - Tracks server session IDs mapped to local session IDs
  - Graceful degradation: API failures don't block local storage
  - Maintains instant local behavior while syncing to cloud

### 🔄 Migration System

- **Migration Endpoint** (`src/server/routes/migration.ts`)
  - `POST /api/migrate/local-storage` - One-time migration from localStorage to MongoDB
  - Idempotent: checks for duplicates before importing
  - Maps legacy sessionIds to new Mongo _ids for attempt linking
  - Returns summary: `{ importedSessions, importedAttempts, skippedSessions, skippedAttempts, errors }`

- **Auto-Migration** (`src/features/migration/LocalStorageMigrator.tsx`)
  - Runs automatically on app load for authenticated users
  - Checks `localStorage.getItem('luso_cloud_migrated')` to avoid duplicate migrations
  - Reads from `PracticeLogStore` and `ProgressStore`
  - Sets migration flag on success

### 📚 Spaced Repetition System (SRS)

- **Flashcard Model** (`src/server/models/FlashcardModel.ts`)
  - SRS fields: `nextDueAt`, `intervalDays`, `easeFactor`, `reps`, `lapses`, `lastScore`, `lastOutcome`
  - `history` array linking to `PronunciationAttempt` IDs
  - Indexes for efficient due queue queries

- **Flashcard Routes** (`src/server/routes/flashcards.ts`)
  - `GET /api/flashcards/due` - Fetch flashcards due for review
  - `POST /api/flashcards/review` - Record review and update SRS state
  - `POST /api/flashcards/ensure` - Ensure flashcard exists

- **SRS Service** (`src/server/services/flashcardService.ts`)
  - SM-2 algorithm implementation for interval calculation
  - Auto-grading: maps pronunciation scores to review outcomes
    - `< 50`: 'again' (immediate review)
    - `< 70`: 'hard' (shorter interval)
    - `< 90`: 'good' (normal interval)
    - `>= 90`: 'easy' (longer interval)

- **Auto-Integration**
  - Flashcards automatically created when attempts are logged
  - SRS state updated based on pronunciation scores
  - Works for both sentence and word practice

## Technical Details

### Environment Variables Required

```bash
MONGODB_URI=mongodb://localhost:27017/lusopronunciation
JWT_SECRET=your-secret-key-here
AZURE_SPEECH_KEY=your-azure-key
AZURE_SPEECH_REGION=your-azure-region
PORT=4000  # Optional, defaults to 4000
```

### API Endpoints

**Public:**
- `GET /api/health` - Health check with MongoDB status

**Authenticated:**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `POST /api/practice-sessions` - Create practice session
- `PATCH /api/practice-sessions/:id/complete` - Complete session
- `POST /api/pronunciation-attempts` - Log attempt
- `GET /api/pronunciation-attempts` - Fetch attempts
- `POST /api/migrate/local-storage` - Migrate localStorage data
- `GET /api/flashcards/due` - Get due flashcards
- `POST /api/flashcards/review` - Review flashcard
- `POST /api/flashcards/ensure` - Ensure flashcard exists

### Database Indexes

- **Users**: `{ email: 1 }`
- **Practice Sessions**: `{ userId: 1, startedAt: -1 }`
- **Pronunciation Attempts**: `{ userId: 1, createdAt: -1 }`, `{ userId: 1, contentId: 1 }`
- **Flashcards**: `{ userId: 1, nextDueAt: 1 }`, `{ userId: 1, contentId: 1, contentType: 1 }` (unique)

## Backward Compatibility

- ✅ Existing localStorage-based practice flow continues to work
- ✅ Unauthenticated users can still use the app (localStorage only)
- ✅ Authenticated users get dual-write (localStorage + API)
- ✅ Migration runs automatically once per user
- ✅ ProgressStore and weak items logic still functional (gradual transition planned)

## Testing

- All TypeScript type checks pass
- No linter errors
- Backend routes tested with proper auth middleware
- Frontend integration maintains existing UX

## Next Steps (Future Work)

- [ ] Gradually shift to server data as source of truth for authenticated users
- [ ] Add flashcard review UI mode
- [ ] Enhance migration to include progress/weak items data
- [ ] Add content text (textPt, textEn) to attempt logging
- [ ] Consider deprecating localStorage once migration is complete

## Breaking Changes

None - this is fully backward compatible. All existing functionality continues to work.
