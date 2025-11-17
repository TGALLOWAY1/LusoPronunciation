# Routes Documentation

This document describes all routes in the LusoPronounce application, their purpose, and the layout components they use.

## Layout

All routes use the `AppLayout` component (`src/components/layout/AppLayout.tsx`), which provides:
- **Header**: Shows app name "LusoPronounce" and current section label
- **Sidebar** (Desktop): Left navigation sidebar with all main routes
- **Top Navigation** (Mobile): Horizontal scrollable navigation bar
- **Content Area**: Main content area with padding and responsive max-width

## Routes

### `/` - Dashboard

**Component**: `src/pages/Dashboard.tsx`  
**Layout**: `AppLayout`  
**Purpose**: Main landing page showing:
- Overview of progress across all categories
- Daily statistics (attempts, XP, minutes practiced)
- Quick practice buttons
- Category progress bars
- Visual progress charts

**Status**: Placeholder - Business logic to be implemented

---

### `/practice/sentence` - Sentence Practice

**Component**: `src/pages/SentencePractice.tsx`  
**Layout**: `AppLayout`  
**Purpose**: Practice pronouncing full Portuguese sentences with:
- Display of Portuguese sentence and English translation
- Native audio playback (male/female voice options)
- User recording controls
- Pronunciation scoring and feedback
- Word-level error analysis
- Pronunciation tips display

**Status**: Placeholder - Business logic to be implemented

---

### `/practice/word` - Word Practice

**Component**: `src/pages/WordPractice.tsx`  
**Layout**: `AppLayout`  
**Purpose**: Fast-paced word pronunciation drills with:
- Single word display (Portuguese + English)
- Native audio playback
- Quick record/replay loop
- Simplified scoring for single words
- Pronunciation tips for tricky phonemes

**Status**: Placeholder - Business logic to be implemented

---

### `/review` - Review Queue

**Component**: `src/pages/Review.tsx`  
**Layout**: `AppLayout`  
**Purpose**: Spaced repetition review system showing:
- Queue of words/sentences due for review
- Items filtered by spaced repetition algorithm
- Review interface (reuse practice components)
- Mark correct/incorrect to update intervals
- Progress through review session

**Status**: Placeholder - Business logic to be implemented

---

## Navigation Structure

### Desktop (≥1024px)
- **Sidebar**: Fixed left sidebar (256px wide) with vertical navigation
- **Header**: Top header bar with app name and current section
- **Content**: Flexible content area with padding

### Mobile (<1024px)
- **Header**: Top header bar with app name and current section
- **Navigation**: Horizontal scrollable navigation bar below header
- **Content**: Full-width content area with padding

## Route Configuration

Routes are defined in `src/app/App.tsx` using React Router:

```tsx
<Routes>
  <Route path="/" element={<Dashboard />} />
  <Route path="/practice/sentence" element={<SentencePractice />} />
  <Route path="/practice/word" element={<WordPractice />} />
  <Route path="/review" element={<Review />} />
</Routes>
```

All routes are wrapped in `AppLayout` which provides consistent navigation and layout across the application.

## Future Routes (Planned)

- `/settings` - User settings (voice selection, accent, difficulty)
- `/stats` - Detailed statistics and progress history
- `/category/:id` - Category-specific practice (V2 feature)

