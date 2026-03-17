# Sproutly Core Style Guide

This guide defines the smallest useful variable system for the vanilla rebuild.
It is intentionally limited to core foundations so the first CSS pass stays clean
and implementation does not get buried under token sprawl.

## Goals

1. Preserve the Sproutly visual identity from the source app.
2. Keep naming simple enough to use directly in vanilla CSS.
3. Separate stable brand colors from reusable semantic aliases.
4. Support both light and dark themes from the start.

## Token Model

Use two layers only.

1. Brand primitives
   Raw, named brand colors that rarely change.
2. Semantic aliases
   Role-based variables used by the UI.

Rule: components should prefer semantic aliases. Brand primitives should only be
used when you are intentionally applying brand color, not describing UI role.

## Brand Primitives

These values come from the existing app palette.

```css
--brand-olive: hsl(75 32% 60%);
--brand-yellow-green: hsl(67 51% 76%);
--brand-cream: hsl(51 95% 84%);
--brand-sand: hsl(43 82% 80%);
--brand-terracotta: hsl(30 53% 64%);
--brand-ink: hsl(0 0% 18%);
--brand-paper: hsl(0 0% 100%);
```

## Semantic Color Tokens

Use these in actual UI rules.

```css
--color-bg
--color-text
--color-surface
--color-surface-text
--color-primary
--color-primary-text
--color-secondary
--color-secondary-text
--color-accent
--color-accent-text
--color-muted
--color-muted-text
--color-border
--color-danger
--color-danger-text
--color-focus-ring
```

### Sidebar Tokens

Keep a very small sidebar namespace because the current sidebar is visually distinct.

```css
--sidebar-bg
--sidebar-text
--sidebar-accent
--sidebar-accent-text
--sidebar-border
```

## Theme Matrix

### Light Theme

```css
--color-bg: hsl(51 95% 89%);
--color-text: hsl(0 0% 18%);
--color-surface: hsl(0 0% 100%);
--color-surface-text: hsl(0 0% 18%);
--color-primary: var(--brand-olive);
--color-primary-text: hsl(0 0% 12%);
--color-secondary: var(--brand-yellow-green);
--color-secondary-text: hsl(0 0% 18%);
--color-accent: var(--brand-terracotta);
--color-accent-text: hsl(0 0% 100%);
--color-muted: hsl(0 0% 42%);
--color-muted-text: hsl(0 0% 42%);
--color-border: hsl(75 32% 60% / 0.3);
--color-danger: hsl(0 73% 50%);
--color-danger-text: hsl(0 0% 100%);
--color-focus-ring: var(--brand-olive);
--sidebar-bg: hsl(0 0% 100%);
--sidebar-text: hsl(0 0% 18%);
--sidebar-accent: hsl(67 51% 76% / 0.5);
--sidebar-accent-text: hsl(0 0% 18%);
--sidebar-border: hsl(75 32% 60% / 0.2);
```

### Dark Theme

```css
--color-bg: hsl(90 10% 11%);
--color-text: hsl(45 18% 90%);
--color-surface: hsl(90 8% 15%);
--color-surface-text: hsl(45 18% 90%);
--color-primary: var(--brand-olive);
--color-primary-text: hsl(0 0% 12%);
--color-secondary: hsl(67 51% 70%);
--color-secondary-text: hsl(0 0% 18%);
--color-accent: var(--brand-terracotta);
--color-accent-text: hsl(0 0% 100%);
--color-muted: hsl(45 8% 59%);
--color-muted-text: hsl(45 8% 59%);
--color-border: hsl(90 10% 23%);
--color-danger: hsl(0 85% 60%);
--color-danger-text: hsl(0 0% 100%);
--color-focus-ring: var(--brand-olive);
--sidebar-bg: hsl(90 8% 15%);
--sidebar-text: hsl(45 18% 90%);
--sidebar-accent: hsl(67 51% 76% / 0.2);
--sidebar-accent-text: hsl(45 18% 90%);
--sidebar-border: hsl(90 10% 23%);
```

## Typography

Sproutly uses three font roles.

```css
--font-display: "Montserrat Alternates", sans-serif;
--font-body: "Text Me One", sans-serif;
--font-data: "Overpass", sans-serif;
```

### Typography Roles

1. Display font
   Use for page titles and section headings.
2. Body font
   Use for paragraphs, labels, buttons, helper text, and navigation.
3. Data font
   Use for metrics, percentages, charts, and numeric summaries.

### Core Type Variables

```css
--font-size-base: 16px;
--font-size-sm: 0.875rem;
--font-size-md: 1rem;
--font-size-lg: 1.25rem;
--font-size-xl: 1.5rem;
--font-size-2xl: 2rem;
--font-size-stat: 3rem;
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
--line-height-default: 1.5;
```

## Spacing Scale

Use a 4px rhythm with a short scale.

```css
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-5: 1.25rem;
--space-6: 1.5rem;
--space-8: 2rem;
--space-10: 2.5rem;
```

### Common Usage

1. Cards: `--space-6` to `--space-8`
2. Section gaps: `--space-6` to `--space-8`
3. Tight inline spacing: `--space-2` to `--space-3`

## Radius Scale

```css
--radius-sm: 0.5rem;
--radius-md: 0.75rem;
--radius-card: 0.875rem;
--radius-lg: 1rem;
--radius-shell: 2rem;
--radius-pill: 999px;
```

Use `--radius-card` for main dashboard cards because the source app repeatedly
uses a 14px card radius.

## Shadow Scale

```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
```

### Common Usage

1. Default cards: `--shadow-sm`
2. Hovered cards: `--shadow-md`
3. Floating mobile actions and overlays: `--shadow-xl`

## Naming Rules

1. Use `--brand-*` for raw palette values.
2. Use `--color-*` for semantic UI roles.
3. Use `--font-*` for family, size, or weight variables.
4. Use `--space-*`, `--radius-*`, and `--shadow-*` for scales.
5. Avoid creating a new token if an existing semantic token already describes the role.

## Migration Map

| Current token | New core token |
| --- | --- |
| `--background` | `--color-bg` |
| `--foreground` | `--color-text` |
| `--card` | `--color-surface` |
| `--card-foreground` | `--color-surface-text` |
| `--primary` | `--color-primary` |
| `--primary-foreground` | `--color-primary-text` |
| `--secondary` | `--color-secondary` |
| `--secondary-foreground` | `--color-secondary-text` |
| `--accent` | `--color-accent` |
| `--accent-foreground` | `--color-accent-text` |
| `--muted` | `--color-muted` |
| `--muted-foreground` | `--color-muted-text` |
| `--border` | `--color-border` |
| `--destructive` | `--color-danger` |
| `--destructive-foreground` | `--color-danger-text` |
| `--ring` | `--color-focus-ring` |
| `--sidebar` | `--sidebar-bg` |
| `--sidebar-foreground` | `--sidebar-text` |
| `--sidebar-accent` | `--sidebar-accent` |
| `--sidebar-accent-foreground` | `--sidebar-accent-text` |
| `--sidebar-border` | `--sidebar-border` |

## Keep It Core

Do not add component-specific custom properties until the vanilla layout actually
needs them. The first pass should be able to build most screens with the tokens
in this guide alone.