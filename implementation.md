# Vanilla Refactor Implementation

## Current Status

Completed the first-pass SVG extraction from the React source into standalone asset files for the vanilla project.

Completed the first pass of the core styling foundation for the vanilla project.

## SVG Extraction Rules

1. Each React inline SVG is first copied into an `.xml` file, then renamed to `.svg` after validation.
2. JSX-only syntax is converted to valid SVG/XML before rename.
3. Prop-driven SVGs are flattened into explicit asset variants.
4. Dynamic UI SVGs are only extracted if they make sense as reusable files.

## Asset Folder Structure

```
assets/
  brand/          ← Sproutly logos (2 files)
  illustrations/  ← Empty-state & spot illustrations (6 files)
  decorations/    ← Leaf decorative SVGs (5 files)
  icons/          ← Lucide icons + custom micro-UI icons (39 files + manifest.json)
```

## Asset Manifest

| Source | Target | Notes |
| --- | --- | --- |
| `src/components/illustrations/EmptySearchResults.tsx` | `assets/illustrations/empty-search-results.svg` | Preserves text element for now |
| `src/components/illustrations/EmptyStateNoHabits.tsx` | `assets/illustrations/empty-state-no-habits.svg` | Static illustration |
| `src/components/illustrations/EmptyStateNoTodos.tsx` | `assets/illustrations/empty-state-no-todos.svg` | Static illustration |
| `src/components/illustrations/EmptyStateStatistics.tsx` | `assets/illustrations/empty-state-statistics.svg` | Static illustration |
| `src/components/illustrations/HabitCompleteIcon.tsx` | `assets/illustrations/habit-complete.svg` | Animation removed from asset and should move to CSS later |
| `src/components/illustrations/SproutlyLogo.tsx` | `assets/brand/sproutly-logo.svg` | Standard logo variant |
| `src/components/illustrations/SproutlyLogo.tsx` | `assets/brand/sproutly-logo-circle.svg` | `withCircle` extracted as separate file |
| `src/components/illustrations/StreakCelebration.tsx` | `assets/illustrations/streak-celebration.svg` | Static illustration |
| `src/components/illustrations/LeafDecoration.tsx` variant 1 | `assets/decorations/leaf-monstera.svg` | CurrentColor resolved to static HSL |
| `src/components/illustrations/LeafDecoration.tsx` variant 2 | `assets/decorations/leaf-palm-frond.svg` | CurrentColor resolved to static HSL |
| `src/components/illustrations/LeafDecoration.tsx` variant 3 | `assets/decorations/leaf-botanical.svg` | CurrentColor resolved to static HSL |
| `src/components/illustrations/LeafDecoration.tsx` variant 4 | `assets/decorations/leaf-fern-frond.svg` | CurrentColor resolved to static HSL |
| `src/components/illustrations/LeafDecoration.tsx` variant 5 | `assets/decorations/leaf-ginkgo.svg` | CurrentColor resolved to static HSL |
| `src/components/home/HabitsTracker.tsx` and `src/components/home/TodosTracker.tsx` | `assets/icons/checkmark.svg` | Shared micro-UI asset |
| `src/components/home/DailyScoreCard.tsx` | `assets/icons/daily-score-progress.svg` | Baseline extracted asset; foreground width must be set dynamically in vanilla JS |

## Runtime Note

`src/components/home/DailyScoreCard.tsx` contains a dynamic progress SVG where the foreground width depends on runtime score. The extracted asset is a baseline reference, but the foreground bar should be controlled by vanilla JS or replaced with an HTML and CSS progress pattern during the page refactor.

## Lucide Icon Asset Migration

Implemented a scripted Lucide icon download pipeline for the vanilla app.

### Files Added

1. `scripts/download-lucide-icons.mjs`
2. `assets/icons/*.svg`
3. `assets/icons/manifest.json`

### Download Source

1. Package: `lucide-static`
2. Version: `0.542.0`
3. Endpoint format: `https://unpkg.com/lucide-static@0.542.0/icons/<icon>.svg`

### Result

1. Total requested: `37`
2. Total downloaded: `37` (+ 2 custom icons = 39 total in `assets/icons/`)
3. Total failed: `0`

### Re-run Command

From `Habit Tacker App Vanilla`:

`node .\scripts\download-lucide-icons.mjs`

## Core Styling Foundation

Added a compact style-guide and token scaffold for the vanilla rebuild.

### Files Added

1. `style-guide.md`
2. `styles/core-tokens.css`

### Scope

1. Brand color primitives
2. Semantic light and dark color aliases
3. Typography families, sizes, and weights
4. Spacing scale
5. Radius scale
6. Shadow scale
7. Minimal sidebar token set

### Notes

1. The token file is intentionally core-only and does not define component-specific variables yet.
2. The guide includes a migration map from the React app token names to the new vanilla token names.
3. The dark theme continues to follow the existing `.dark` class model used by the source app.

## Next Steps

1. Add an asset loader strategy for the vanilla app.
2. Start replacing React illustration usage with image or inline asset references during the page refactor.
3. Replace `lucide-react` usages in migrated vanilla views with `assets/icons` references.
4. Decide whether the dynamic DailyScoreCard progress indicator will stay SVG-driven or move fully to HTML and CSS.
5. Attach `styles/core-tokens.css` to the first vanilla HTML entry point when page markup starts.

## Phase 1 HTML Shell and Fragments

Implemented the first-pass HTML structure for hash-based SPA behavior with a persistent shell and content-only page fragments.

### Files Added

1. `index.html`
2. `pages/home.html`
3. `pages/manage.html`
4. `pages/statistics.html`
5. `docs/route-contract.md`

### What Was Implemented

1. Persistent shell in `index.html` with sidebar, mobile header/nav placeholders, and a single page mount target at `#page-view-mount`.
2. Content-only fragments in `pages/*.html` that do not duplicate shell markup.
3. Reserved modal mount target (`#modal-root`) without modal implementations, as agreed for phase 1.
4. Hash state-map contract documented for phase 2 router wiring.

### Notes

1. This phase is HTML-only scaffold work; fragment loading and hash synchronization are intentionally deferred to JavaScript implementation in phase 2.
2. Empty and unknown hash behavior is specified in `docs/route-contract.md` as redirect to `#page=home`.

## Phase 2 Hash Router and Modal Wiring

Implemented hash-based page switching and modal routing in vanilla JavaScript.

### Files Added

1. `js/app.js`
2. `styles/app-shell.css`
3. `modals/welcome.html`
4. `modals/quick-add.html`
5. `modals/stats-preview.html`

### Files Updated

1. `index.html` (loads shell stylesheet and JS module)
2. `docs/route-contract.md` (modal routing status updated)

### Runtime Behavior Implemented

1. Hash state parsing with state-map format (`#page=...&modal=...`).
2. Default and unknown route correction to `#page=home`.
3. Dynamic fragment injection into `#page-view-mount` for home, manage, and statistics pages.
4. Active navigation synchronization via `aria-current` and active class.
5. Modal fragment injection into `#modal-root` for `welcome`, `quick-add`, and `stats-preview` keys.
6. Modal close behavior through close buttons, backdrop click, and Escape key.
7. Light and dark theme toggle persistence with localStorage.
8. Responsive shell visibility logic for desktop and mobile wrappers.