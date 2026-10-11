import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executableArg = process.argv.find(value => value.startsWith('--executable='));
const executablePath = process.env.UPSE_BROWSER_EXECUTABLE || executableArg?.slice('--executable='.length) || null;
const portArg = process.argv.find(value => value.startsWith('--port='));
const port = Number(process.env.UPSE_EXPORT_HARNESS_PORT || portArg?.slice('--port='.length) || 4178);
const headless = process.env.UPSE_EXPORT_HEADLESS !== 'false' && !process.argv.includes('--headed');
const origin = `http://127.0.0.1:${port}`;
const harnessUrl = `${origin}/tests/browser-export-harness/index.html`;
const serverScript = path.join(root, 'scripts', 'serve-export-harness.mjs');
const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upse-browser-export-e2e-'));
const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upse-browser-export-profile-'));
const reportPath = path.join(outputDir, 'report.json');
const results = [];
const tempRoot = path.resolve(os.tmpdir());

if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Use a TCP port between 1024 and 65535.');
const isWithinTemp = candidate => {
  const resolved = path.resolve(candidate);
  return resolved.startsWith(`${tempRoot}${path.sep}`) && resolved !== tempRoot;
};
assert.equal(isWithinTemp(profileDir), true, 'profile directory must remain inside the temporary root');

const record = (name, detail = {}) => results.push({ name, status: 'passed', ...detail });

const waitForServer = child => new Promise((resolve, reject) => {
  let settled = false;
  const timer = setTimeout(() => finish(new Error('harness server did not start within 15 seconds')), 15_000);
  const finish = (error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    error ? reject(error) : resolve();
  };
  child.stdout.on('data', data => {
    if (String(data).includes('EXPORT_HARNESS_URL=')) finish();
  });
  child.stderr.on('data', data => {
    const message = String(data);
    if (message.toLowerCase().includes('error')) finish(new Error(message));
  });
  child.once('error', finish);
  child.once('exit', code => finish(new Error(`harness server exited before readiness (code ${code ?? 'unknown'})`)));
});

const waitForStatus = async (page, expected) => {
  await page.waitForFunction(value => document.querySelector('#status')?.textContent === value, expected);
};

const saveDownload = async (page, buttonName, expectedPattern) => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: buttonName }).click();
  const download = await downloadPromise;
  assert.equal(await download.failure(), null);
  const filename = download.suggestedFilename();
  assert.match(filename, expectedPattern);
  const target = path.join(outputDir, filename);
  await download.saveAs(target);
  await fs.access(target);
  const bytes = await fs.readFile(target);
  return {
    filename,
    path: target,
    size: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
};

const assertProductionArtifactIsClean = async () => {
  const distDir = path.join(root, 'dist');
  const files = await fs.readdir(distDir, { recursive: true });
  const forbidden = ['AUTH_SIMULATED', 'browser-export-harness', 'UPSE browser harness synthetic'];
  for (const relative of files) {
    const full = path.join(distDir, relative);
    const stat = await fs.stat(full);
    if (!stat.isFile()) continue;
    const content = await fs.readFile(full);
    for (const marker of forbidden) assert.equal(content.includes(Buffer.from(marker)), false, `${marker} leaked into dist/${relative}`);
  }
  record('production dist excludes simulated authorization and harness files', { dist: '<extension-dist>' });
};

const publicResults = () => results.map(result => Object.fromEntries(
  Object.entries(result).filter(([key]) => key !== 'path'),
));
const safeError = error => String(error?.message || error)
  .replaceAll(root, '<project>')
  .replaceAll(outputDir, '<temporary-output>')
  .replaceAll(profileDir, '<temporary-profile>');

