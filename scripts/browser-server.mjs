import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../apps/server/dist/server.js';

const dataDir = await mkdtemp(join(tmpdir(), 'pixoo-browser-'));
try {
  const { app } = await startServer({ PIXOO_DATA_DIR: dataDir, PIXOO_PORT: '18787' });
  const close = async () => {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  };
  process.once('SIGTERM', () => { void close(); });
  process.once('SIGINT', () => { void close(); });
} catch (error) {
  await rm(dataDir, { recursive: true, force: true });
  throw error;
}
