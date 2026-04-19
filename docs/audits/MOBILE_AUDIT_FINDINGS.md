# LusoPronounce Mobile-Friendliness Audit Findings

## Verdict
LusoPronounce is **partially mobile-friendly**: core flows are usable on phones, but several high-traffic screens and UI patterns remain desktop-first and prevent a polished iPhone experience.

## Highest-Priority Findings

1. **Dashboard is desktop-dense on mobile**
   - Fixed multi-column layouts (`grid-cols-4`, `grid-cols-3`, `grid-cols-2`) and dense analytics cards overwhelm small screens.
   - `src/pages/UserDashboardPage.tsx`

2. **Recent Sessions uses a fixed 5-column card grid**
   - Causes cramped cards/tap targets on iPhone widths.
   - `src/pages/RecentSessions.tsx`

3. **iPhone recording codec risk**
   - Recorder prefers OGG/WebM and submission names audio as `.ogg`; Safari recording formats can vary.
   - `src/hooks/useMicrophoneRecorder.ts`
   - `src/hooks/useLivePronunciationPractice.ts`

4. **No explicit safe-area strategy**
   - Missing `viewport-fit=cover` and safe-area inset handling for notch/home indicator regions.
   - `index.html`
   - app layout CSS/classes

5. **Button style-system gaps**
   - `btn-outline` and `btn-error` are used in MCQ/filter flows but are not defined in shared styles.
   - `src/components/practice/WordMcqCard.tsx`
   - `src/components/practice/WordListeningMcqCard.tsx`
   - `src/components/practice/FilterControls.tsx`
   - `src/styles/index.css`

## iPhone/Safari Risk Areas

- MediaRecorder MIME/type mismatch and upload extension assumptions
- Keyboard + modal behavior in fixed overlays
- Touch-vs-mouse event handling in dropdown close logic
- Lack of safe-area-aware padding

## Audio Workflow Assessment (Mobile)

The end-to-end recording → quality gate → upload → score → retry flow is structurally good:
- stream cleanup is implemented
- quality gating blocks too-short/silent clips
- upload has cancellation and telemetry
- server conversion pipeline to WAV is robust

Main gap: Safari/iPhone MIME/container hardening and degraded-network UX polish.

## Performance Notes

- Build succeeds; primary bundle remains sizable for mobile cold starts.
- Static datasets are loaded from large JSON files and can still be heavy for first-load on weak networks.

## Prioritized Plan

### Phase 1 (Critical)
- Make Dashboard and Recent Sessions mobile-first responsive
- Add missing button variants (`btn-outline`, `btn-error`)
- Harden recorder MIME/filename behavior for iPhone Safari
- Add safe-area + viewport-fit support

### Phase 2 (Important)
- Mobile-specific chart simplification and content density reduction
- Improve dropdown/modal touch and keyboard behavior
- Better retry/backoff/error messaging for weak mobile networks

### Phase 3 (Enhancements)
- PWA polish (installability, app-like nav)
- optional low-bandwidth mode for analytics-heavy screens

## 2-Day Practical Execution Plan

1. Responsive fixes for Dashboard + Sessions
2. Style-system fixes for undefined button variants
3. Safari MIME/upload extension patch
4. Safe-area viewport updates
5. Mobile smoke tests for record/submit/retry on iPhone Safari

