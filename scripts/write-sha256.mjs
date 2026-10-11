import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const input = path.resolve(process.argv[2] || 'dist/upse-extension.zip');
const output = process.argv[3] ? path.resolve(process.argv[3]) : `${input}.sha256`;
const digest = createHash('sha256').update(await fs.readFile(input)).digest('hex');
await fs.writeFile(output, `${digest}  ${path.basename(input)}\n`, 'utf8');
console.log(`${digest}  ${path.basename(input)}`);
