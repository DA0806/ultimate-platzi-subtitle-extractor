# Browser Extension Manifest V3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Package the Ultimate Platzi Subtitle Extractor as a Chromium Manifest V3 browser extension with direct proxy-free network requests and automatic Platzi session cookie detection.

**Architecture:** Use a background service worker to handle toolbar action clicks (opening a full-tab workspace) and provide cookie querying via the `chrome.cookies` API. Introduce a network client adapter (`platziClient.js`) that uses direct cross-origin fetches in the extension (granted by `host_permissions`) while retaining fallback support for dev proxies. Keep the React 19 + Tailwind Signal Console UI 100% intact.

**Tech Stack:** React 19, Vite 8, Tailwind CSS 3, Chrome Extension Manifest V3, Webpack/Vite relative bundling, Lucide React, Zustand.

---

### Task 1: Initialize Worktree Environment & Dependencies

**Files:**
- Worktree root: `worktrees/browser-extension/package.json`
- Worktree root: `worktrees/browser-extension/vite.config.js`

**Step 1: Install dependencies in the worktree directory**

Run:
```bash
cd "D:/Proyectos/Visual Studio Projects/ultimate-platzi-subtitle-extractor/worktrees/browser-extension"
npm install
```
Expected: `node_modules` is installed and ready with 0 critical errors.

**Step 2: Verify baseline build in worktree**

Run:
```bash
npm run build
```
Expected: Exits with code 0; `dist/` is generated.

**Step 3: Commit worktree initialization**

```bash
git add package-lock.json
git commit -m "chore: initialize dependencies in browser extension worktree"
```

---

### Task 2: Create Extension Manifest & Icon Assets

**Files:**
- Create: `worktrees/browser-extension/public/manifest.json`
- Create: `worktrees/browser-extension/public/icons/icon-16.png`
- Create: `worktrees/browser-extension/public/icons/icon-48.png`
- Create: `worktrees/browser-extension/public/icons/icon-128.png`
- Create: `worktrees/browser-extension/src/background.js`

**Step 1: Create `public/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Ultimate Platzi Subtitle Extractor",
  "version": "1.0.0",
  "description": "Extrae y descarga subtítulos de cursos y clases de Platzi.",
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

**Step 2: Generate PNG icons from existing SVG assets**

Create a node script or use `canvas`/`sharp`/PowerShell to convert `public/favicon.svg` into standard 16x16, 48x48, and 128x128 PNG icons under `public/icons/`.

**Step 3: Implement `src/background.js`**

```javascript
// Background service worker for MV3 extension

// 1. Open extractor in a full-size tab when toolbar icon is clicked
chrome.action.onClicked.addListener(async () => {
  const extensionUrl = chrome.runtime.getURL('index.html');
  const tabs = await chrome.tabs.query({ url: `${extensionUrl}*` });
  
  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: extensionUrl });
  }
});

// 2. Cookie reader message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PLATZI_COOKIES') {
    chrome.cookies.getAll({ domain: 'platzi.com' }, (cookies) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }

      const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      const sessionCookie = cookies.find(c => c.name === 'sessionid');
      const csrfCookie = cookies.find(c => c.name === 'csrftoken');

      sendResponse({
        cookieHeader,
        hasSession: Boolean(sessionCookie),
        sessionId: sessionCookie ? sessionCookie.value : null,
        csrfToken: csrfCookie ? csrfCookie.value : null,
      });
    });
    return true; // Keep channel open for async response
  }
});
```

**Step 4: Commit manifest and background worker**

```bash
git add public/manifest.json public/icons/ src/background.js
git commit -m "feat: add extension manifest v3 and background service worker"
```

---

### Task 3: Build Unified Network Client Adapter (`platziClient.js`)

**Files:**
- Create: `worktrees/browser-extension/src/utils/platziClient.js`
- Modify: `worktrees/browser-extension/src/utils/courseParser.js`
- Modify: `worktrees/browser-extension/src/hooks/useSubtitleExtractor.js`

**Step 1: Create `src/utils/platziClient.js`**

Implement direct `fetch` using `host_permissions` in extension mode, with automatic cookie inclusion, and fallback to `/api/platzi` and `/api/proxy` in dev mode:

```javascript
const isExtensionContext = () => (
  typeof chrome !== 'undefined' && Boolean(chrome?.runtime?.id)
);

export const fetchPlatziHtml = async (pathOrUrl, sessionCookie = null) => {
  const isExt = isExtensionContext();
  let targetUrl;

  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    targetUrl = isExt ? pathOrUrl : `/api/platzi${new URL(pathOrUrl).pathname}`;
  } else {
    const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    targetUrl = isExt ? `https://platzi.com${cleanPath}` : `/api/platzi${cleanPath}`;
  }

  const headers = {
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  if (sessionCookie) {
    if (isExt) {
      headers['Cookie'] = sessionCookie;
    } else {
      headers['x-platzi-cookie'] = sessionCookie;
    }
  }

  const response = await fetch(targetUrl, {
    method: 'GET',
    headers,
    credentials: isExt ? 'include' : 'same-origin',
  });

  if (!response.ok) {
    const error = new Error(`Error al consultar Platzi: ${response.status} ${response.statusText}`);
    error.status = response.status;
    throw error;
  }

  return response.text();
};

