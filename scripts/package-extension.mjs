import { promises as fs } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const root = process.cwd();
const dist = path.join(root, 'dist');
const output = path.join(dist, 'upse-extension.zip');

const collectFiles = async (directory) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(fullPath));
    else if (fullPath !== output) files.push(fullPath);
  }
  return files;
};

const zip = new JSZip();
for (const file of await collectFiles(dist)) {
  const relative = path.relative(dist, file).split(path.sep).join('/');
  zip.file(relative, await fs.readFile(file), { date: new Date(0), createFolders: false });
}

await fs.writeFile(output, await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
  platform: 'DOS',
}));

console.log(`Created ${path.relative(root, output)}`);
