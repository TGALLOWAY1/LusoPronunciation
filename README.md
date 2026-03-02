# LusoPronounce

LusoPronounce is a Brazilian Portuguese pronunciation trainer focused on the high-frequency learning loop:

`record -> submit -> feedback -> retry`

The app provides sentence and word practice, scoring feedback, attempt history, and coaching to help English speakers improve pronunciation with targeted repetition.

## Main Screens

### Dashboard
![Dashboard](docs/assets/readme/dashboard.png)

### Sentence Practice
![Sentence Practice](docs/assets/readme/sentence-practice.png)

### Word Practice
![Word Practice](docs/assets/readme/word-practice.png)

### Review Queue
![Review Queue](docs/assets/readme/review-queue.png)

### Recent Sessions
![Recent Sessions](docs/assets/readme/recent-sessions.png)

## Core Features

- Live recording and pronunciation assessment for sentence practice
- Word-by-word and phrase-level scoring feedback
- Client quality gate for short/silent recordings
- Cancel/retry handling for in-flight assessment
- Coaching and minimal-pair drill suggestions after scored attempts
- Local attempt history, trend views, and recent session summaries

## Tech Stack

- React + TypeScript + Vite
- Express server for pronunciation endpoints
- Vitest for unit/contract testing
- Playwright for deterministic browser e2e coverage

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Start the app

```bash
npm run dev
```

### 3. (Optional) Start backend API server

```bash
npm run dev:server
```

## Testing

### Targeted Phase 0-4 verification

```bash
npm run test:phase04
npm run e2e:phase04
npm run verify:phase04
```

### Capture fresh README screenshots

```bash
npm run screenshots:readme
```

This writes PNGs to `docs/assets/readme/`.
