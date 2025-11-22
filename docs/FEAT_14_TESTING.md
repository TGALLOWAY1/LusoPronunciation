# Feat 14 - Live Azure Pronunciation Assessment Testing Checklist

This document provides a manual testing checklist for verifying that Feat 14 (Live Azure Pronunciation Assessment with Latency Logging) is working correctly.

## Prerequisites

- Azure Speech Service credentials configured (`AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` environment variables)
- Microphone access granted in browser
- Development server running

## Test 1: Dev Pronunciation Lab (`/dev/pronunciation-fixtures`)

### Setup
1. Navigate to `/dev/pronunciation-fixtures`
2. Wait for fixtures and sentences to load

### Test Steps

1. **Select a matching fixture:**
   - Select a fixture phrase from the list that has a matching sentence in your dataset
   - Verify that `LivePracticeSection` appears (not the static fixture panel)
   - If no match is found, you should see a yellow warning message

2. **Recording and submission:**
   - Click "Start Recording"
   - Speak the Portuguese sentence
   - Click "Stop Recording"
   - Click "Submit"
   - Verify the submit button shows "Submitting..." during the request

3. **Network verification:**
   - Open browser DevTools → Network tab
   - Filter for "pronunciation-assessment"
   - Verify:
     - POST request to `/api/pronunciation-assessment` is made
     - Request includes FormData with `audio`, `sentenceId`, `referenceText`, `language`
     - Response status is 200
     - Response body contains `{ rawAzure: {...}, attemptScore: {...} }`

4. **UI verification:**
   - Verify pronunciation metrics update using live Azure data (not static fixtures)
   - Check that word-by-word feedback appears in the feedback panel
   - Verify phoneme-level feedback is available when clicking on words
   - Confirm new attempt appears in attempts history
   - Verify scoring panel (right side) shows the current attempt scores

5. **Latency verification:**
   - Open browser DevTools → Console
   - Look for debug log: `Latency: XXXms`
   - Verify latency is a reasonable number (typically 500-3000ms depending on network)
   - Check that latency is displayed in the UI below the recording controls

6. **Attempt logging:**
   - Navigate to `/dev/analytics` or `/sessions`
   - Verify the attempt appears in the practice log
   - Check that `latencyMs` field is present in the logged attempt (may need to inspect localStorage or use dev tools)

## Test 2: Production Pronunciation Lab (`/practice/sentence`)

### Setup
1. Navigate to `/practice/sentence`
2. Wait for sentences to load
3. Select a category and/or difficulty filter if desired

### Test Steps

1. **Recording and submission:**
   - Click "Start Recording"
   - Speak the Portuguese sentence displayed
   - Click "Stop Recording"
   - Click "Submit"
   - Verify submission process completes

2. **Network verification:**
   - Open browser DevTools → Network tab
   - Verify POST request to `/api/pronunciation-assessment` is made
   - Verify response is successful

3. **UI verification:**
   - Verify pronunciation feedback appears
   - Check word-by-word scores and phoneme feedback
   - Verify scoring panel updates with current attempt
   - Confirm attempt appears in attempts history

4. **Navigation:**
   - Use "Previous" and "Next" buttons to navigate between sentences
   - Verify that attempts reset when changing sentences
   - Test keyboard navigation (Arrow Left/Right)

5. **Error handling:**
   - Test microphone permission denial (deny access when prompted)
   - Verify user-friendly error message appears
   - Test network error (disconnect internet, then submit)
   - Verify error message is displayed

6. **Session logging:**
   - Make multiple attempts on different sentences
   - Navigate to `/sessions` or `/dev/analytics`
   - Verify all attempts are logged with:
     - Correct sentence IDs
     - Scores (overall, accuracy, fluency, completeness, prosody)
     - `latencyMs` field present
     - Timestamps

## Test 3: Edge Cases

1. **No matching sentence:**
   - In dev lab, select a fixture that doesn't match any sentence
   - Verify warning message appears
   - Verify recording UI is disabled or shows appropriate message

2. **Rapid submissions:**
   - Record and submit multiple times quickly
   - Verify each attempt is logged separately
   - Verify latency is measured for each attempt

3. **Component unmount:**
   - Start a recording
   - Navigate away before stopping
   - Verify no errors in console
   - Verify no state updates after unmount

4. **Long recordings:**
   - Record for 30+ seconds
   - Submit
   - Verify Azure handles long audio correctly

## Expected Results

### API Response Shape
```json
{
  "rawAzure": {
    "RecognitionStatus": "Success",
    "NBest": [...]
  },
  "attemptScore": {
    "attemptId": "uuid-here",
    "sentenceId": "sentence-id",
    "overallAccuracy": 85,
    "fluency": 90,
    "completeness": 88,
    "prosody": 82,
    "wordScores": [...],
    "createdAt": "2025-01-XX...",
    "latencyMs": 1234
  }
}
```

### Logged Attempt Shape
The attempt logged to `usePracticeLogStore` should include:
- All score fields (overallScore, accuracyScore, fluencyScore, etc.)
- `latencyMs` field (optional, but should be present for live attempts)
- Session ID
- Sentence ID
- Timestamp

## Troubleshooting

### Azure API not being called
- Check browser console for errors
- Verify Azure credentials are set in environment
- Check network tab for failed requests
- Verify server route is properly wired up

### Latency not appearing
- Check browser console for latency debug log
- Verify `performance.now()` is available (should be in all modern browsers)
- Check that latency is being added to attemptScore before logging

### Attempts not logging
- Check browser console for errors
- Verify sessionId is not null
- Check localStorage for practice log data
- Verify `logSentenceAttempt` is being called with correct parameters

## Notes

- Latency measurement includes full round-trip time (fetch start → response received)
- Latency is measured in milliseconds and rounded to nearest integer
- Old attempts (before Feat 14) will not have `latencyMs` field - this is expected
- The `latencyMs` field is optional in the type system for backward compatibility

