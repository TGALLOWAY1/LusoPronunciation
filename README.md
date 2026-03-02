# LusoPronounce

LusoPronounce is a Brazilian Portuguese pronunciation trainer.

The app provides sentence and word practice, pronunciation scoring feedback, attempt history, and coaching to help English speakers improve pronunciation with targeted repetition.

## Main Screen

### Sentence Practice
<img width="1289" height="1274" alt="image" src="https://github.com/user-attachments/assets/eb5fcdd1-ab7e-41ff-a015-dd4f973b0e6f" />


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
