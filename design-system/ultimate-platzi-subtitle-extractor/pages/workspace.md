# Workspace override — Signal Console

This page override supersedes the provisional global recommendation for the
subtitle-extraction workspace. The approved direction is minimal, attractive,
and technical rather than playful or marketing-led.

## Direction

- Dark-first OLED console with quiet ink surfaces and restrained Platzi lime.
- IBM Plex Sans for UI copy; JetBrains Mono for URLs, counts, and statuses.
- Left-aligned workspace layout; no testimonials, feature-card grids, or
  centered landing-page hero.
- The extraction tray is the single memorable element: URL input plus the
  primary extraction action.
- Use Lucide SVG icons only; no emoji icons.

## Palette

Use shadcn-compatible HSL variables with primitive → semantic → component
layers. Dark defaults:

```css
--background: 150 16% 5%;
--foreground: 90 20% 97%;
--card: 150 14% 8%;
--muted: 150 12% 12%;
--muted-foreground: 145 8% 67%;
--border: 150 10% 18%;
--primary: 85 82% 55%;
--primary-foreground: 90 45% 9%;
--accent: 164 58% 48%;
--ring: 85 82% 55%;
```

Light mode remains supported through semantic overrides because the existing
product exposes a theme toggle. Keep contrast at WCAG AA or better.

## Components

Use a small local shadcn-compatible layer for Button, Card, Badge, Input, and
Progress. Keep existing React behavior in feature components and use Tailwind
for layout. Do not install a full component library or add a dependency just
for class merging.

## Interaction

- Minimum 44px targets, visible keyboard focus, logical tab order, skip link.
- `aria-pressed` for selections, `aria-live="polite"` for progress/result
  updates, semantic labels for all form controls.
- 150–250ms transitions; no layout-shifting hover transforms.
- Respect `prefers-reduced-motion`.
- Validate at 375, 768, 1024, and 1440px with no horizontal overflow.