let server;
let context;
try {
  server = spawn(process.execPath, [serverScript, `--port=${port}`], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  await waitForServer(server);
  record('loopback harness server started', { url: harnessUrl });

  if (executablePath) await fs.access(executablePath);
  context = await chromium.launchPersistentContext(profileDir, {
    ...(executablePath ? { executablePath } : {}),
    headless,
    acceptDownloads: true,
    downloadsPath: outputDir,
  });
  const browser = context.browser();
  const browserVersion = browser?.version?.() || 'unknown';
  const browserLabel = executablePath ? 'Chrome for Testing (configured executable)' : 'Playwright bundled Chromium (fallback)';
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  const page = await context.newPage();
  await page.goto(harnessUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.startsWith('Ready:'));
  const runId = await page.evaluate(() => globalThis.__UPSE_EXPORT_HARNESS__.runId);
  assert.match(runId, /^harness-\d+$/);
  record('synthetic VTT fixtures parsed by production parser', { marker: 'UPSE browser harness synthetic fixtures' });

  let unexpectedDownload = false;
  const onDownload = () => { unexpectedDownload = true; };
  page.on('download', onDownload);
  await page.evaluate(() => globalThis.__UPSE_EXPORT_HARNESS__.revokeFirstProof());
  await page.getByRole('button', { name: 'Export individual TXT' }).click();
  await waitForStatus(page, 'individual TXT: failed (PROOF_REVOKED)');
  await new Promise(resolve => setTimeout(resolve, 250));
  page.off('download', onDownload);
  assert.equal(unexpectedDownload, false);
  record('revoked simulated proof blocks export without download');

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.startsWith('Ready:'));
  const freshRunId = await page.evaluate(() => globalThis.__UPSE_EXPORT_HARNESS__.runId);
  assert.notEqual(freshRunId, runId);

  const individual = await saveDownload(page, 'Export individual TXT', new RegExp(`^${freshRunId}-clase-01-primera\\.es\\.txt$`));
  const individualText = await fs.readFile(individual.path, 'utf8');
  assert.match(individualText, /Contenido propio uno — áéíóú/);
  assert.doesNotMatch(individualText, /00:00:00\.000/);
  record('individual TXT real browser download', { path: individual.path, filename: individual.filename });

  const merged = await saveDownload(page, 'Export combined TXT', new RegExp(`^${freshRunId}-es\\.txt$`));
  const mergedText = await fs.readFile(merged.path, 'utf8');
  assert.match(mergedText, /Contenido propio uno — áéíóú/);
  assert.match(mergedText, /Contenido propio dos — ñç/);
  record('combined TXT real browser download', { path: merged.path, filename: merged.filename });

  const zip = await saveDownload(page, 'Export ZIP', new RegExp(`^${freshRunId}\\.zip$`));
  const archive = await JSZip.loadAsync(await fs.readFile(zip.path));
  assert.deepEqual(Object.keys(archive.files), ['clase-01-primera.es.txt', 'clase-02-segunda.es.txt']);
  assert.match(await archive.files['clase-01-primera.es.txt'].async('string'), /Contenido propio uno — áéíóú/);
  assert.match(await archive.files['clase-02-segunda.es.txt'].async('string'), /Contenido propio dos — ñç/);
  record('ZIP real browser download with UTF-8 entries', { path: zip.path, filename: zip.filename, entries: Object.keys(archive.files) });

  await page.getByRole('button', { name: 'Copy combined TXT' }).click();
  await waitForStatus(page, 'clipboard: complete');
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(clipboard, /Contenido propio uno — áéíóú/);
  assert.match(clipboard, /Contenido propio dos — ñç/);
  record('clipboard real browser write and read on loopback origin', {
    chars: clipboard.length,
    sha256: createHash('sha256').update(clipboard, 'utf8').digest('hex'),
  });

  await assertProductionArtifactIsClean();
  const report = {
    status: 'passed',
    authMode: 'AUTH_SIMULATED_TEST_ONLY',
    browser: { label: browserLabel, version: browserVersion, headless },
    harnessUrl,
    artifactsDirectory: '<temporary-output>',
    profileDirectory: '<temporary-profile>',
    results: publicResults(),
  };
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ...report, reportFile: path.basename(reportPath) }, null, 2));
} catch (error) {
  const report = {
    status: 'failed',
    authMode: 'AUTH_SIMULATED_TEST_ONLY',
    browser: { label: executablePath ? 'Chrome for Testing (configured executable)' : 'Playwright bundled Chromium (fallback)', headless },
    harnessUrl,
    artifactsDirectory: '<temporary-output>',
    profileDirectory: '<temporary-profile>',
    results: publicResults(),
    error: safeError(error),
  };
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.error(JSON.stringify({ ...report, reportFile: path.basename(reportPath) }, null, 2));
  process.exitCode = 1;
} finally {
  await context?.close();
  if (server && !server.killed) server.kill();
  if (isWithinTemp(profileDir)) await fs.rm(profileDir, { recursive: true, force: true });
}
