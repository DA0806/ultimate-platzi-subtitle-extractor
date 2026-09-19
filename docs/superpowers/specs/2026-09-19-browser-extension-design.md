# Browser Extension Manifest V3 Design Spec

## Status

Approved approach on 2026-09-19. This specification defines the architecture, components, and migration path for packaging the Ultimate Platzi Subtitle Extractor (UPSE) as a Chromium-compatible Browser Extension (Chrome, Edge, Brave, Opera) while keeping the web/desktop codebase intact in its own branch.

## Context & Motivation

Deploying UPSE to a shared serverless host like Vercel is non-viable due to:
1. Vite development proxies (`server.middlewares`, `server.proxy`) are discarded in production static builds (`dist/`).
2. Cloudflare WAF on Platzi automatically blocks datacenter/serverless IPs (AWS/Vercel) with captchas and 403 blocks.
3. Multi-user cookie sharing across different geographical locations triggers session invalidation.

A **Manifest V3 Browser Extension** completely eliminates these constraints:
- **Zero CORS**: Declarative `host_permissions` allow direct cross-origin `fetch` to `platzi.com` and `static.platzi.com` from the extension context. No proxy server needed.
- **Automatic Auth**: Uses `chrome.cookies` to read the user's active `sessionid` from their active Platzi session without requiring manual F12 DevTools copy-pasting.
- **Residential IPs**: Requests originate from the user's personal browser and ISP, avoiding datacenter IP bans.
- **Zero Infrastructure Costs**: Runs client-side; distributed as an unpacked folder or `.zip`.

## UX / Form Factor Decision

- **Primary Mode (Selected)**: **Full Tab Workspace (`chrome.tabs.create`)**. Clicking the extension icon in the toolbar opens `chrome-extension://<id>/index.html` in a dedicated browser tab. This preserves the 100% full Signal Console layout (designed for >=1024px displays with dual columns, progress bars, and course tables) without squeezing it into a 400px popup.
- **Secondary Mode**: **Chrome Side Panel (`chrome.sidePanel`)**. Supported via `manifest.json` so users can pin the extractor next to their active Platzi lecture video if desired.

## Architecture

### 1. File Structure in Extension Worktree (`feat/browser-extension`)

```text
worktrees/browser-extension/
├── public/
│   ├── manifest.json            # Manifest V3 configuration
│   ├── favicon.svg              # Extension icon (SVG)
│   └── icons/                   # Standard PNG extension icons (16, 48, 128)
├── src/
│   ├── background.js            # MV3 Service Worker (action click & cookie extraction)
│   ├── utils/
│   │   ├── platziClient.js      # Unified network adapter (direct fetch in ext, proxy in dev)
│   │   ├── courseParser.js      # Updated to use platziClient
│   │   └── vttParser.js         # Intact
│   ├── hooks/
│   │   ├── useExtensionAuth.js  # Auto-sync hook for Platzi session cookies
│   │   └── useSubtitleExtractor.js # Updated to use platziClient
│   ├── components/
│   │   └── SessionBadge.jsx     # Updated to show "Sesión detectada automáticamente"
│   └── ... (existing UI intact)
├── vite.config.js               # base: './', builds extension bundle to dist/
└── package.json
```

### 2. Manifest V3 Specification (`public/manifest.json`)

```json
{
  "manifest_version": 3,
  "name": "Ultimate Platzi Subtitle Extractor",
  "version": "1.0.0",
  "description": "Extrae subtítulos de cursos y clases de Platzi directamente en tu navegador.",
  "action": {
    "default_title": "Abrir Platzi Subtitle Extractor"
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "permissions": [
    "cookies",
    "storage"
  ],
  "optional_permissions": [
    "sidePanel"
  ],
  "host_permissions": [
    "*://platzi.com/*",
    "*://*.platzi.com/*",
    "*://static.platzi.com/*"
  ],
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

### 3. Background Service Worker (`src/background.js`)

Responsibilities:
1. **Toolbar Click Handler**:
   ```javascript
   chrome.action.onClicked.addListener(async (tab) => {
     chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
   });
   ```
2. **Cookie Provider API**:
   Responds to internal extension messages (`GET_PLATZI_COOKIES`):
   ```javascript
   chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
     if (message.type === 'GET_PLATZI_COOKIES') {
       chrome.cookies.getAll({ domain: 'platzi.com' }, (cookies) => {
         const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
         const hasSession = cookies.some(c => c.name === 'sessionid');
         sendResponse({ cookieHeader, hasSession });
       });
       return true; // Keep message channel open for async response
     }
   });
   ```

### 4. Network Adapter (`src/utils/platziClient.js`)

In the existing web app, calls were hardcoded to `/api/platzi/...` or `/api/proxy?url=...`.
`platziClient` provides a clean drop-in abstraction:
- When running as an extension (`typeof chrome !== 'undefined' && chrome?.runtime?.id`):
  - Fetches directly from `https://platzi.com/...` with `credentials: 'include'` and optional explicit headers.
  - Fetches VTTs directly from `vttUrl` (Platzi static CDN).
- When running in local dev server (`import.meta.env.DEV` without extension API):
  - Falls back gracefully to `/api/platzi` and `/api/proxy`.

### 5. Automatic Session Hook (`src/hooks/useExtensionAuth.js`)

- Checks if running inside the Chrome Extension context.
- Requests cookies from `src/background.js`.
- If `sessionid` is present:
  - Automatically updates `authStore` with the cookie.
  - Marks session status as verified/auto-detected.
- If no cookie is present (user not logged in to Platzi):
  - Displays a clear hint: *"Inicia sesión en platzi.com y recarga"* or allows manual paste as fallback.

### 6. Build & Packaging Workflow

- Output directory: `dist/`.
- Paths must be relative: `base: './'` in `vite.config.js`.
- The `dist/` directory can be loaded directly into any Chromium browser via:
  1. `chrome://extensions`
  2. Toggle **Developer mode** (top right).
  3. Click **Load unpacked** (`Cargar descomprimida`).
  4. Select the `dist/` folder.