export const fetchVttContent = async (vttUrl, referer = null, sessionCookie = null) => {
  const isExt = isExtensionContext();
  let targetUrl = vttUrl;
  const headers = {};

  if (!isExt) {
    targetUrl = `/api/proxy?url=${encodeURIComponent(vttUrl)}`;
    if (referer) headers['x-proxy-referer'] = referer;
    if (sessionCookie) headers['x-platzi-cookie'] = sessionCookie;
  } else {
    if (referer) headers['Referer'] = referer;
    if (sessionCookie) headers['Cookie'] = sessionCookie;
  }

  const response = await fetch(targetUrl, {
    method: 'GET',
    headers,
    credentials: isExt ? 'include' : 'same-origin',
  });

  if (!response.ok) {
    const error = new Error(`Error al descargar VTT: ${response.status} ${response.statusText}`);
    error.status = response.status;
    throw error;
  }

  return response.text();
};
```

**Step 2: Update `courseParser.js` to use `fetchPlatziHtml`**

Replace the Axios proxy call in `parsePlatziUrl` with `fetchPlatziHtml(url, sessionCookie)`.

**Step 3: Update `useSubtitleExtractor.js` to use `fetchPlatziHtml` and `fetchVttContent`**

Replace the Axios proxy calls in `worker` with `fetchPlatziHtml(video.url, sessionCookie)` and `fetchVttContent(vttUrl, video.url, sessionCookie)`.

**Step 4: Run linter and tests**

```bash
npm run lint
```
Expected: 0 lint errors.

**Step 5: Commit network adapter changes**

```bash
git add src/utils/platziClient.js src/utils/courseParser.js src/hooks/useSubtitleExtractor.js
git commit -m "feat: add unified platziClient adapter with direct extension fetch"
```

---

### Task 4: Implement Automatic Session Hook & Update UI Indicators

**Files:**
- Create: `worktrees/browser-extension/src/hooks/useExtensionAuth.js`
- Modify: `worktrees/browser-extension/src/components/SessionBadge.jsx`
- Modify: `worktrees/browser-extension/src/components/SetupWizard.jsx`
- Modify: `worktrees/browser-extension/src/App.jsx`

**Step 1: Create `src/hooks/useExtensionAuth.js`**

```javascript
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';

export const useExtensionAuth = () => {
  const [isAutoDetected, setIsAutoDetected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const setCookie = useAuthStore(state => state.login);
  const currentCookie = useAuthStore(state => state.cookie);

  const checkExtensionSession = () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      return;
    }

    setIsChecking(true);
    chrome.runtime.sendMessage({ type: 'GET_PLATZI_COOKIES' }, (response) => {
      setIsChecking(false);
      if (response && response.hasSession && response.cookieHeader) {
        setCookie('ext_token', response.cookieHeader, {
          name: 'Usuario Platzi',
          email: 'Sesión activa',
        });
        setIsAutoDetected(true);
      }
    });
  };

  useEffect(() => {
    checkExtensionSession();
  }, []);

  return { isAutoDetected, isChecking, refreshSession: checkExtensionSession };
};
```

**Step 2: Update `SessionBadge.jsx` and `SetupWizard.jsx`**

- In `SessionBadge.jsx`: When running in extension mode and session is detected, show a badge: "Sesión Platzi activa (automática)" with a refresh button.
- In `SetupWizard.jsx`: Step 2 detects if running in extension; if cookie is already found automatically, mark the step as completed with a green check and message: *"Tu sesión de Platzi fue detectada automáticamente. No necesitas copiar la cookie."*

**Step 3: Wire into `App.jsx`**

Import and invoke `useExtensionAuth()` in `App.jsx` so session detection happens when the workspace tab opens.

**Step 4: Commit auth auto-detection**

```bash
git add src/hooks/useExtensionAuth.js src/components/SessionBadge.jsx src/components/SetupWizard.jsx src/App.jsx
git commit -m "feat: auto-detect platzi session cookies in extension mode"
```

---

### Task 5: Configure Extension Build Bundling in `vite.config.js`

**Files:**
- Modify: `worktrees/browser-extension/vite.config.js`

**Step 1: Update `vite.config.js`**

Configure Vite to:
1. Use `base: './'` (relative paths for extension assets).
2. Bundle `src/background.js` as an entry point along with `index.html`.
3. Output clean filenames so `manifest.json` can reference `background.js`.

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'src/background.js'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background.js';
          }
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
});
```

**Step 2: Run production build**

```bash
npm run build
```
Expected:
- `dist/index.html` exists.
- `dist/manifest.json` exists.
- `dist/background.js` exists.
- `dist/icons/` exists.
- `dist/assets/` contains CSS and React JS chunks with relative paths.

**Step 3: Commit build configuration**

```bash
git add vite.config.js
git commit -m "chore: configure vite for browser extension bundling"
```

---

### Task 6: Manual Testing & Verification Instructions

**Files:**
- Create: `worktrees/browser-extension/docs/EXTENSION_GUIDE.md`

**Step 1: Write `EXTENSION_GUIDE.md`**

Provide clear, friendly instructions for the user and their friends:
1. How to load unpacked in Chrome / Brave / Edge (`chrome://extensions` > "Developer mode" > "Load unpacked" > select `dist/`).
2. How to pin the extension icon in the toolbar.
3. How to verify automatic session detection.
4. How to extract a course and download ZIP/TXT files.

**Step 2: Commit testing guide**

```bash
git add docs/EXTENSION_GUIDE.md
git commit -m "docs: add browser extension installation and testing guide"
```
