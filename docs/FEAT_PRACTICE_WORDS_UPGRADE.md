# Practice Words Page Upgrade Specification

## Overview

This document specifies the upgrade to the Practice Words page (`/practice/word`) to add vocabulary recall and direction-flip features alongside the existing pronunciation practice functionality.

**Status**: Specification  
**Last Updated**: 2025-01-24  
**Related Files**:
- `src/pages/WordPractice.tsx` (main page)
- `src/components/practice/WordCard.tsx` (drill mode card)
- `src/components/practice/WordStudyCard.tsx` (list mode card)
- `src/lib/types.ts` (WordPracticeAttempt type)
- `src/state/practiceLogStore.tsx` (logging)
- `src/lib/practiceAnalytics.ts` (progress computation)

---

## Current Implementation

### Page Structure

**Route**: `/practice/word` (configured in `src/app/App.tsx`)

**Main Component**: `src/pages/WordPractice.tsx`

The page supports two view modes:
1. **List Mode**: Grid view with `WordStudyCard` components (read-only study)
2. **Drill Mode**: Single-card view with `WordCard` component (interactive practice)

### Current Features

#### List Mode (Study)
- **Component**: `WordStudyCard` (`src/components/practice/WordStudyCard.tsx`)
- **Behavior**:
  - Displays word in Portuguese (`textPt`)
  - Shows English translation (`translationEn`)
  - Shows part of speech, category, difficulty badges
  - Audio playback button (native model)
  - Pronunciation notes (if available)
  - **No interaction**: Read-only study cards
  - Pagination: 20 words per page

#### Drill Mode (Pronunciation Practice)
- **Component**: `WordCard` (`src/components/practice/WordCard.tsx`)
- **Behavior**:
  1. User sees word in Portuguese with translation
  2. User can play native audio model
  3. User records pronunciation via microphone
  4. Recording is scored via Azure Pronunciation Assessment API
  5. Feedback displayed with scores (overall, accuracy, fluency, etc.)
  6. User can mark word as "Know it" or "Review later"
  7. Auto-advances to next word after action

**Pronunciation Assessment Flow**:
```
WordCard → useMicrophoneRecorder → scoreWordPronunciation() 
→ /api/pronunciation-assessment → AttemptScore → logWordAttempt()
```

### Data Model

#### Word Type (`src/lib/types.ts`)
```typescript
interface Word {
  id: string;                    // e.g., "food_word_001"
  textPt: string;                // Portuguese text
  translationEn: string;        // English translation
  partOfSpeech: string;          // e.g., "noun", "verb"
  difficulty: Difficulty;        // 1-5 scale
  difficultForEnglish: boolean;
  categoryId: string;
  categoryLabelEn: string;
  categoryLabelPt: string;
  pronunciationNotes?: string;
  audioMaleUrl?: string;
  audioFemaleUrl?: string;
  audioId?: string;
  // Enriched fields (optional)
  phonemes?: string[];
  ipa?: string;
  tags?: string[];
  difficultyScore?: number;
  cefr?: string;
}
```

#### WordPracticeAttempt Type (`src/lib/types.ts`, lines 240-264)
```typescript
interface WordPracticeAttempt {
  attemptId: string;
  userId: string;
  sessionId: string;
  wordId: WordId;
  difficulty: DifficultyLevel;
  category: ContentCategory;
  createdAt: string;            // ISO timestamp
  overallScore: number;          // 0-100
  accuracyScore: number;         // 0-100
  fluencyScore?: number;
  completenessScore?: number;
  prosodyScore?: number;
  passed?: boolean;              // Based on 70% threshold
  targetOverallThreshold?: number;
  recordingDurationSeconds?: number;
  retriesInThisSession?: number;
  usedHint?: boolean;
  slowedAudioPlayback?: boolean;
  listenedToNativeModelCount?: number;
  phonemeScores?: {
    phonemeId: PhonemeId;
    overallScore: number;
  }[];
}
```

**Note**: Currently, `WordPracticeAttempt` only tracks pronunciation practice. No vocabulary recall fields exist.

### Logging Infrastructure

**Store**: `src/state/practiceLogStore.tsx`
- **Function**: `logWordAttempt(attempt)` (lines 310-327)
- **Persistence**: localStorage (key: `luso_practice_log_v1`)
- **Auto-save**: Saves on every log call

**Current Usage**:
- `WordCard.tsx` calls `logWordAttempt()` after pronunciation assessment (line 103)
- Logs include: scores, retries, hints, playback usage, etc.

### Progress Analytics

**File**: `src/lib/practiceAnalytics.ts`

**Functions**:
- `buildWordProgress(wordAttempts, totalWordsAvailable)` (lines 154-223)
  - Aggregates attempts by `wordId`
  - Computes: attempts, successfulAttempts, bestOverallScore, avgOverallScore, avgAccuracyScore
  - Determines status via `determineStatus()`

