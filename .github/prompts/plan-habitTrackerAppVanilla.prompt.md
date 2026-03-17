# Plan: Download All Lucide Icons To Vanilla Assets

## Goal

Download every Lucide icon currently used in the React codebase and store them as standalone SVG files in `Habit Tacker App Vanilla/assets/icons`, so the vanilla app no longer depends on `lucide-react`.

## Scope

Included:
1. All icons imported from `lucide-react`.
2. All icons imported from `lucide-react@0.487.0` in `src/components/ui/*`.
3. Duplicates resolved to one shared SVG file per icon name.

Excluded:
1. Non-Lucide SVGs already extracted from custom illustration components.
2. Any icon not currently imported in project source.

## Source Inventory (Current)

Current import locations detected:
1. `Design Habit Tracker App/src/components/MobileHeader.tsx`
2. `Design Habit Tracker App/src/components/MobileNav.tsx`
3. `Design Habit Tracker App/src/components/Sidebar.tsx`
4. `Design Habit Tracker App/src/components/home/DailyScoreCard.tsx`
5. `Design Habit Tracker App/src/components/home/HabitsTracker.tsx`
6. `Design Habit Tracker App/src/components/home/StreakCard.tsx`
7. `Design Habit Tracker App/src/components/home/TodosTracker.tsx`
8. `Design Habit Tracker App/src/components/modals/QuickAddModal.tsx`
9. `Design Habit Tracker App/src/components/modals/StatsPreviewModal.tsx`
10. `Design Habit Tracker App/src/components/modals/WelcomeModal.tsx`
11. `Design Habit Tracker App/src/components/ui/accordion.tsx`
12. `Design Habit Tracker App/src/components/ui/breadcrumb.tsx`
13. `Design Habit Tracker App/src/components/ui/calendar.tsx`
14. `Design Habit Tracker App/src/components/ui/carousel.tsx`
15. `Design Habit Tracker App/src/components/ui/checkbox.tsx`
16. `Design Habit Tracker App/src/components/ui/command.tsx`
17. `Design Habit Tracker App/src/components/ui/context-menu.tsx`
18. `Design Habit Tracker App/src/components/ui/dialog.tsx`
19. `Design Habit Tracker App/src/components/ui/dropdown-menu.tsx`
20. `Design Habit Tracker App/src/components/ui/input-otp.tsx`
21. `Design Habit Tracker App/src/components/ui/menubar.tsx`
22. `Design Habit Tracker App/src/components/ui/navigation-menu.tsx`
23. `Design Habit Tracker App/src/components/ui/pagination.tsx`
24. `Design Habit Tracker App/src/components/ui/radio-group.tsx`
25. `Design Habit Tracker App/src/components/ui/resizable.tsx`
26. `Design Habit Tracker App/src/components/ui/select.tsx`
27. `Design Habit Tracker App/src/components/ui/sheet.tsx`
28. `Design Habit Tracker App/src/components/ui/sidebar.tsx`
29. `Design Habit Tracker App/src/pages/HomePage.tsx`
30. `Design Habit Tracker App/src/pages/ManageHabitsPage.tsx`
31. `Design Habit Tracker App/src/pages/StatisticsPage.tsx`

Unique icon names identified so far:
1. `ArrowLeft`
2. `ArrowRight`
3. `BarChart3`
4. `Calendar`
5. `CheckCircle2`
6. `CheckIcon`
7. `ChevronDownIcon`
8. `ChevronLeft`
9. `ChevronLeftIcon`
10. `ChevronRight`
11. `ChevronRightIcon`
12. `ChevronUpIcon`
13. `CircleIcon`
14. `Clock`
15. `ExternalLink`
16. `Flame`
17. `GripVerticalIcon`
18. `Home`
19. `Inbox`
20. `Info`
21. `Infinity`
22. `ListChecks`
23. `Moon`
24. `MoreHorizontal`
25. `MoreHorizontalIcon`
26. `MinusIcon`
27. `PanelLeftIcon`
28. `Pencil`
29. `Plus`
30. `Search`
31. `SearchIcon`
32. `Sun`
33. `Trash2`
34. `TrendingUp`
35. `Trophy`
36. `X`
37. `XIcon`

Note: some pairs are semantic duplicates with different names (`ChevronLeft` vs `ChevronLeftIcon`). Keep both names in the first pass, then optionally alias later.

## Target Structure

1. `Habit Tacker App Vanilla/assets/icons/`
2. Naming convention: kebab-case based on import name, for example:
	- `arrow-right.svg`
	- `chevron-left-icon.svg`
	- `check-circle-2.svg`

## Download Strategy

1. Create a temporary script in vanilla project, for example `scripts/download-lucide-icons.mjs`.
2. Use one source of truth list (the unique names above) in that script.
3. Download each icon from Lucide using the icon name and save as SVG to `assets/icons`.
4. Normalize all downloaded files:
	- ensure `stroke="currentColor"`
	- preserve default `viewBox`
	- strip unnecessary metadata
5. Generate `assets/icons/manifest.json` containing:
	- icon name
	- file name
	- source package version used to download

## Replacement Strategy In Vanilla JS

1. Add a simple icon utility that maps logical names to file paths, for example:
	- `iconPath('arrow-right') -> ./assets/icons/arrow-right.svg`
2. Replace React icon components with either:
	- inline `<img src="...">` where static is enough, or
	- fetched inline SVG where color inheritance via `currentColor` is required.
3. Prioritize replacing in app shell and main pages first, then shared UI primitives.

## Execution Phases

Phase 1: Inventory lock
1. Re-scan source and freeze final unique icon list.
2. Confirm if UI primitive icons from `src/components/ui/*` are in scope for vanilla migration v1.

Phase 2: Download and normalize
1. Create `assets/icons`.
2. Run download script for all frozen names.
3. Validate all files open correctly and render.

Phase 3: Wire into vanilla app
1. Implement icon path helper.
2. Replace first set of critical icons:
	- navigation
	- modal close/actions
	- list actions

Phase 4: Cleanup and lock
1. Add manifest and usage mapping in `implementation.md`.
2. Remove icon package dependencies from vanilla target if no longer needed.

## Verification Checklist

1. Every Lucide import name has a corresponding file in `assets/icons`.
2. No missing icons when rendering main navigation, pages, and modals.
3. All icons inherit theme color correctly where expected.
4. Icon sizing is controlled by CSS, not hardcoded in file usage.
5. `implementation.md` contains source-to-target mapping and any alias decisions.

## Risks and Mitigations

1. Risk: duplicate icon variants (`Icon` suffix and non-suffix) create bloat.
	Mitigation: keep both in first pass, deduplicate with alias map after UI parity.
2. Risk: dynamic color behavior differs when switching from React component to file asset.
	Mitigation: prefer inline injection for icons that rely on `currentColor`.
3. Risk: downloading from different Lucide versions causes visual mismatch.
	Mitigation: pin one Lucide version and store it in manifest.
