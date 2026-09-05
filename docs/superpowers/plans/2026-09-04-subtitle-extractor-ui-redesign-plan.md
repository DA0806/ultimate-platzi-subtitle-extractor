# Signal Console UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the subtitle extractor's visual system and workspace layout as a minimal, premium Signal Console without changing extraction behavior.

**Architecture:** Keep App.jsx and the existing feature components as the behavioral composition layer. Add a small local shadcn-compatible primitive layer backed by CSS-variable tokens, then restyle the shell, input flow, and result workspace around those primitives. Stores, hooks, parsers, auth logic, and download utilities remain untouched.

**Tech Stack:** React 19, Vite, Tailwind CSS 3, plain CSS variables, Lucide React, existing Zustand stores and hooks.

**Spec:** docs/superpowers/specs/2026-09-04-subtitle-extractor-ui-redesign-design.md

## Global Constraints

- No changes to parser, downloader, auth, stores, or extraction concurrency.
- No full shadcn CLI install. The app has no Radix or shadcn dependencies; use a small local shadcn-compatible primitive layer only where it reduces repeated interaction styling.
- Do not touch unrelated worktree changes (useLanguageDetect.js, .graphifyignore, graphify-out/, or run.ps1).
- Dark mode is the default visual target. Light mode remains supported because the current product exposes a theme toggle.
- Use the three-layer architecture from UI UX Pro Max: primitive values feed semantic aliases, which feed component tokens.
- IBM Plex Sans is used for UI copy; JetBrains Mono is used for URLs, counts, progress values, and technical metadata.
- The page is left-aligned and workspace-oriented. Avoid a centered marketing hero, testimonial sections, or a grid of identical feature cards.
- All touch/click targets are at least 44×44px with 8px minimum separation.
- Use aria-pressed for language/video selection and aria-live="polite" for progress/result updates.
- Use 150–250ms transitions for interactive states, never layout-shifting hover transforms.
- Respect prefers-reduced-motion by disabling entrance animation and non-essential transitions.
- Validate at 375px, 768px, 1024px, and 1440px, including no horizontal overflow.
- Use Lucide SVG icons only; no emoji icons.
- Run npm run lint and npm run build at the end of every task.

---

### Task 1: Replace the visual foundation and add local primitives

**Files:**
- Modify: design-system/ultimate-platzi-subtitle-extractor/MASTER.md
- Modify: src/index.css
- Modify: tailwind.config.js
- Modify: index.html
- Create: src/components/ui/Button.jsx
- Create: src/components/ui/Card.jsx
- Create: src/components/ui/Badge.jsx
- Create: src/components/ui/Input.jsx
- Create: src/components/ui/Progress.jsx

**Interfaces:**
- Button accepts { variant = 'default', size = 'default', loading = false, className, children, ...buttonProps } and renders a native button.
- Card accepts { className, children, ...divProps } and renders a themed section or div surface without hover movement.
- Badge accepts { variant = 'default', className, children, ...spanProps }.
- Input accepts all native input props plus invalid; it must keep the caller's id, aria-*, and className.
- Progress accepts { value = 0, className, ...divProps }, clamps the visual value to 0–100, and renders a role="progressbar" element with aria-valuemin, aria-valuemax, and aria-valuenow.

- [ ] **Step 1: Replace the provisional Design System Master file**

Overwrite the old claymorphism/teal recommendation with the approved Signal Console rules from the spec: dark-first ink surfaces, restrained Platzi lime, IBM Plex Sans, JetBrains Mono, left-aligned workspace layout, Lucide-only icons, accessibility constraints, and no testimonial/marketing pattern. Keep the page override file intact.

- [ ] **Step 2: Define primitive, semantic, and component CSS variables**

In src/index.css, add the exact primitive and semantic HSL tokens from the spec. Map dark defaults in :root, .dark, light overrides in .light, and component values for --radius, --radius-sm, --radius-pill, --control-height, --card-padding, --panel-shadow, and --focus-shadow.

Use the shadcn-compatible channel format:

~~~
:root {
  --background: 150 16% 5%;
  --foreground: 90 20% 97%;
  --card: 150 14% 8%;
  --primary: 85 82% 55%;
  --primary-foreground: 90 45% 9%;
  --border: 150 10% 18%;
  --ring: 85 82% 55%;
}
~~~

Add the IBM Plex Sans and JetBrains Mono font imports with system fallbacks, base 16px typography, a readable body line-height, box-sizing, focus-visible styling, and the reduced-motion media query. Keep src/App.css unchanged.

- [ ] **Step 3: Map semantic tokens into Tailwind**

Update tailwind.config.js with darkMode: ['class'], semantic hsl(var(--token)) colors for background, foreground, card, primary, secondary, muted, accent, destructive, border, input, and ring, plus lg/md/sm radii from --radius. Preserve existing content globs and only retain animation definitions that the new UI uses.

- [ ] **Step 4: Add the smallest useful shadcn-compatible primitives**

Create the five files listed above using plain React and Tailwind classes. Keep variants in local object maps rather than adding class-variance-authority, clsx, tailwind-merge, or Radix dependencies. Use Loader2 from the already-installed Lucide package for Button loading. Every interactive base class must include cursor-pointer, transition timing, disabled state, and a visible focus-visible ring.

- [ ] **Step 5: Verify the foundation**