- `determineStatus(attempts, bestScore)` (lines 31-40)
  - Returns: `"new" | "learning" | "review" | "known"`
  - Logic:
    - `new`: 0 attempts
    - `known`: bestScore >= 85
    - `learning`: bestScore >= 60
    - `review`: bestScore < 60

**WordProgress Type** (`src/lib/types.ts`, lines 293-306):
```typescript
interface WordProgress {
  userId: string;
  wordId: WordId;
  attempts: number;
  successfulAttempts: number;
  lastPracticedAt?: string;
  firstPracticedAt?: string;
  bestOverallScore?: number;
  avgOverallScore?: number;
  avgAccuracyScore?: number;
  status: "new" | "learning" | "review" | "known";
  difficulty: DifficultyLevel;
  category: ContentCategory;
}
```

**Current Usage**:
- Dashboard (`UserDashboardPage.tsx`) computes word progress (line 110)
- **Not currently used in WordPractice.tsx**: Progress data exists but isn't exposed in the Practice Words UI

### Audio Infrastructure

**Word Audio Resolution**:
- `src/utils/audioRouting.ts`: `getAudioUrlForWord(wordId, voiceId)`
- `src/lib/audio.ts`: `getWordAudioUrl(wordId, gender, audioIndex)`
- Priority: audio_index.json → fallback to TTS path

**Pronunciation Assessment**:
- API: `/api/pronunciation-assessment` (POST)
- Handler: `src/server/routes/pronunciationAssessment.ts`
- Wrapper: `src/lib/wordPronunciation.ts` → `scoreWordPronunciation()`

---

## Upgrade Specification

### 1. Vocabulary Direction & Recall Features

#### 1.1 Direction Flips (EN ↔ PT)

**Goal**: Add a new "Text MCQ" mode for WordPractice where users practice vocabulary recall in both directions.

**Requirements**:

1. **New Practice Mode**: Add `practiceMode` field to distinguish:
   - `'pronunciation'`: Current pronunciation recording mode
   - `'text-mcq'`: New multiple-choice vocabulary recall mode

2. **Direction Types**:
   - `'pt-to-en'`: Portuguese word shown, user selects English translation
   - `'en-to-pt'`: English word shown, user selects Portuguese word
   - `'mixed'`: Random direction per card (user setting)

3. **UI Behavior**:
   - **PT → EN**: Display `word.textPt`, show 4 multiple-choice options (1 correct: `word.translationEn`, 3 distractors)
   - **EN → PT**: Display `word.translationEn`, show 4 multiple-choice options (1 correct: `word.textPt`, 3 distractors)
   - Distractors: Randomly selected from other words in the same category/difficulty

4. **Direction Selection**:
   - User setting: "Practice Direction" dropdown/radio:
     - "Portuguese → English"
     - "English → Portuguese"
     - "Mixed (random)"
   - Default: "Mixed"
   - Persist preference in localStorage

#### 1.2 Multiple-Choice Question Generation

**Requirements**:

1. **Question Structure**:
   ```typescript
   interface MCQQuestion {
     wordId: string;
     promptText: string;        // PT or EN (based on direction)
     correctAnswer: string;     // EN or PT (opposite of prompt)
     choices: string[];         // 4 options, shuffled
     practiceDirection: 'pt-to-en' | 'en-to-pt';
   }
   ```

2. **Distractor Selection Algorithm**:
   - Select 3 distractors from words in the same category
   - Prefer words with similar difficulty
   - Avoid words already shown in recent questions
   - Ensure all 4 choices are unique

3. **Shuffling**: Randomize order of choices (correct answer not always first)

#### 1.3 MCQ Attempt Logging

**New Type**: Extend `WordPracticeAttempt` or create `WordVocabularyAttempt`

**Option A: Extend WordPracticeAttempt** (Recommended)
```typescript
interface WordPracticeAttempt {
  // ... existing fields ...
  
  // New fields for vocabulary recall
  practiceMode?: 'pronunciation' | 'text-mcq';  // undefined = legacy pronunciation
  practiceDirection?: 'pt-to-en' | 'en-to-pt';
  promptText?: string;              // What was shown (PT or EN)
  choices?: string[];                // All 4 options
  selectedAnswer?: string;           // User's choice
  correctAnswer?: string;             // Correct answer
  isCorrect?: boolean;               // Whether user got it right
  responseTimeMs?: number;            // Time to answer (ms)
}
```

**Option B: Separate Type** (Alternative)
```typescript
interface WordVocabularyAttempt {
  attemptId: string;
  userId: string;
  sessionId: string;
  wordId: WordId;
  difficulty: DifficultyLevel;
  category: ContentCategory;
  createdAt: string;
  practiceDirection: 'pt-to-en' | 'en-to-pt';
  promptText: string;
  choices: string[];
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  responseTimeMs?: number;
}
```

