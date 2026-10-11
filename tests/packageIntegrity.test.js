import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import process from 'node:process';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';

const execFileAsync = promisify(execFile);

test('package check rejects a distribution containing test-only authorization markers', async () => {
  const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upse-package-fixture-'));
  const manifest = {
    manifest_version: 3,
    name: 'fixture',
    version: '1.0.10',
    background: { service_worker: 'background.js' },
    permissions: [],
    host_permissions: ['https://api.platzi.com/*', 'https://platzi.com/*', 'https://static.platzi.com/*', 'https://www.platzi.com/*'],
  };
  await fs.writeFile(path.join(fixtureDir, 'manifest.json'), JSON.stringify(manifest));
  await fs.writeFile(path.join(fixtureDir, 'app.js'), 'const AUTH_SIMULATED_TEST_ONLY = true;');
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(manifest));
  zip.file('app.js', 'const AUTH_SIMULATED_TEST_ONLY = true;');
  zip.file('LICENSE', 'MIT');
  zip.file('THIRD_PARTY_NOTICES.md', 'notices');
  const zipBytes = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(path.join(fixtureDir, 'upse-extension.zip'), zipBytes);
  const digest = createHash('sha256').update(zipBytes).digest('hex');
  await fs.writeFile(path.join(fixtureDir, 'upse-extension.zip.sha256'), `${digest}  upse-extension.zip\n`);
  await assert.rejects(
    execFileAsync(process.execPath, ['scripts/check-extension-package.mjs', fixtureDir], {
      cwd: process.cwd(),
    }),
      error => /test-only authorization|AUTH_SIMULATED_TEST_ONLY/i.test(`${error.stdout}\n${error.stderr}`),
  );
});

test('release version check accepts only matching experimental tags', async () => {
  const result = await execFileAsync(process.execPath, ['scripts/check-release-version.mjs', 'v1.0.10-experimental.1'], { cwd: process.cwd() });
  assert.match(result.stdout, /Release version check passed/);
  await assert.rejects(
    execFileAsync(process.execPath, ['scripts/check-release-version.mjs', 'v1.0.9-experimental.1'], { cwd: process.cwd() }),
  );
});

test('package check rejects a distribution symlink that escapes dist', async t => {
  const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upse-package-symlink-'));
  const outside = path.join(os.tmpdir(), `upse-package-outside-${Date.now()}.js`);
  await fs.writeFile(outside, 'outside fixture');
  const manifest = {
    manifest_version: 3,
    name: 'fixture',
    version: '1.0.10',
    background: { service_worker: 'background.js' },
    permissions: [],
    host_permissions: ['https://api.platzi.com/*', 'https://platzi.com/*', 'https://static.platzi.com/*', 'https://www.platzi.com/*'],
  };
  await fs.writeFile(path.join(fixtureDir, 'manifest.json'), JSON.stringify(manifest));
  try {
    await fs.symlink(outside, path.join(fixtureDir, 'background.js'));
  } catch (error) {
    await fs.rm(outside, { force: true });
    if (error.code === 'EPERM' || error.code === 'EACCES') {
      t.skip(`filesystem does not permit symlink creation: ${error.code}`);
      return;
    }
    throw error;
  }
  await assert.rejects(
    execFileAsync(process.execPath, ['scripts/check-extension-package.mjs', fixtureDir], { cwd: process.cwd() }),
    error => /symbolic link|outside dist/i.test(`${error.stdout}\n${error.stderr}`),
  );
  await fs.rm(outside, { force: true });
  await fs.rm(fixtureDir, { recursive: true, force: true });
});

test('package check rejects a ZIP whose recorded checksum is stale', async () => {
  const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upse-package-checksum-'));
  const manifest = {
    manifest_version: 3,
    name: 'fixture',
    version: '1.0.10',
    background: { service_worker: 'background.js' },
    permissions: [],
    host_permissions: ['https://api.platzi.com/*', 'https://platzi.com/*', 'https://static.platzi.com/*', 'https://www.platzi.com/*'],
  };
  await fs.writeFile(path.join(fixtureDir, 'manifest.json'), JSON.stringify(manifest));
  await fs.writeFile(path.join(fixtureDir, 'background.js'), '');
  const zipPath = path.join(fixtureDir, 'upse-extension.zip');
  await fs.writeFile(zipPath, 'tampered');
  await fs.writeFile(`${zipPath}.sha256`, `0000000000000000000000000000000000000000000000000000000000000000  upse-extension.zip\n`);
  await assert.rejects(
    execFileAsync(process.execPath, ['scripts/check-extension-package.mjs', fixtureDir], { cwd: process.cwd() }),
    error => /checksum/i.test(`${error.stdout}\n${error.stderr}`),
  );
  await fs.rm(fixtureDir, { recursive: true, force: true });
});

test('production entry points do not import or expose the simulated authorization harness', async () => {
  const productionFiles = ['src/main.jsx', 'src/App.jsx', 'src/background.js'];
  const forbidden = /AUTH_SIMULATED_TEST_ONLY|mockAuthorization|testAuthorization|UPSE_TEST_GRANT|browser-export-harness|tests\/harness/;
  for (const relative of productionFiles) {
    const source = await fs.readFile(path.join(process.cwd(), relative), 'utf8');
    assert.doesNotMatch(source, forbidden, relative);
  }
});