Run:

~~~
npm run lint
npm run build
~~~

Expected: both commands exit 0 with no ESLint errors and a successful Vite production build.

- [ ] **Step 6: Commit the foundation**

~~~
git add design-system/ultimate-platzi-subtitle-extractor/MASTER.md src/index.css tailwind.config.js index.html src/components/ui
git commit -m "feat: add signal console design foundation"
~~~

### Task 2: Rebuild the shell and course-entry flow

**Files:**
- Modify: src/App.jsx
- Modify: src/components/Header.jsx
- Modify: src/components/SessionBadge.jsx
- Modify: src/components/AuthPanel.jsx
- Modify: src/components/UrlInput.jsx
- Modify: src/components/LanguageSelector.jsx

**Interfaces:**
- Preserve every existing hook/store call and callback signature in App.jsx, UrlInput.jsx, Header.jsx, AuthPanel.jsx, and LanguageSelector.jsx.
- Header continues to own the existing theme toggle and auth panel open/close behavior.
- UrlInput continues to submit through useCourseParser and useLanguageDetect and must keep its current loading/error behavior.
- LanguageSelector continues to update the existing selected-language state; its visual selection is represented with aria-pressed.

- [ ] **Step 1: Reshape App.jsx into the approved shell**

Keep the existing data wiring and conditionals, but use a full-height background, skip link, semantic main id="main-content", a 1200px max-width content region, left-aligned heading/context, and an extraction tray around UrlInput. Preserve any existing pb-* space required by active export controls. Use a single quiet three-step helper row for course → language → subtitles instead of a marketing hero.

- [ ] **Step 2: Apply primitives to header/session/auth**

Use the local Button, Badge, and Card primitives in Header, SessionBadge, and AuthPanel. Keep the sticky header compact and use Lucide labels instead of emoji. Give the auth panel role="dialog", aria-modal="true", an accessible heading, labeled close button, keyboard-visible focus, and Escape-to-close without changing auth behavior.

- [ ] **Step 3: Apply primitives to URL input and language selection**

Give the URL field a persistent visible label, helper copy, invalid styling connected by aria-describedby, and a loading button label that stays action-oriented. Render language choices as keyboard-accessible buttons with text labels/ISO codes and aria-pressed; remove emoji flags while preserving the current language values and custom-language behavior.

- [ ] **Step 4: Correct only touched user-facing mojibake**

When editing visible strings in these files, use valid Spanish text such as Subtítulos, Extracción, and Sesión. Do not perform an unrelated copy rewrite.

- [ ] **Step 5: Verify the shell**

Run:

~~~
npm run lint
npm run build
~~~

Expected: both commands exit 0; no hook/store behavior is removed.

- [ ] **Step 6: Commit the shell**

~~~
git add src/App.jsx src/components/Header.jsx src/components/SessionBadge.jsx src/components/AuthPanel.jsx src/components/UrlInput.jsx src/components/LanguageSelector.jsx
git commit -m "feat: redesign signal console entry flow"
~~~

### Task 3: Rebuild the extraction workspace and completion actions

**Files:**
- Modify: src/components/VideoList.jsx
- Modify: src/components/VideoCard.jsx
- Modify: src/components/ProgressBar.jsx
- Modify: src/components/ExportPanel.jsx
- Modify: src/App.jsx (only if the workspace requires a layout wrapper or reserved action space)

**Interfaces:**
- Preserve the existing video object shape, store selectors, download callbacks, status values, and extraction hook contract.
- VideoCard keeps per-video selection and download behavior; VideoList keeps select-all/reset behavior.
- ProgressBar consumes the existing store progress values and exposes them through the Progress primitive.
- ExportPanel keeps merged-text and ZIP download callbacks and remains available only when the existing store says output is available.

- [ ] **Step 1: Compose the parsed workspace**

Make VideoList the primary wider column and the language/export summary the secondary column at desktop widths. Collapse to one column below the tablet breakpoint. Use Card for surfaces only where it communicates grouping; keep row separators and status badges quiet.

- [ ] **Step 2: Refine video selection/status rows**

Use an accessible native checkbox or button with visible focus, stable labels, and no emoji. Use Badge variants for ready, extracting, complete, and error. Keep the title, duration, available-language text, and per-video download action readable at 375px without horizontal overflow.

- [ ] **Step 3: Make progress semantic and calm**

Use Progress with the existing percentage, add aria-live="polite" status text with completed/total counts, and keep status in normal document flow or a sticky region with reserved bottom padding. Do not cover the list or export controls with a fixed layer.

- [ ] **Step 4: Refine export actions**

Use explicit labels Descargar TXT and Descargar ZIP, preserve the existing merge/download functions, and make the action region responsive with 44px targets. Keep per-video download actions available from each row.

- [ ] **Step 5: Verify the full workspace**

Run:

~~~
npm run lint
npm run build
~~~

Expected: both commands exit 0. Manually exercise URL submission, parsed videos, language selection, extraction progress, errors, completion, merged TXT download, ZIP download, theme toggle, and auth drawer.

- [ ] **Step 6: Commit the workspace**

~~~
git add src/App.jsx src/components/VideoList.jsx src/components/VideoCard.jsx src/components/ProgressBar.jsx src/components/ExportPanel.jsx
git commit -m "feat: polish subtitle extraction workspace"
~~~