**Recommendation**: Use Option A (extend `WordPracticeAttempt`) to:
- Reuse existing logging infrastructure
- Enable unified progress tracking
- Simplify analytics queries

**Logging Function**: Extend `logWordAttempt()` in `practiceLogStore.tsx` to accept new fields.

#### 1.4 MCQ Card Component

**New Component**: `WordMCQCard.tsx` (or extend `WordCard.tsx` with mode prop)

**UI Requirements**:
1. **Question Display**:
   - Large, prominent prompt text (PT or EN)
   - Audio playback button (if PT prompt)
   - Category/difficulty badges

2. **Answer Options**:
   - 4 clickable buttons/cards
   - Visual feedback on selection:
     - Correct: Green highlight
     - Incorrect: Red highlight + show correct answer
   - Disable interaction after selection

3. **Navigation**:
   - "Next" button appears after answer
   - Or auto-advance after 2 seconds
   - "Know it" / "Review later" actions (same as pronunciation mode)

4. **Progress Indicator**:
   - Show "Word X of Y"
   - Show streak counter (consecutive correct answers)

#### 1.5 Mode Selection UI

**Location**: `WordPractice.tsx` (top of page, near ViewModeToggle)

**UI Component**: Mode selector (tabs or dropdown)
- "Pronunciation" tab (current drill mode)
- "Vocabulary" tab (new MCQ mode)
- Default: "Pronunciation" (maintains current behavior)

**State Management**:
- Add `practiceMode` state: `'pronunciation' | 'text-mcq'`
- Conditionally render `WordCard` vs `WordMCQCard` based on mode
- Persist mode preference in localStorage

### 2. Progress Tracking Enhancements

#### 2.1 Separate Progress for Pronunciation vs Vocabulary

**Current**: `buildWordProgress()` aggregates all attempts together.

**Enhancement**: Compute separate progress for each practice mode.

**New Functions** (in `src/lib/practiceAnalytics.ts`):
```typescript
interface WordProgressByMode {
  pronunciation: WordProgress;
  vocabulary: WordProgress;
  combined: WordProgress;  // Overall (existing behavior)
}

function buildWordProgressByMode(
  wordAttempts: WordPracticeAttempt[],
  totalWordsAvailable: number
): Record<WordId, WordProgressByMode> {
  // Split attempts by practiceMode
  // Compute progress for each mode separately
  // Also compute combined progress
}
```

**Status Determination**:
- Pronunciation status: Based on pronunciation attempts only
- Vocabulary status: Based on vocabulary attempts only
- Combined status: Based on all attempts (existing logic)

#### 2.2 Direction-Specific Progress

**Enhancement**: Track progress separately for PT→EN and EN→PT.

**New Fields in WordProgress**:
```typescript
interface WordProgress {
  // ... existing fields ...
  
  // Direction-specific stats
  ptToEnAttempts?: number;
  ptToEnCorrect?: number;
  ptToEnAvgResponseTime?: number;
  enToPtAttempts?: number;
  enToPtCorrect?: number;
  enToPtAvgResponseTime?: number;
}
```

**Use Case**: Identify which direction is weaker for a word.

### 3. UI Enhancements

#### 3.1 Weak Words Filter

**Location**: `WordPractice.tsx` filter controls

**Feature**: Add "Focus on Weak Words" toggle/button

**Implementation**:
1. Compute word progress using `buildWordProgress()`
2. Filter words where:
   - `status === 'learning' | 'review'` OR
   - `avgOverallScore < 70` (for pronunciation) OR
   - `vocabularyCorrectRate < 0.7` (for vocabulary)
3. Show filtered list when toggle is active

**Helper Function** (in `src/lib/practiceAnalytics.ts`):
```typescript
function getWeakWords(
  wordProgress: Record<WordId, WordProgress>,
  mode?: 'pronunciation' | 'vocabulary',
  threshold: number = 70
): WordId[] {
  return Object.values(wordProgress)
    .filter(wp => {
      if (mode === 'pronunciation') {
        return wp.avgOverallScore !== undefined && wp.avgOverallScore < threshold;
      } else if (mode === 'vocabulary') {
        // Filter by vocabulary accuracy
        return /* vocabulary accuracy < threshold */;
      }
      // Combined mode: check both
      return /* either pronunciation or vocabulary is weak */;
    })
    .map(wp => wp.wordId);
}
```

#### 3.2 Progress Indicators in UI

**Enhancement**: Show progress status badges on word cards.

**Location**: `WordCard.tsx` and `WordMCQCard.tsx`

**Display**:
- Status badge: "New" / "Learning" / "Review" / "Known"
- Progress bar: Show attempt count or accuracy percentage
- Color coding: Match status colors (green=known, yellow=learning, red=review)

