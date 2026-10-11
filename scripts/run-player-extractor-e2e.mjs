import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import JSZip from 'jszip';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = path.join(root, 'tests', 'player-browser-e2e');
const distDir = path.join(root, 'dist');
const executablePath = process.env.UPSE_BROWSER_EXECUTABLE || chromium.executablePath();
const tempRoot = path.resolve(os.tmpdir());
const outputDir = await fs.mkdtemp(path.join(tempRoot, 'upse-player-browser-e2e-'));
const profileDir = await fs.mkdtemp(path.join(tempRoot, 'upse-player-browser-profile-'));
const reportPath = path.join(outputDir, 'report.json');
const results = [];
const nativeTrackSummary = [];
let stage = 'initializing';
const rootRealPath = path.resolve(root);
const fixtureOrigin = 'http://127.0.0.1:<fixture-port>';
const isWithinTemp = candidate => {
  const resolved = path.resolve(candidate);
  return resolved.startsWith(`${tempRoot}${path.sep}`) && resolved !== tempRoot;
};
assert.equal(isWithinTemp(outputDir), true);
assert.equal(isWithinTemp(profileDir), true);

const sanitize = value => String(value?.message || value || 'unknown error')
  .replaceAll(rootRealPath, '<project>')
  .replaceAll(outputDir, '<temporary-output>')
  .replaceAll(profileDir, '<temporary-profile>')
  .replace(/https?:\/\/127\.0\.0\.1:\d+/g, '<owned-loopback>');

const record = (name, detail = {}) => results.push({ name, status: 'passed', ...detail });

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
};

const startFixtureServer = () => new Promise((resolve, reject) => {
  const server = http.createServer(async (request, response) => {
    try {
      const requestPath = new URL(request.url || '/', 'http://127.0.0.1').pathname;
      const relative = requestPath.replace(/^\/+/, '');
      const target = path.resolve(fixtureRoot, relative);
      if (!target.startsWith(`${path.resolve(fixtureRoot)}${path.sep}`)) {
        response.writeHead(404).end();
        return;
      }
      const stat = await fs.stat(target);
      if (!stat.isFile()) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, {
        'Content-Type': mimeTypes[path.extname(target)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(await fs.readFile(target));
    } catch {
      response.writeHead(404).end();
    }
  });
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    resolve({ server, port: typeof address === 'object' && address ? address.port : 0 });
  });
});

const runBuild = () => new Promise((resolve, reject) => {
  const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm.cmd run build:extension']
    : ['run', 'build:extension'];
  const child = spawn(command, args, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stderr = '';
  child.stdout.resume();
  child.stderr.on('data', chunk => { stderr += String(chunk); });
  child.once('error', reject);
  child.once('exit', code => code === 0 ? resolve() : reject(new Error(`production extension build failed (${code}): ${sanitize(stderr)}`)));
});

const assertProductionManifest = async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(distDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'scripting']);
  assert.deepEqual([...manifest.host_permissions].sort(), [
    'https://api.platzi.com/*',
    'https://platzi.com/*',
    'https://static.platzi.com/*',
    'https://www.platzi.com/*',
  ].sort());
  assert.equal(manifest.background?.service_worker, 'background.js');
  record('production dist manifest uses the exact release permission boundary', {
    permissions: manifest.permissions,
    hostPermissions: manifest.host_permissions,
  });
};

