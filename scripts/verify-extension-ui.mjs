import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const extensionPath = path.resolve('dist');
const browserCandidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
const browserPath = browserCandidates.find(candidate => fs.existsSync(candidate));

if (!browserPath) {
  throw new Error(`No supported Chromium executable found. Checked: ${browserCandidates.join(', ')}`);
}

const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), 'upse-extension-ui-'));
const artifactPath = path.join(os.tmpdir(), 'upse-extension-ui-artifacts');
fs.rmSync(artifactPath, { recursive: true, force: true });
fs.mkdirSync(artifactPath, { recursive: true });
const consoleErrors = [];
let context;

try {
  context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    executablePath: browserPath,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 10000 });
  const extensionUrl = worker.url().replace(/\/background\.js$/i, '');
  const page = await context.newPage();
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(`console:${message.text()}`);
  });
  page.on('pageerror', error => consoleErrors.push(`pageerror:${error.message}`));

  await page.goto(`${extensionUrl}/index.html#setup?step=3&context=setup`);
  await page.waitForTimeout(500);
  const continueButton = page.getByRole('button', { name: /Continuar al espacio de trabajo|Entrar al espacio de trabajo|Finalizar/i }).first();
  if (await continueButton.count()) await continueButton.click();
  await page.waitForTimeout(350);

  const settingsButton = page.getByRole('button', { name: /Abrir ajustes|Open settings/i });
  await settingsButton.click();
  const dialog = page.locator('#settings-dialog');
  await dialog.waitFor({ state: 'visible' });
  const headerButtonCount = await page.locator('header button').count();
  const dialogControls = page.locator('#settings-dialog button[aria-label]');
  const dialogAriaLabelsBefore = await dialogControls.evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')));
  const themeIndex = dialogAriaLabelsBefore.findIndex(label => /Cambiar tema|Change theme/i.test(label || ''));
  const languageIndex = dialogAriaLabelsBefore.findIndex(label => /Idioma de interfaz|Interface language/i.test(label || ''));
  const dialogThemeControl = themeIndex >= 0 ? dialogControls.nth(themeIndex) : null;
  const bodyLocked = await page.evaluate(() => document.body.style.overflow === 'hidden');
  const themeBefore = await page.evaluate(() => document.documentElement.className);
  if (dialogThemeControl) await dialogThemeControl.click();
  const themeAfter = await page.evaluate(() => document.documentElement.className);
  const languageControl = languageIndex >= 0 ? dialogControls.nth(languageIndex) : null;
  if (languageControl) {
    await languageControl.click();
    await page.getByRole('option', { name: /English|Inglés/i }).click();
  }
  const persistedSettings = await page.evaluate(() => JSON.parse(localStorage.getItem('platzi_settings') || '{}').state || {});

  await page.evaluate(() => {
    const fixture = document.createElement('div');
    fixture.dataset.uiFixture = 'progress';
    fixture.className = 'fixed inset-x-0 bottom-0 z-50 px-3 pb-3';
    fixture.innerHTML = '<div data-ui-fixture-surface class="mx-auto h-28 max-w-6xl rounded-xl border bg-card p-4">Synthetic progress fixture</div>';
    document.body.append(fixture);
  });

  const hitTest = await page.evaluate(() => {
    const surface = document.querySelector('[data-ui-fixture-surface]');
    const modal = document.querySelector('#settings-dialog');
    const surfaceRect = surface.getBoundingClientRect();
    const modalRect = modal.getBoundingClientRect();
    const left = Math.max(surfaceRect.left, modalRect.left);
    const right = Math.min(surfaceRect.right, modalRect.right);
    const top = Math.max(surfaceRect.top, modalRect.top);
    const bottom = Math.min(surfaceRect.bottom, modalRect.bottom);
    const x = left + Math.max(1, (right - left) / 2);
    const y = top + Math.max(1, (bottom - top) / 2);
    const elements = document.elementsFromPoint(x, y);
    const order = elements.slice(0, 8).map(element => element.dataset.uiFixture || element.id || element.tagName.toLowerCase());
    const modalIndex = order.indexOf('settings-dialog');
    const progressIndex = order.indexOf('progress');
    return {
      point: { x, y },
      overlap: right > left && bottom > top,
      order,
      hasModal: modalIndex >= 0,
      hasProgress: progressIndex >= 0,
      modalAboveProgress: modalIndex >= 0 && progressIndex >= 0 && modalIndex < progressIndex,
    };
  });

  const desktopScreenshot = path.join(artifactPath, 'settings-desktop.png');
  await page.screenshot({ path: desktopScreenshot });
  await page.setViewportSize({ width: 980, height: 760 });
  await page.waitForTimeout(250);
  const narrowDialogVisible = await dialog.isVisible();
  await dialog.focus();
  await page.keyboard.press('Tab');
  const tabInside = await page.evaluate(() => Boolean(document.activeElement?.closest('#settings-dialog')));
  await page.keyboard.press('Shift+Tab');
  const shiftTabInside = await page.evaluate(() => Boolean(document.activeElement?.closest('#settings-dialog')));
  const narrowScreenshot = path.join(artifactPath, 'settings-desktop-narrow.png');
  await page.screenshot({ path: narrowScreenshot });

  const focused = await page.evaluate(() => document.activeElement?.closest('#settings-dialog')?.id === 'settings-dialog');
  await page.keyboard.press('Escape');
  const closedByEscape = !(await dialog.isVisible());
  const focusRestored = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Abrir ajustes' || document.activeElement?.getAttribute('aria-label') === 'Open settings');
  const output = {
    browserPath,
    extensionUrl,
    title: await page.title(),
    headerButtonCount,
    dialogThemeControl: themeIndex >= 0 ? 1 : 0,
    dialogLanguageControl: languageIndex >= 0 ? 1 : 0,
    dialogAriaLabels: dialogAriaLabelsBefore,
    bodyLocked,
    themeChanged: themeBefore !== themeAfter,
    settingsPersisted: persistedSettings.theme === (themeAfter.includes('light') ? 'light' : 'dark') && persistedSettings.uiLanguage === 'en',
    hitTest,
    focused,
    closedByEscape,
    focusRestored,
    consoleErrors,
    narrowDialogVisible,
    tabInside,
    shiftTabInside,
    screenshots: [desktopScreenshot, narrowScreenshot],
  };
  console.log(JSON.stringify(output));
  if (output.title !== 'UPSE Extractor' || output.headerButtonCount !== 1 || output.dialogThemeControl !== 1 || output.dialogLanguageControl !== 1 || !output.bodyLocked || !output.themeChanged || !output.settingsPersisted || !hitTest.overlap || !hitTest.hasModal || !hitTest.hasProgress || !hitTest.modalAboveProgress || !focused || !closedByEscape || !focusRestored || !narrowDialogVisible || !tabInside || !shiftTabInside || consoleErrors.length) {
    process.exitCode = 1;
  }
} finally {
  if (context) await context.close();
  await fs.promises.rm(profilePath, { recursive: true, force: true });
}