**Data Source**: Query `buildWordProgress()` results in `WordPractice.tsx`, pass as prop to cards.

#### 3.3 Statistics Panel

**New Component**: `WordPracticeStats.tsx`

**Display**:
- Total words practiced (pronunciation + vocabulary)
- Accuracy rates (separate for each mode)
- Direction accuracy (PT→EN vs EN→PT)
- Streak counters
- Weak words count

**Location**: Sidebar or collapsible panel in `WordPractice.tsx`

### 4. Data Migration & Backward Compatibility

#### 4.1 Legacy Attempts

**Requirement**: Existing `WordPracticeAttempt` records (without `practiceMode`) should be treated as pronunciation attempts.

**Implementation**:
- In `buildWordProgress()`: If `practiceMode` is undefined, assume `'pronunciation'`
- In UI: Show legacy attempts as pronunciation practice

#### 4.2 Default Values

**New Fields Defaults**:
- `practiceMode`: `undefined` (legacy) or `'pronunciation'` (new)
- `practiceDirection`: `undefined` for pronunciation attempts
- `isCorrect`: `undefined` for pronunciation attempts (use `passed` field instead)

### 5. Implementation Phases

#### Phase 1: Core MCQ Functionality
- [ ] Extend `WordPracticeAttempt` type with new fields
- [ ] Create `WordMCQCard` component
- [ ] Implement distractor selection algorithm
- [ ] Add mode selector UI
- [ ] Update `logWordAttempt()` to accept new fields
- [ ] Test MCQ flow end-to-end

#### Phase 2: Progress Tracking
- [ ] Implement `buildWordProgressByMode()`
- [ ] Add direction-specific progress fields
- [ ] Update analytics queries
- [ ] Test progress computation

#### Phase 3: UI Enhancements
- [ ] Add weak words filter
- [ ] Add progress indicators to cards
- [ ] Create statistics panel
- [ ] Polish UI/UX

#### Phase 4: Testing & Refinement
- [ ] Unit tests for new functions
- [ ] Integration tests for MCQ flow
- [ ] User testing
- [ ] Performance optimization
- [ ] Documentation updates

---

## Technical Notes

### MCQ Question Generation Algorithm

```typescript
function generateMCQQuestion(
  word: Word,
  direction: 'pt-to-en' | 'en-to-pt',
  allWords: Word[],
  recentWordIds: string[] = []
): MCQQuestion {
  const promptText = direction === 'pt-to-en' 
    ? word.textPt 
    : word.translationEn;
  const correctAnswer = direction === 'pt-to-en'
    ? word.translationEn
    : word.textPt;
  
  // Select distractors from same category, similar difficulty
  const candidates = allWords
    .filter(w => 
      w.id !== word.id &&
      w.categoryId === word.categoryId &&
      Math.abs(w.difficulty - word.difficulty) <= 1 &&
      !recentWordIds.includes(w.id)
    );
  
  const distractors = shuffle(candidates)
    .slice(0, 3)
    .map(w => direction === 'pt-to-en' ? w.translationEn : w.textPt);
  
  const choices = shuffle([correctAnswer, ...distractors]);
  
  return {
    wordId: word.id,
    promptText,
    correctAnswer,
    choices,
    practiceDirection: direction,
  };
}
```

### Response Time Tracking

Track time from question display to answer selection:
```typescript
const questionStartTime = useRef<number | null>(null);

useEffect(() => {
  if (currentQuestion) {
    questionStartTime.current = Date.now();
  }
}, [currentQuestion]);

const handleAnswerSelect = (answer: string) => {
  const responseTime = questionStartTime.current
    ? Date.now() - questionStartTime.current
    : undefined;
  
  logWordAttempt({
    // ... other fields ...
    responseTimeMs: responseTime,
  });
};
```

---

## Open Questions

1. **Should MCQ attempts count toward overall word progress?**
   - Recommendation: Yes, but track separately for analytics

2. **Should we support both modes in the same session?**
   - Recommendation: Yes, allow switching between modes mid-session

3. **How many distractors?**
   - Recommendation: 3 distractors (4 total choices) for optimal difficulty

4. **Auto-advance after answer?**
   - Recommendation: Yes, with 2-second delay to show feedback

5. **Should "Know it" / "Review later" work the same for MCQ?**
   - Recommendation: Yes, maintain consistency with pronunciation mode

---

## References

- Current implementation: `src/pages/WordPractice.tsx`
- Word type: `src/lib/types.ts` (Word interface)
- Attempt type: `src/lib/types.ts` (WordPracticeAttempt interface)
- Logging: `src/state/practiceLogStore.tsx`
- Analytics: `src/lib/practiceAnalytics.ts`
- Existing vocab types: `src/models/vocab.ts` (QuizReview type for reference)

