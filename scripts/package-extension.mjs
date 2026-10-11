import { promises as fs } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const root = process.cwd();
const dist = path.join(root, 'dist');
const output = path.join(dist, 'upse-extension.zip');
const checksum = `${output}.sha256`;
const distStat = await fs.lstat(dist);
if (!distStat.isDirectory() || distStat.isSymbolicLink()) throw new Error('Refusing to package a symbolic-link or non-directory dist/');
const distRealPath = await fs.realpath(dist);
const assertInsideDist = async file => {
  const realPath = await fs.realpath(file);
  if (realPath !== distRealPath && !realPath.startsWith(`${distRealPath}${path.sep}`)) {
    throw new Error(`Refusing to package a path outside dist/: ${file}`);
  }
  const stat = await fs.lstat(file);
  if (!stat.isFile()) throw new Error(`Refusing to package a non-regular file: ${file}`);
};

const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
await assertInsideDist(path.join(dist, 'manifest.json'));
const manifest = JSON.parse(await fs.readFile(path.join(dist, 'manifest.json'), 'utf8'));
if (pkg.version !== manifest.version) {
  throw new Error(`Version mismatch: package.json (${pkg.version}) !== manifest.json (${manifest.version})`);
}

const collectFiles = async (directory) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Refusing to package a symbolic link: ${fullPath}`);
    if (entry.isDirectory()) files.push(...await collectFiles(fullPath));
    else if (fullPath !== output && fullPath !== checksum) {
      await assertInsideDist(fullPath);
      files.push(fullPath);
    }
  }
  return files;
};

const zip = new JSZip();
for (const file of await collectFiles(dist)) {
  const relative = path.relative(dist, file).split(path.sep).join('/');
  zip.file(relative, await fs.readFile(file), { date: new Date(0), createFolders: false });
}
for (const notice of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_FALLBACK_NOTICES.md']) {
  zip.file(notice, await fs.readFile(path.join(root, notice)), { date: new Date(0), createFolders: false });
}

// Preserve the upstream license/copyright/NOTICE files for every installed
// lockfile package. These are distribution notices, not application code.
const lock = JSON.parse(await fs.readFile(path.join(root, 'package-lock.json'), 'utf8'));
for (const packagePath of Object.keys(lock.packages).sort()) {
  if (!packagePath.startsWith('node_modules/')) continue;
  const packageDir = path.join(root, packagePath);
  let entries;
  try {
    entries = await fs.readdir(packageDir, { withFileTypes: true });
  } catch {
    continue;
  }
  let licenseFiles = entries.filter(entry => entry.isFile() && /^(license|licence|copying|notice)/i.test(entry.name));
  if (!licenseFiles.length) {
    licenseFiles = entries.filter(entry => entry.isFile() && /^readme(?:\.|$)/i.test(entry.name));
  }
  for (const entry of licenseFiles.sort((a, b) => a.name.localeCompare(b.name))) {
    const archiveName = `THIRD_PARTY_LICENSES/${packagePath.slice('node_modules/'.length).replaceAll('/', '__')}/${entry.name}`;
    zip.file(archiveName, await fs.readFile(path.join(packageDir, entry.name)), { date: new Date(0), createFolders: false });
  }
}

await fs.writeFile(output, await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
  platform: 'DOS',
}));

console.log(`Created ${path.relative(root, output)}`);
