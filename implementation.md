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