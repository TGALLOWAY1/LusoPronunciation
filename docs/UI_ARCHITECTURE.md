# UI Architecture Plan

## Current Stack Assessment

**Status**: No frontend framework is currently set up. The repository contains:
- TypeScript models in `src/models/` (appData, content, practice, progress, vocab, audio)
- Static JSON data files in `STATIC DATA/` (sentences.json, words.json)
- Audio index in `data/audio_index.json`
- Audio files in `audio/ptbr/male/` and `audio/ptbr/female/`
- A simple vanilla HTML debug page at `debug/audio-check.html`
- Package.json with only Azure TTS dependencies (no frontend framework)

## Recommended Stack

**Primary Recommendation**: **Vite + React + TypeScript + Tailwind CSS**

**Rationale**:
- Lightweight and fast development experience (Vite)
- Modern component-based architecture (React)
- Type safety with existing TypeScript models
- Utility-first CSS (Tailwind) for rapid UI development
- Excellent for static hosting (Vercel, Netlify)
- Offline-friendly with proper build configuration

**Alternative Options**:
- **Next.js** (if SSR/SSG benefits are needed, but may be overkill)
- **SvelteKit** (ultra-lightweight, but less ecosystem)
- **Vanilla TypeScript** (as mentioned in README, but more manual work)

## Proposed File Structure

```
src/
├── app/                    # Main application entry and routing
│   ├── App.tsx             # Root component with routing
│   ├── main.tsx            # Entry point
│   └── routes.tsx          # Route definitions
│
├── pages/                  # Screen-level components
│   ├── Dashboard.tsx
│   ├── SentencePractice.tsx
│   ├── WordPractice.tsx
│   └── Review.tsx
│
├── components/
│   ├── layout/             # Layout components
│   │   ├── Header.tsx
│   │   ├── Navigation.tsx
│   │   ├── Sidebar.tsx
│   │   └── Layout.tsx
│   │
│   ├── practice/           # Practice-specific components
│   │   ├── SentenceCard.tsx
│   │   ├── WordCard.tsx
│   │   ├── AudioPlayer.tsx
│   │   ├── RecordingControls.tsx
│   │   ├── ScoreDisplay.tsx
│   │   ├── FeedbackPanel.tsx
│   │   └── PronunciationTips.tsx
│   │
│   ├── dashboard/          # Dashboard-specific components
│   │   ├── CategoryProgress.tsx
│   │   ├── DailyStats.tsx
│   │   ├── QuickPracticeButton.tsx
│   │   └── ProgressChart.tsx
│   │
│   └── common/             # Reusable UI components
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── ProgressBar.tsx
│       ├── Badge.tsx
│       ├── Modal.tsx
│       └── LoadingSpinner.tsx
│
├── hooks/                  # Custom React hooks
│   ├── useAudio.ts         # Audio playback management
│   ├── useRecording.ts     # Browser MediaRecorder API
│   ├── usePronunciation.ts # Pronunciation scoring logic
│   ├── useProgress.ts      # Progress tracking
│   ├── useSpacedRepetition.ts # Spaced repetition algorithm
│   └── useDataLoader.ts    # Load static JSON data
│
├── lib/                    # Utilities and services
│   ├── dataLoader.ts       # Load sentences.json, words.json, audio_index.json
│   ├── audioService.ts     # Audio file path resolution
│   ├── pronunciationService.ts # Azure Speech SDK integration
│   ├── storage.ts          # LocalStorage persistence for progress
│   └── spacedRepetition.ts # Algorithm implementation
│
├── models/                 # TypeScript type definitions (existing)
│   ├── appData.ts
│   ├── content.ts
│   ├── practice.ts
│   ├── progress.ts
│   ├── vocab.ts
│   └── audio.ts
│
└── styles/                 # Global styles
    ├── index.css           # Tailwind imports + global styles
    └── variables.css       # CSS custom properties
```

## Main Screens

### 1. Dashboard (`pages/Dashboard.tsx`)

**Purpose**: Overview of progress, quick access to practice modes, daily goals

**Key Components**:
- `CategoryProgress` - Progress bars for each category (food, travel, etc.)
- `DailyStats` - Today's attempts, XP, minutes practiced
- `QuickPracticeButton` - One-click start for sentence/word practice
- `ProgressChart` - Visual progress over time (optional)

