# LusoPronounce UI/UX Audit (2026-04-16)

## 1) Executive Summary (Top Issues)

1. **The app has two competing products inside one shell**: a focused practice loop (sentence page) and a dashboard-heavy analytics product. The latter dominates navigation but does not advance learning momentum.
2. **Secondary pages are over-instrumented and under-prioritized**: many cards/charts, low actionability, weak “what should I do next?” guidance.
3. **Information architecture is inverted**: “Dashboard” is treated as home, while “Practice Sentences” (the core value) is one click away.
4. **Cognitive load is too high off the core loop**: users have to parse metrics structures rather than receiving behavior-driving decisions.
5. **Visual system is mostly utility-class-consistent but product hierarchy is inconsistent**: repeated card grids and emoji/icon treatment create a generic, dashboard-template feel rather than a premium learning tool.

---

## 2) What Works (Sentence Page Breakdown)

### Why the sentence page works

- **Single dominant job**: practice one sentence now.
- **Immediate feedback loop**: record → score/feedback → retry.
- **Constrained choice architecture**: filtering and sentence navigation exist, but the center of gravity is the active attempt.
- **State continuity**: attempt history and feedback are attached to the current sentence context, not abstracted into a detached analytics area.

### Design principles to extract (gold standard)

1. **One primary action per screen state**.
2. **Feedback at point of action, not after a mode switch**.
3. **Context-preserving history** (history should explain next attempt, not become an archive destination).
4. **Minimal branching before first value** (fast path into one attempt in <10s).
5. **Progressive depth** (novice sees essentials; power user can inspect details).

---

## 3) What’s Broken (Secondary Pages)

## Dashboard (`UserDashboardPage`)

- **Intended purpose**: summarize progress and drive next action.
- **Actual behavior**: presents a broad analytics board with many sections (glance cards, rolling charts, coverage blocks, weakness/recommendation slices, etc.).
- **What fails**:
  - **Prioritization failure**: too many equal-weight sections; no clear top recommendation.
  - **Action gap**: user learns “state” but not “next best action” in one click.
  - **Density mismatch**: heavy charting for a training product where immediate practice continuity should dominate.
  - **Trust issue**: synthetic/dummy chart generation appears in code paths, which undermines perceived metric authority.

## Recent Sessions

- **Intended purpose**: review session history.
- **Actual behavior**: date-grouped tiles with mode/time/score snippets.
- **What fails**:
  - **Dead-end page risk**: mostly passive viewing; limited pathways into targeted remediation.
  - **Card-grid overuse**: many similarly weighted tiles, weak significance cues.
  - **No synthesis**: does not answer “What pattern from these sessions should I fix today?”

## Word Practice

- **Intended purpose**: word-focused drilling.
- **Actual behavior**: multiple mode axes (view mode, practice mode, direction mode, filters) before interaction settles.
- **What fails**:
  - **Configuration-first UX**: user is asked to tune system dimensions rather than start speaking/listening quickly.
  - **Mode combinatorics** increase cognitive setup cost.
  - **Loop dilution**: unlike sentence flow, the primary action is fragmented across modality controls.

## Layout / Navigation Shell

- **Intended purpose**: global navigation.
- **Actual behavior**: dashboard-first nav plus multiple similarly weighted primary destinations.
- **What fails**:
  - **Core-loop demotion**: practice is not the default destination.
  - **Label drift**: “Dashboard / History / Practice Words / Practice Sentences” feels tool-centric, not journey-centric.
  - **Mobile top-nav density** is high for frequent-use pathways.

---

## 4) Root Cause Analysis

1. **Feature-first architecture over workflow-first architecture**.
   - The product exposes available data and modules rather than guiding a daily pronunciation workflow.
2. **Dashboard syndrome**.
   - Metrics are surfaced because they exist, not because they trigger a clear behavior.
3. **Weak “job-to-be-done” scoping for secondary pages**.
   - Pages try to be complete repositories of data instead of decision engines.
4. **Progression model under-expressed**.
   - There are streak and review concepts, but they are not the organizing spine of the IA.
5. **No explicit momentum design language**.
   - Too little “resume”, “continue where you struggled”, “finish today’s target” framing.

---

## 5) Redesign Strategy

## North star

**Everything should feel like an extension of: `Attempt → Feedback → Targeted Retry → Visible Momentum`.**

## New navigation model

1. **Practice** (default home)
   - Sentence (default tab)
   - Words (secondary tab)
2. **Review**
   - Mistakes queue (sentences + words)
   - Recent attempts timeline (filterable)
3. **Progress**
   - Lightweight weekly trends + streak + mastered/review counts
4. **Settings**
   - Audio/voice/preferences only

## What to remove / merge / simplify

