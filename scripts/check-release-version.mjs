import { promises as fs } from 'node:fs';

const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
const tag = process.argv[2] || process.env.GITHUB_REF_NAME || '';
const match = /^v(\d+\.\d+\.\d+)-experimental\.\d+$/.exec(tag);
if (!match || match[1] !== packageJson.version) {
  throw new Error(`Experimental tag ${tag || '(missing)'} must match package version ${packageJson.version}`);
}
console.log(`Release version check passed: ${tag}`);