**Data Sources**:
- `STATIC DATA/sentences.json` - For category counts
- `STATIC DATA/words.json` - For category counts
- LocalStorage - For progress data (sentenceAttempts, wordStates, dailySummaries)

### 2. Sentence Practice (`pages/SentencePractice.tsx`)

**Purpose**: Practice pronouncing full sentences with audio feedback

**Key Components**:
- `SentenceCard` - Displays Portuguese sentence + English translation
- `AudioPlayer` - Play native audio (male/female toggle)
- `RecordingControls` - Record button, stop, playback of user recording
- `ScoreDisplay` - Overall score (0-100) with breakdown (accuracy, fluency, completeness)
- `FeedbackPanel` - Word-level feedback with error types
- `PronunciationTips` - Display pronunciation_notes from data

**Data Flow**:
1. Load sentences from `STATIC DATA/sentences.json`
2. Resolve audio path via `data/audio_index.json` → `audio/ptbr/{gender}/{category}_{id}.wav`
3. Record user audio via MediaRecorder API
4. Score via Azure Speech SDK (or mock for development)
5. Save attempt to LocalStorage (SentenceAttempt, SentenceProgress)

### 3. Word Practice (`pages/WordPractice.tsx`)

**Purpose**: Fast-paced word pronunciation drills

**Key Components**:
- `WordCard` - Single word display (Portuguese + English)
- `AudioPlayer` - Play native word audio
- `RecordingControls` - Quick record/replay loop
- `ScoreDisplay` - Simplified score for single word
- `PronunciationTips` - Show trickyFeature and pronunciation_notes

**Data Flow**:
1. Load words from `STATIC DATA/words.json`
2. Resolve audio path via `data/audio_index.json` → `audio/ptbr/{gender}/{category}_word_{id}.wav`
3. Record and score (similar to sentences)
4. Update WordState for spaced repetition

### 4. Review / Spaced Repetition (`pages/Review.tsx`)

**Purpose**: Review words/sentences based on spaced repetition algorithm

**Key Components**:
- `ReviewQueue` - List of items due for review
- `SentenceCard` or `WordCard` - Reuse practice components
- `SpacedRepetitionControls` - Mark correct/incorrect, update intervals
- `ReviewStats` - Show progress through review session

**Data Flow**:
1. Load WordState and SentenceProgress from LocalStorage
2. Filter items where `dueAt <= now` or `intervalDays === 0`
3. Present items one at a time
4. On response, update WordState (easeFactor, intervalDays, dueAt)
5. Persist to LocalStorage

## Data Loading Strategy

### Data Loading Utilities (`src/lib/data.ts`)

The data loading system provides tree-shakeable, cached functions to load and filter sentences and words.

**Main Functions**:

```typescript
// Load all data (cached after first call)
const sentences = await loadAllSentences();
const words = await loadAllWords();
const categories = await loadAllCategories();

// Filter functions
const foodSentences = filterSentencesByCategory(sentences, 'food');
const easySentences = filterSentencesByDifficulty(sentences, 1, 2);
const difficultWords = filterWordsDifficultForEnglish(words, true);

// Get single items
const sentence = await getSentenceById('food_001');
const word = await getWordById('food_word_001');
```

**Features**:
- **Caching**: Data is loaded once and cached in memory
- **Type Safety**: Full TypeScript types matching JSON schema
- **Transformation**: Automatically transforms raw JSON to app-friendly format
- **Audio Resolution**: Automatically resolves audio URLs from audio_index.json or infers from naming convention

**Usage in Components**:

```typescript
import { loadAllSentences, filterSentencesByCategory } from '@/lib/data';

function SentencePractice() {
  const [sentences, setSentences] = useState<Sentence[]>([]);
  
  useEffect(() => {
    loadAllSentences().then(setSentences);
  }, []);
  
  const foodSentences = useMemo(
    () => filterSentencesByCategory(sentences, 'food'),
    [sentences]
  );
}
```

### Audio File Resolution (`src/lib/audio.ts`)

Audio URLs are resolved through the audio index or inferred from naming conventions.

**Functions**:

```typescript
// Get sentence audio URL
const maleUrl = getSentenceAudioUrl('food_001', 'male', audioIndex);
const femaleUrl = getSentenceAudioUrl('food_001', 'female', audioIndex);

// Get word audio URL
const maleUrl = getWordAudioUrl('food_word_001', 'male', audioIndex);

// Load audio index
const audioIndex = await loadAudioIndex();
```

