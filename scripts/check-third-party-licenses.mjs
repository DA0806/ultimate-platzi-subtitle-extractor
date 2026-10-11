import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const lock = JSON.parse(await fs.readFile(path.join(root, 'package-lock.json'), 'utf8'));
const rows = [];
const missing = [];
const missingText = [];
const readmeComplete = [];
const readmeIncomplete = [];
for (const [location, entry] of Object.entries(lock.packages || {})) {
  if (!location || entry.link) continue;
  const manifestPath = path.join(root, location, 'package.json');
  try {
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    const license = manifest.license || (Array.isArray(manifest.licenses) ? manifest.licenses.map(value => value.type || value).join(' OR ') : '');
    if (!license) missing.push(`${manifest.name}@${manifest.version}`);
    else rows.push(`${manifest.name}@${manifest.version}: ${license}`);
    const packageFiles = await fs.readdir(path.join(root, location), { withFileTypes: true });
    const licenseText = packageFiles.some(file => file.isFile() && /^(license|licence|copying|notice)/i.test(file.name));
    const readmeName = packageFiles.find(file => file.isFile() && /^readme(?:\.|$)/i.test(file.name))?.name;
    if (!licenseText && readmeName) {
      const readme = await fs.readFile(path.join(root, location, readmeName), 'utf8');
      const normalized = readme.toLowerCase();
      const expression = String(license).toLowerCase();
      const complete = expression.includes('mit')
        ? normalized.includes('permission is hereby granted') && normalized.includes('software is provided')
        : expression.includes('apache')
          ? normalized.includes('apache license') && normalized.includes('terms and conditions')
          : expression.includes('bsd')
            ? normalized.includes('redistribution and use') && normalized.includes('provided by the copyright holders')
            : expression.includes('isc')
              ? normalized.includes('permission to use, copy, modify') && normalized.includes('author disclaims all warranties')
              : expression.includes('zlib')
                ? normalized.includes("provided 'as-is'") && normalized.includes('permission is granted to anyone')
                : false;
      (complete ? readmeComplete : readmeIncomplete).push(`${manifest.name}@${manifest.version}`);
    } else if (!licenseText) {
      missingText.push(`${manifest.name}@${manifest.version}`);
    }
  } catch {
    if (!entry.optional) missing.push(`${location} (${entry.version || 'unknown version'})`);
  }
}
if (missing.length) {
  throw new Error(`Missing license metadata for locked packages:\n${missing.join('\n')}`);
}
console.log(`License metadata verified for ${rows.length} installed lockfile packages.`);
console.log([...new Set(rows.map(row => row.slice(row.indexOf(': ') + 2)))].sort().join(', '));
if (missingText.length) {
  console.warn(`Upstream license text or README fallback not found in ${missingText.length} installed packages (metadata remains in package-lock.json):`);
  console.warn(missingText.join(', '));
}
console.log(`Upstream license text files found for ${rows.length - readmeComplete.length - readmeIncomplete.length - missingText.length} packages; complete README fallback used for ${readmeComplete.length}.`);
if (readmeIncomplete.length) {
  console.warn(`README fallback is metadata/link-only for ${readmeIncomplete.length} packages; standalone terms are not claimed:`);
  console.warn(readmeIncomplete.join(', '));
}