const waitForDownload = async (page, action) => {
  const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
  await action();
  const download = await downloadPromise;
  assert.equal(await download.failure(), null);
  const filename = download.suggestedFilename();
  const target = path.join(outputDir, `${String(results.length).padStart(2, '0')}-${filename}`);
  await download.saveAs(target);
  const bytes = await fs.readFile(target);
  return {
    filename,
    bytes,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
};

const completeSetup = async page => {
  const playerSection = page.locator('section[aria-label="Pistas del reproductor"]');
  if (await playerSection.count()) return;
  for (let step = 0; step < 4; step += 1) {
    const next = page.locator('main button').last();
    await next.click();
    await page.waitForTimeout(150);
    if (await playerSection.count()) return;
  }
  throw new Error('production setup did not reach the player source panel');
};

const assertNativeTracks = async fixturePage => {
  const native = await fixturePage.evaluate(() => {
    const video = document.querySelector('video');
    const tracks = Array.from(video?.textTracks || []);
    return tracks.map(track => ({
      language: track.language,
      label: track.label,
      mode: track.mode,
      cueCount: track.cues?.length || 0,
    }));
  });
  assert.equal(native.length, 2);
  assert.deepEqual(native.map(track => track.language), ['es', 'en']);
  assert.ok(native.every(track => track.cueCount === 4));
  assert.ok(native.every(track => track.mode !== 'disabled'));
  if (nativeTrackSummary.length === 0) nativeTrackSummary.push(...native);
  record('native TextTrack cues loaded from owned VTT fixtures', { tracks: native });
};

const detectAndExtract = async (appPage, fixturePage) => {
  await fixturePage.bringToFront();
  await fixturePage.waitForFunction(() => {
    const tracks = Array.from(document.querySelector('video')?.textTracks || []);
    return tracks.length === 2 && tracks.every(track => track.cues?.length === 4 && track.mode !== 'disabled');
  }, null, { timeout: 10_000 });
  await assertNativeTracks(fixturePage);
  await appPage.bringToFront();
  const section = appPage.locator('section[aria-label="Pistas del reproductor"]');
  await section.getByRole('button', { name: 'Detectar pistas', exact: true }).click();
  await appPage.getByText(/2 pista\(s\) detectada/).waitFor({ state: 'visible', timeout: 10_000 });
  assert.equal(await appPage.getByText('No hay pistas textTracks cargadas.').count(), 0);
  assert.equal(await appPage.getByRole('alert').count(), 0);
  const sectionText = await section.innerText();
  assert.match(sectionText, /Español/);
  assert.match(sectionText, /English/);
  const rights = section.getByRole('checkbox', { name: /Confirmo que tengo derecho/ });
  assert.equal(await rights.isChecked(), false);
  await rights.check();
  const spanishRow = section.locator('div.rounded-md.border').filter({ hasText: 'Español' }).last();
  const englishRow = section.locator('div.rounded-md.border').filter({ hasText: 'English' }).last();
  assert.equal(await spanishRow.count(), 1);
  assert.equal(await englishRow.count(), 1);
  await spanishRow.getByRole('button', { name: 'Extraer', exact: true }).click();
  await spanishRow.getByRole('button', { name: 'Extraída', exact: true }).waitFor({ state: 'visible' });
  await englishRow.getByRole('button', { name: 'Extraer', exact: true }).click();
  try {
    await englishRow.getByRole('button', { name: 'Extraída', exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
  } catch (error) {
    throw new Error(`second player track extraction failed: ${await section.innerText()} (${sanitize(error)})`);
  }
  assert.equal(await appPage.getByRole('alert').count(), 0);
  record('production UI extracted both native tracks after explicit rights confirmation', { languages: ['es', 'en'] });
};

const exportValidArtifacts = async (appPage, fixturePage) => {
  const individualButtons = appPage.locator('button[aria-label^="Descargar TXT de"]');
  assert.equal(await individualButtons.count(), 2);
  stage = 'exporting-individual-es-txt';
  const first = await waitForDownload(appPage, () => individualButtons.nth(0).click());
  assert.match(first.filename, /\.txt$/);
  const firstText = first.bytes.toString('utf8');
  assert.match(firstText, /¡Hola, mundo! — línea UTF-8/);
  assert.equal((firstText.match(/Repite/g) || []).length, 2);
  record('individual TXT export preserves Unicode, order, repeated text, and removes exact duplicates', {
    filenameSha256: first.sha256,
    bytes: first.bytes.byteLength,
  });

  stage = 'exporting-individual-en-txt';
  const second = await waitForDownload(appPage, () => individualButtons.nth(1).click());
  const secondText = second.bytes.toString('utf8');
  assert.match(secondText, /Hello, world! — UTF-8 line/);
  assert.equal((secondText.match(/Repeat/g) || []).length, 2);
  record('second language individual TXT export is readable from the native player track', {
    filenameSha256: second.sha256,
    bytes: second.bytes.byteLength,
  });

  stage = 'exporting-combined-txt';
  const combined = await waitForDownload(appPage, () => appPage.getByRole('button', { name: 'Descargar TXT', exact: true }).click());
  const combinedText = combined.bytes.toString('utf8');
  assert.ok(combinedText.indexOf('¡Hola, mundo! — línea UTF-8') < combinedText.indexOf('Hello, world! — UTF-8 line'));
  assert.equal((combinedText.match(/Repite/g) || []).length, 2);
  assert.equal((combinedText.match(/Repeat/g) || []).length, 2);
  record('combined TXT export preserves both language sections', { filenameSha256: combined.sha256, bytes: combined.bytes.byteLength });

  stage = 'exporting-zip';
  const zip = await waitForDownload(appPage, () => appPage.getByRole('button', { name: 'Descargar ZIP', exact: true }).click());
  const archive = await JSZip.loadAsync(zip.bytes);
  const entries = Object.keys(archive.files).filter(name => !archive.files[name].dir);
  assert.equal(entries.length, 1);
  const zipText = await archive.files[entries[0]].async('string');
  assert.match(zipText, /¡Hola, mundo! — línea UTF-8/);
  record('ZIP export contains the selected-language TXT with UTF-8 content', {
    filenameSha256: zip.sha256,
    bytes: zip.bytes.byteLength,
    entries: entries.map(() => '<zip-entry>.txt'),
  });

  stage = 'reading-extension-clipboard';
  await appPage.getByRole('button', { name: 'Copiar TXT', exact: true }).click();
  await appPage.getByRole('button', { name: 'Copiado', exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
  await fixturePage.bringToFront();
  const clipboard = await fixturePage.evaluate(() => Promise.race([
    navigator.clipboard.readText(),
    new Promise((_, reject) => window.setTimeout(() => reject(new Error('clipboard read timed out')), 5_000)),
  ]));
  assert.ok(clipboard.includes('¡Hola, mundo! — línea UTF-8'));
  assert.ok(clipboard.includes('Hello, world! — UTF-8 line'));
  record('clipboard read verifies the extension wrote the combined TXT', {
    sha256: createHash('sha256').update(clipboard, 'utf8').digest('hex'),
    characters: clipboard.length,
  });
};

const assertStaleExportDenied = async (appPage, fixturePage, mutate, label) => {
  await fixturePage.bringToFront();
  await mutate();
  await appPage.bringToFront();
  const button = appPage.locator('button[aria-label^="Descargar TXT de"]').first();
  let downloaded = false;
  const onDownload = () => { downloaded = true; };
  appPage.on('download', onDownload);
  await button.click();
  await appPage.getByRole('alert').waitFor({ state: 'visible', timeout: 10_000 });
  await appPage.waitForTimeout(350);
  appPage.off('download', onDownload);
  assert.equal(downloaded, false);
  record(label, { downloads: 0 });
};

const publicReport = (status, browser, fixturePort, error = null) => ({
  status,
  authorization: {
    mode: 'local_user_rights_declaration',
    provider: 'user_authorized_player',
    fixture: 'original_owned_loopback_vtt',
  },
  browser: {
    executable: process.env.UPSE_BROWSER_EXECUTABLE ? 'configured Chromium executable' : 'Playwright bundled Chromium',
    version: browser?.version?.() || 'unknown',
  },
  fixture: { origin: fixtureOrigin.replace('<fixture-port>', String(fixturePort)), nativeTrackCount: nativeTrackSummary.length ? 2 : 0, nativeTracks: nativeTrackSummary },
  results,
  error: error ? sanitize(error) : undefined,
});

let fixture;
let context;
try {
  stage = 'building-production-dist';
  await fs.access(executablePath);
  await runBuild();
  await assertProductionManifest();
  stage = 'starting-owned-loopback-fixture';
  fixture = await startFixtureServer();
  const fixtureUrl = `http://127.0.0.1:${fixture.port}/index.html`;
  const profileReal = await fs.realpath(profileDir);
  assert.equal(isWithinTemp(profileReal), true);
  stage = 'launching-chrome-for-testing-with-extension';
  context = await chromium.launchPersistentContext(profileDir, {
    executablePath,
    headless: false,
    acceptDownloads: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${distDir}`,
      `--load-extension=${distDir}`,
      '--enable-unsafe-extension-debugging',
    ],
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 10_000 });
  const extensionUrl = worker.url().replace(/\/background\.js$/, '');
  const extensionId = new URL(worker.url()).hostname;
  stage = 'loading-owned-native-player-fixture';
  const fixturePage = await context.newPage();
  await fixturePage.goto(fixtureUrl, { waitUntil: 'domcontentloaded' });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(fixtureUrl).origin });
  await fixturePage.waitForFunction(() => document.querySelector('video')?.textTracks?.length === 2, null, { timeout: 10_000 });

  stage = 'triggering-real-extension-action-via-cdp';
  const browserCdp = await context.browser().newBrowserCDPSession();
  let actionError = null;
  try {
    const { targetInfos } = await browserCdp.send('Target.getTargets', { filter: [{}] });
    const tabTarget = targetInfos.find(target => target.type === 'tab' && target.url === fixtureUrl);
    if (!tabTarget) throw new Error(`no tab target for owned fixture (${targetInfos.map(target => `${target.type}:${target.url}`).join('|')})`);
    await browserCdp.send('Extensions.triggerAction', { id: extensionId, targetId: tabTarget.targetId });
  } catch (error) {
    actionError = new Error(`Extensions.triggerAction unsupported or failed: ${sanitize(error)}`);
  }
  if (actionError) throw actionError;
  stage = 'opening-production-extension-ui';
  const appPage = context.pages().find(page => page.url().startsWith(extensionUrl))
    || await context.waitForEvent('page', { timeout: 10_000 });
  await appPage.waitForLoadState('domcontentloaded');
  try {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: extensionUrl });
  } catch {
    // Chrome extension pages can expose clipboard without a grant; the read below remains the proof.
  }
  stage = 'completing-production-setup-ui';
  await completeSetup(appPage);
  stage = 'detecting-and-extracting-native-tracks';
  await detectAndExtract(appPage, fixturePage);
  stage = 'verifying-production-exports';
  await exportValidArtifacts(appPage, fixturePage);

  stage = 'verifying-pathname-stale-denial';
  await assertStaleExportDenied(
    appPage,
    fixturePage,
    () => fixturePage.evaluate(() => history.pushState({}, '', `${location.pathname}-changed`)),
    'pathname change invalidates the old player proof before export',
  );

  await fixturePage.evaluate(() => history.replaceState({}, '', '/index.html'));
  stage = 'refreshing-production-ui-for-video-replacement-check';
  await appPage.reload({ waitUntil: 'domcontentloaded' });
  await completeSetup(appPage);
  await detectAndExtract(appPage, fixturePage);
  stage = 'verifying-same-url-video-replacement-stale-denial';
  await assertStaleExportDenied(
    appPage,
    fixturePage,
    async () => {
      await fixturePage.evaluate(() => window.replaceVideoWithSameUrl());
      await fixturePage.waitForFunction(() => {
        const tracks = Array.from(document.querySelector('video')?.textTracks || []);
        return tracks.length === 2 && tracks.every(track => track.cues?.length === 4 && track.mode !== 'disabled');
      }, null, { timeout: 10_000 });
    },
    'same-URL video replacement invalidates the old player proof before export',
  );

  stage = 'writing-sanitized-pass-report';
  const report = publicReport('passed', context.browser(), fixture.port);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ...report, reportFile: '<temporary-output>/report.json' }, null, 2));
} catch (error) {
  const browser = context?.browser();
  const fixturePort = fixture?.port || 0;
  const report = publicReport('failed', browser, fixturePort, `${stage}: ${sanitize(error)}`);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.error(JSON.stringify({ ...report, reportFile: '<temporary-output>/report.json' }, null, 2));
  process.exitCode = 1;
} finally {
  await context?.close();
  if (fixture?.server) await new Promise(resolve => fixture.server.close(() => resolve()));
  if (isWithinTemp(profileDir)) await fs.rm(profileDir, { recursive: true, force: true });
}
