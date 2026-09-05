# Signal Console UI/UX redesign

## Status

The visual direction was approved by the user on 2026-09-04. This document
defines the implementation contract for the first redesign pass.

## Goal

Make the subtitle extractor feel minimal, premium, and coherent while keeping
the existing course parsing, language detection, subtitle extraction, auth,
and export behavior intact.

The primary user job remains:

1. Paste a Platzi course URL.
2. Inspect the discovered videos.
3. Choose subtitle languages and videos.
4. Extract and download the result.

## Non-goals

- No changes to parser, downloader, auth, stores, or extraction concurrency.
- No new routing, onboarding flow, analytics, or persistence model.
- No animation library or visual asset pipeline.
- No full shadcn CLI install. The app has no Radix or shadcn dependencies;
  use a small local shadcn-compatible primitive layer only where it reduces
  repeated interaction styling.
- Do not touch unrelated worktree changes (`useLanguageDetect.js`,
  `.graphifyignore`, `graphify-out/`, or `run.ps1`).

## Product and visual direction

This is a focused utility for technical learners and creators, not a marketing
landing page. The interface should read as a calm extraction console: one
clear primary action, quiet surfaces, useful status signals, and no decorative
content that competes with the work.

The memorable element is the extraction tray: a single high-contrast lime
surface around the URL action. Everything else stays restrained.

### Alternatives considered

- **Signal Console — selected:** dark-first technical workspace with restrained
  Platzi lime and mono metadata. Best fit for repeated operational use.
- **Editorial Learning Studio:** warmer, more expressive composition. More
  distinctive, but adds visual distance from a utility workflow.
- **Platzi Neon Pro:** stronger neon treatment and more brand energy. Easier to
  recognize, but less premium and more visually fatiguing for long sessions.

## Design tokens

Use the three-layer architecture from UI UX Pro Max: primitive values feed
semantic aliases, which feed component tokens. shadcn-style variables use HSL
channels without the `hsl()` wrapper so Tailwind can apply opacity.

### Primitive layer

```css
:root {
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
}
```

### Semantic layer

Dark mode is the default visual target. Light mode remains supported because
the current product exposes a theme toggle.

```css
:root,
.dark {
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
}

.light {
  --background: var(--paper-50);
  --foreground: 150 28% 12%;
  --card: var(--white);
  --card-foreground: 150 28% 12%;
  --popover: var(--white);
  --popover-foreground: 150 28% 12%;
  --primary: var(--forest-700);
  --primary-foreground: var(--white);
  --secondary: var(--paper-100);
  --secondary-foreground: 150 28% 12%;
  --muted: var(--paper-100);
  --muted-foreground: 150 10% 36%;
  --accent: 157 42% 32%;
  --accent-foreground: var(--white);
  --success: var(--forest-700);
  --warning: 34 83% 38%;
  --destructive: 0 67% 43%;
  --destructive-foreground: var(--white);
  --border: var(--paper-200);
  --input: var(--paper-200);
  --ring: var(--forest-700);
}
```

### Component layer

```css
:root {
  --radius: 0.875rem;
  --radius-sm: 0.625rem;
  --radius-pill: 999px;
  --control-height: 2.75rem;
  --card-padding: 1.25rem;
  --panel-shadow: 0 18px 50px hsl(var(--black) / 0.18);
  --focus-shadow: 0 0 0 3px hsl(var(--ring) / 0.24);
}
```

Spacing uses a 4px base with 8px as the default rhythm: 8, 12, 16, 24,
32, and 48px. Content is capped at 1200px, with 16px side padding on small
screens and 24px on larger screens.

### Typography

- IBM Plex Sans: headings, labels, controls, body copy.
- JetBrains Mono: URLs, counts, progress values, and technical metadata.
- Base size: 16px; body line-height at least 1.5.
- Headings use sentence case, not tracked-out all caps.
- Keep copy direct and action-oriented: “Extract subtitles”, “Download ZIP”,
  “Select all”.

## Layout and states

### Shell

```text
[brand + product name]                         [theme] [session] [account]

                       MAIN (max 1200px)
 [title + context]               [quiet workflow note]

 [extraction tray: URL input + primary action + helper/error feedback]

 [course/video workspace]        [language + export summary]

 [progress status / result actions when active]
```

The page is left-aligned and workspace-oriented. Avoid a centered marketing
hero, testimonial sections, or a grid of identical feature cards.