- Remove standalone “dashboard as home” behavior.
- Merge “Recent Sessions” into **Review** timeline.
- Reduce analytics to a compact **Progress** page with max 3–4 modules.
- De-emphasize multiple chart types that do not map to decisions.

---

## 6) Page-by-Page Redesign

## A) Practice (Sentence + Word)

### New purpose

Complete meaningful attempts quickly and continuously.

### New layout structure

- **Top strip**: today target, streak, quick resume cue.
- **Primary panel**: active item (sentence/word), record/play controls, immediate score.
- **Secondary panel (collapsible)**: attempt details, phoneme/word breakdown.
- **Bottom rail**: next best action (`Retry this`, `Next item`, `Review weak sound`).

### Interaction model

- User lands directly into an active prompt.
- After each attempt, UI offers exactly one recommended next action + one alternate.
- Filters are progressive-disclosure drawers, not always-on decision burden.

### Remove aggressively

- Remove equal emphasis on all modes at initial load.
- Hide advanced drill modes behind “More options”.

## B) Review (new consolidated page)

### New purpose

Convert past mistakes into today’s focused practice queue.

### New layout structure

- **Queue summary**: “12 items need review today”.
- **Tabs**: Sentences | Words.
- **List items**: last score, recurring issue tag, last practiced timestamp.
- **CTA row**: “Start 10-item review set”.

### Interaction model

- User enters a bounded review session.
- Completion returns to Practice with visible momentum update.

### Remove aggressively

- Remove passive session-tile browsing as primary interaction.

## C) Progress (lightweight)

### New purpose

Provide motivation + trend confidence in <30 seconds.

### New layout structure

- **Hero metrics**: streak, weekly attempts, mastery delta.
- **One trend chart**: weekly overall trend with confidence/attempt count.
- **One weaknesses module**: top 3 recurring phoneme/word issues linked to Review queue.

### Interaction model

- Every module has a direct action link (`Practice now`, `Review weak items`).

### Remove aggressively

- Remove chart proliferation and low-signal category tables by default.
- Avoid synthetic/dummy visualizations entirely.

## D) Settings

### New purpose

Control environment, not learning strategy.

### Layout

- Audio I/O and microphone checks.
- Voice/model preferences.
- Data/privacy and reset options.

### Remove aggressively

- Any metrics or progress content from settings.

---

## 7) Visual System Critique

### What’s currently okay

- Shared utility classes and reusable primitives (`.card`, `.btn`, `.badge`) provide a baseline consistency.

### What breaks cohesion

1. **Too many card surfaces with similar visual weight**.
2. **Typography hierarchy feels utility-default** rather than product-signature.
3. **Emoji + icon + chart mix** creates mixed visual voice (playful + enterprise dashboard).
4. **Spacing rhythm varies by page container strategy** (`px-8`, `max-w-*`, full-width card grids).
5. **Primary color is used broadly but without interaction-priority semantics**.

### Visual system recommendations

- Define a **strict page template**: header zone, action zone, context zone.
- Reduce elevation/border noise; use whitespace hierarchy over many boxes.
- Standardize heading scale and max content width across all pages.
- Establish a single status color policy tied to learning states (new/learning/review/known).
- Limit emoji usage to empty states only; rely on iconography elsewhere.

---

## 8) Implementation Plan (Prioritized)

## Phase 0 — Quick wins (high impact, low effort)

1. Set default route to **Practice / Sentence** after auth.
2. Add “Resume where you left off” action in header/top area.
3. On dashboard/home, replace multi-section analytics with one CTA block + 3 key metrics.
4. Merge “Recent Sessions” entry point into Review nomenclature.

## Phase 1 — IA refactor

1. Replace nav labels with: `Practice`, `Review`, `Progress`, `Settings`.
2. Introduce nested tabs inside Practice (Sentence default, Words secondary).
3. Move session-history UI under Review with remediation CTA.

## Phase 2 — Component/system consolidation

1. Create `PageScaffold` (title, subtitle, primary CTA, secondary actions).
2. Create `MetricTile` (single size system) and deprecate ad hoc summary card variants.
3. Create `ActionPanel` for “next best action” states.
4. Standardize chart container + empty/error states with one component.

## Phase 3 — Behavior and loop upgrades

1. Implement review queue generation from low-score recency-weighted attempts.
2. Add completion moments: “You reviewed 10 weak items today”.
3. Add subtle momentum cues (streak/target) to Practice and Review headers.

## Phase 4 — Hardening

1. Remove dummy analytics generation from production UX paths.
2. Instrument user flow events to validate improved loop completion rate:
   - First attempt latency
   - Attempts/session
   - Review queue completion
   - D1/D7 return to practice

---

## Success Criteria (post-redesign)

- Time-to-first-attempt < 10 seconds from app open.
- ≥20% increase in attempts per session.
- ≥25% of users complete at least one review queue per day.
- Reduced navigation hops between “feedback seen” and “next attempt started”.
