import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';

const root = process.cwd();
const dist = path.resolve(process.argv[2] || path.join(root, 'dist'));
const zipPath = path.join(dist, 'upse-extension.zip');
const checksumPath = `${zipPath}.sha256`;
const distStat = await fs.lstat(dist);
if (!distStat.isDirectory() || distStat.isSymbolicLink()) throw new Error('Distribution root must be a real directory');
const distRealPath = await fs.realpath(dist);
const assertInsideDist = async file => {
  const realPath = await fs.realpath(file);
  if (realPath !== distRealPath && !realPath.startsWith(`${distRealPath}${path.sep}`)) {
    throw new Error(`Distribution path resolves outside dist/: ${file}`);
  }
  const stat = await fs.lstat(file);
  if (!stat.isFile()) throw new Error(`Distribution contains a non-regular file: ${file}`);
};
const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
await assertInsideDist(path.join(dist, 'manifest.json'));
const manifest = JSON.parse(await fs.readFile(path.join(dist, 'manifest.json'), 'utf8'));

if (packageJson.version !== manifest.version) {
  throw new Error(`Version mismatch: package.json (${packageJson.version}) !== manifest.json (${manifest.version})`);
}
if (manifest.manifest_version !== 3 || manifest.background?.service_worker !== 'background.js') {
  throw new Error('The release package must be a Manifest V3 extension with the expected service worker');
}
const expectedPermissions = ['activeTab', 'scripting'];
if (JSON.stringify([...(manifest.permissions || [])].sort()) !== JSON.stringify(expectedPermissions.sort())) {
  throw new Error('The extension must request only activeTab and scripting for one-shot player inspection');
}
const expectedHosts = ['https://api.platzi.com/*', 'https://platzi.com/*', 'https://static.platzi.com/*', 'https://www.platzi.com/*'];
if (JSON.stringify([...manifest.host_permissions].sort()) !== JSON.stringify(expectedHosts.sort())) {
  throw new Error('The release package host permissions changed unexpectedly');
}

const forbiddenMarkers = [
  'mockAuthorization',
  'AUTH_SIMULATED_TEST_ONLY',
  'testAuthorization',
  'UPSE_TEST_GRANT',
  'VITE_UPSE_TEST',
  'localhost:4179',
  'tests/harness',
  'export-harness',
  'harness-account',
];
const files = [];
const collect = async directory => {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Distribution contains a symbolic link: ${fullPath}`);
    if (entry.isDirectory()) await collect(fullPath);
    else if (fullPath !== zipPath && fullPath !== checksumPath) {
      await assertInsideDist(fullPath);
      files.push(fullPath);
    }
  }
};
await collect(dist);

const actualChecksum = createHash('sha256').update(await fs.readFile(zipPath)).digest('hex');
const checksumText = (await fs.readFile(checksumPath, 'utf8')).trim();
if (checksumText !== `${actualChecksum}  ${path.basename(zipPath)}`) {
  throw new Error('Release ZIP checksum is missing or does not match the ZIP contents');
}

for (const file of files) {
  const relative = path.relative(dist, file).split(path.sep).join('/');
  if (/^(tests?|fixtures?)\//i.test(relative)) throw new Error(`Test-only path found in distribution: ${relative}`);
  const content = await fs.readFile(file);
  const text = content.toString('utf8');
  const marker = forbiddenMarkers.find(value => text.includes(value));
  if (marker) throw new Error(`Test-only authorization marker found in distribution: ${marker}`);
}

const zip = await JSZip.loadAsync(await fs.readFile(zipPath));
const zipNames = Object.keys(zip.files).filter(name => !zip.files[name].dir);
if (zipNames.some(name => name.includes('\\') || name.startsWith('../') || name.startsWith('/'))) {
  throw new Error('Unsafe path found in release ZIP');
}
for (const required of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_FALLBACK_NOTICES.md']) {
  if (!zipNames.includes(required)) throw new Error(`Required distribution notice missing from ZIP: ${required}`);
}
if (!zipNames.some(name => name.startsWith('THIRD_PARTY_LICENSES/') && name.split('/').length >= 3)) {
  throw new Error('Upstream license text files are missing from the release ZIP');
}
const distNames = files.map(file => path.relative(dist, file).split(path.sep).join('/')).sort();
const nonNoticeZipNames = zipNames.filter(name => !['LICENSE', 'THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_FALLBACK_NOTICES.md'].includes(name) && !name.startsWith('THIRD_PARTY_LICENSES/')).sort();
if (JSON.stringify(distNames) !== JSON.stringify(nonNoticeZipNames)) {
  throw new Error('Release ZIP contents do not match the built distribution');
}
for (const file of files) {
  const relative = path.relative(dist, file).split(path.sep).join('/');
  const zipContent = await zip.files[relative].async('nodebuffer');
  const distContent = await fs.readFile(file);
  if (!zipContent.equals(distContent)) throw new Error(`Release ZIP content differs from dist/${relative}`);
}
if (zipNames.some(name => /^(tests?|fixtures?)\//i.test(name))) throw new Error('Test-only paths found in release ZIP');
if (zipNames.some(name => name.startsWith('THIRD_PARTY_LICENSES/') && name.split('/').length < 3)) {
  throw new Error('Malformed third-party license path found in release ZIP');
}
for (const marker of forbiddenMarkers) {
  for (const name of zipNames) {
    const text = await zip.files[name].async('string');
    if (text.includes(marker)) throw new Error(`Test-only authorization marker found in release ZIP: ${marker}`);
  }
}

console.log(`Package check passed: ${manifest.name} ${manifest.version}; ${files.length} files; no test-only authorization markers.`);
