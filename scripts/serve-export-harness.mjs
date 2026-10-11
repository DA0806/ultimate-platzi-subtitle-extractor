import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const portArg = process.argv.find(value => value.startsWith('--port='));
const port = Number(portArg?.slice('--port='.length) || 4177);

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('Use a TCP port between 1024 and 65535.');
}

const server = await createServer({
  root,
  appType: 'mpa',
  server: { host: '127.0.0.1', port, strictPort: true },
});

await server.listen();
console.log(`EXPORT_HARNESS_URL=http://127.0.0.1:${port}/tests/browser-export-harness/index.html`);
console.log('EXPORT_HARNESS_SCOPE=loopback-only; test fixtures and AUTH_SIMULATED entry are outside dist');

const shutdown = async () => {
  await server.close();
  process.exit(0);
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