### Empty state

Show a compact title and the extraction tray immediately. Keep instructions to
three short steps. The URL input is the dominant control and has a persistent
visible label.

### Parsed state

Show the discovered course context, then a two-column workspace on desktop:
the video list gets the larger column and language/export controls sit in a
secondary panel. Collapse to one column below the tablet breakpoint.

### Extracting state

Keep the active progress region in the normal document flow or in a sticky
bottom region with reserved page padding. It must expose percentage, completed
count, current status, and a cancel/reset path if the existing hook supports
it. Do not hide content behind the fixed header or export actions.

### Completion state

Make successful output obvious with a calm success state and two explicit
actions: download merged text and download ZIP. Per-video download remains
available on each row.

## Component contract

Use local shadcn-compatible primitives under `src/components/ui/` only for
repeated visual contracts:

- `Button`: primary, secondary, ghost, destructive; 44px minimum hit area,
  visible focus ring, disabled and loading states.
- `Card`: surface, border, padding, and radius tokens; no universal hover lift.
- `Badge`: status labels for ready, extracting, complete, and error.
- `Input`: label-friendly styling, placeholder, invalid state, and focus ring.
- `Progress`: semantic progressbar styling.

These primitives may use plain React and Tailwind classes; do not add a new
utility or variant dependency solely to imitate shadcn. Keep Lucide as the
single icon family already installed.

Existing feature components keep their behavioral responsibilities:

- `Header.jsx`: brand, theme toggle, session badge, auth panel trigger.
- `UrlInput.jsx`: course URL submission, loading, error, and language detect.
- `LanguageSelector.jsx`: selected language state; replace emoji flags with
  text/ISO labels and Lucide icons.
- `VideoList.jsx` / `VideoCard.jsx`: selection and per-video status/download.
- `ProgressBar.jsx`: progress visuals plus `role="progressbar"` and live status.
- `ExportPanel.jsx`: merged and ZIP downloads without overlapping content.
- `AuthPanel.jsx`: existing auth/session behavior with accessible drawer
  semantics and keyboard-close behavior preserved.

Do not move extraction logic into UI primitives. Stores and hooks remain the
source of truth.

## Interaction and accessibility

- Add a skip link to `#main-content`.
- Preserve logical DOM/tab order and make every action usable by keyboard.
- Use semantic `button`, `label`, `fieldset`, `main`, and `aside` elements.
- Use `aria-pressed` for language/video selection and `aria-live="polite"`
  for progress and completion feedback.
- Keep focus visible with the semantic ring token; do not remove outlines
  without replacing them.
- All touch/click targets are at least 44×44px with 8px minimum separation.
- Maintain WCAG AA contrast for normal text and never use color as the only
  status signal.
- Use Lucide SVG icons with labels; no emoji icons.
- Use 150–250ms transitions for interactive states, never layout-shifting
  hover transforms.
- Respect `prefers-reduced-motion` by disabling entrance animation and non-
  essential transitions.
- Test at 375px, 768px, 1024px, and 1440px, including browser zoom to 200%.

## Implementation scope

Expected files:

- `src/index.css` — token layers, base typography, focus/motion utilities.
- `tailwind.config.js` — map semantic HSL tokens and radii.
- `src/App.jsx` — shell/layout only; preserve existing hook/store wiring.
- `src/components/ui/*` — minimal local primitives if useful.
- `src/components/Header.jsx`
- `src/components/UrlInput.jsx`
- `src/components/LanguageSelector.jsx`
- `src/components/VideoList.jsx`
- `src/components/VideoCard.jsx`
- `src/components/ProgressBar.jsx`
- `src/components/ExportPanel.jsx`
- `src/components/AuthPanel.jsx`
- `src/components/SessionBadge.jsx`

`src/App.css` is leftover Vite starter styling and should remain untouched
unless the implementation proves it is imported and conflicts with the new
tokens. Fix visible mojibake in user-facing strings only where those strings
are already being edited.

## Verification contract

Before claiming completion:

1. Run `npm run lint`.
2. Run `npm run build`.
3. Exercise the empty, parsed, extracting, error, and completed states in the
   browser at the four target widths.
4. Verify keyboard-only navigation, focus visibility, reduced motion, and no
   horizontal overflow.
5. Confirm business behavior still submits a URL, selects languages/videos,
   tracks progress, authenticates, and downloads output.

