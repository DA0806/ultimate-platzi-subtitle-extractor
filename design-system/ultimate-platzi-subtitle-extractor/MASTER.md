# Design System Master File — Signal Console

> Check `design-system/ultimate-platzi-subtitle-extractor/pages/[page-name].md`
> first. A page-specific file overrides these global rules.

## Product direction

Signal Console is a dark-first workspace for extracting Platzi subtitles.
Use quiet ink surfaces, restrained Platzi lime, and a left-aligned workspace
layout. The URL extraction tray is the primary visual anchor. Do not use a
testimonial carousel, marketing hero, feature-card grid, or other landing-page
pattern.

## Visual foundation

- Body/UI type: IBM Plex Sans, with system sans fallbacks.
- URLs, counts, identifiers, and statuses: JetBrains Mono, with system mono
  fallbacks.
- Icons: Lucide SVG icons only; never use emoji or text glyphs as icons.
- Dark mode is the default. Light mode remains supported through the semantic
  overrides below.
- Use the three layers in order: primitive tokens, semantic tokens, and
  component styles.

### Primitive tokens

```css
--ink-950: 150 16% 5%;
--ink-900: 150 14% 8%;
--ink-800: 150 12% 12%;
--ink-700: 150 10% 18%;
--ink-600: 150 9% 27%;
--paper-50: 90 20% 97%;
--paper-100: 90 16% 93%;
--paper-200: 90 10% 86%;
--lime-400: 85 82% 55%;
--lime-500: 85 72% 43%;
--forest-700: 86 58% 26%;
--mint-400: 164 58% 48%;
--amber-400: 38 88% 60%;
--red-400: 0 80% 70%;
--white: 0 0% 100%;
--black: 0 0% 0%;
```

### Dark semantic tokens

```css
--background: var(--ink-950);
--foreground: var(--paper-50);
--card: var(--ink-900);
--card-foreground: var(--paper-50);
--popover: var(--ink-800);
--popover-foreground: var(--paper-50);
--primary: var(--lime-400);
--primary-foreground: 90 45% 9%;
--secondary: var(--ink-800);
--secondary-foreground: var(--paper-50);
--muted: var(--ink-800);
--muted-foreground: 145 8% 67%;
--accent: var(--mint-400);
--accent-foreground: 150 30% 8%;
--success: var(--lime-400);
--warning: var(--amber-400);
--destructive: var(--red-400);
--destructive-foreground: var(--black);
--border: var(--ink-700);
--input: var(--ink-700);
--ring: var(--lime-400);
```

Light mode uses the approved semantic overrides in `src/index.css`.

## Component rules

Use the local shadcn-compatible primitives for Button, Card, Badge, Input, and
Progress. Keep surfaces semantic, targets at least 44px where interactive,
and avoid layout-shifting hover transforms. Interactive elements need a
visible `:focus-visible` state, a 150–250ms transition, and a pointer cursor.
Inputs retain their labels, IDs, `aria-*` attributes, and invalid state.
Progress exposes its numeric ARIA range. Use `aria-pressed` for selections and
`aria-live="polite"` for progress or result updates.

Respect `prefers-reduced-motion`, maintain WCAG AA text contrast, keep logical
keyboard order, and prevent horizontal overflow at 375px, 768px, 1024px, and
1440px widths. Include a skip link when introducing a new page shell.

Do not install a component library or icon dependency for this layer. Keep
`design-system/ultimate-platzi-subtitle-extractor/pages/workspace.md` as the
workspace-specific source of truth for that page.