**Pattern Matching**:
- **Sentences**: `{category}_{number}` → `audio/ptbr/{gender}/{category}_{number}.wav`
  - Example: `food_001` → `audio/ptbr/male/food_001.wav`
- **Words**: `{category}_word_{number}` → `audio/ptbr/{gender}/{category}_word_{number}.wav`
  - Example: `food_word_001` → `audio/ptbr/male/food_word_001.wav`

**Fallback Strategy**:
1. First, try to find entry in `audio_index.json`
2. If not found, infer path from naming convention
3. Returns `null` if neither works

### Type Definitions (`src/lib/types.ts`)

TypeScript types matching the actual JSON schema:

- `RawSentence`, `RawWord`, `RawCategory` - Match JSON structure exactly
- `Sentence`, `Word`, `Category` - Transformed app-friendly types with audio URLs
- `AudioIndex`, `AudioIndexEntry` - Audio index structure
- `Difficulty` - Type-safe difficulty levels (1-5)

**Data Flow**:
1. Load raw JSON from `STATIC DATA/sentences.json` and `STATIC DATA/words.json`
2. Load `data/audio_index.json` for audio path resolution
3. Transform raw data to app-friendly format with resolved audio URLs
4. Cache results for subsequent calls

**File Paths**:
- Development: Files are served from project root (`/STATIC DATA/`, `/data/`, `/audio/`)
- Production: These directories should be copied to `public/` during build, or configured in Vite to be served as static assets

### Progress Persistence (`lib/storage.ts`)

```typescript
// Use LocalStorage with key prefix
const STORAGE_KEY = 'lusopronounce_data';

function loadProgress(): AppData {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : getDefaultAppData();
}

function saveProgress(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
```

**Data to Persist**:
- `sentenceAttempts: SentenceAttempt[]`
- `sentenceProgress: SentenceProgress[]`
- `wordStates: WordState[]`
- `quizReviews: QuizReview[]`
- `categoryProgress: CategoryProgress[]`
- `dailySummaries: DailySummary[]`

## Component Composition Examples

### Sentence Practice Flow

```
SentencePractice
  └─ SentenceCard
      ├─ Text display (Portuguese + English)
      └─ PronunciationTips
  └─ AudioPlayer
      └─ Button (Play Male/Female)
  └─ RecordingControls
      ├─ Button (Record)
      ├─ Button (Stop)
      └─ AudioPlayer (Playback user recording)
  └─ ScoreDisplay
      ├─ Overall score
      └─ Breakdown (accuracy, fluency, completeness)
  └─ FeedbackPanel
      └─ WordScore[] (per-word feedback)
```

### Dashboard Layout

```
Layout
  └─ Header
      └─ Navigation
  └─ Dashboard
      ├─ DailyStats
      ├─ QuickPracticeButton
      └─ CategoryProgress[]
          └─ ProgressBar
```

## Routing Strategy

**Recommended**: React Router (lightweight, fits static hosting)

```typescript
// routes.tsx
<Routes>
  <Route path="/" element={<Dashboard />} />
  <Route path="/practice/sentence" element={<SentencePractice />} />
  <Route path="/practice/word" element={<WordPractice />} />
  <Route path="/review" element={<Review />} />
</Routes>
```

## Styling Approach

**Tailwind CSS** with:
- Custom color palette (Portuguese flag colors: green, yellow, blue accents)
- Responsive design (mobile-first)
- Dark mode support (optional)
- Accessible components (ARIA labels, keyboard navigation)

## Development Considerations

1. **Offline Support**: Ensure static assets are cached properly
2. **Audio Loading**: Preload audio files or lazy load on demand
3. **Performance**: Virtualize long lists if needed (react-window)
4. **Error Handling**: Graceful fallbacks if audio files missing
5. **Type Safety**: Leverage existing TypeScript models throughout

## Next Steps

1. Initialize Vite + React + TypeScript project
2. Install dependencies (react-router-dom, tailwindcss, etc.)
3. Set up Tailwind configuration
4. Create base layout components
5. Implement data loading utilities
6. Build Dashboard screen first (simplest)
7. Build Sentence Practice screen
8. Build Word Practice screen
9. Implement spaced repetition algorithm
10. Add progress persistence

