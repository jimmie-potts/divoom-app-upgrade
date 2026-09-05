import { it, expect } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../apps/server/src/app.js';

it('serves only the web root alongside the API', async () => {
  const base = await mkdtemp(join(tmpdir(), 'pixoo-static-'));
  const webRoot = join(base, 'web');
  await mkdir(webRoot);
  await writeFile(join(webRoot, 'index.html'), '<h1>Simulator mode</h1>');
  await writeFile(join(base, 'private.txt'), 'private fixture');
  const app = createApp({ webRoot });
  try {
    expect((await app.inject('/')).body).toContain('Simulator mode');
    expect((await app.inject('/api/health')).statusCode).toBe(200);
    for (const url of ['/api/missing', '/private.txt', '/%2e%2e/private.txt']) {
      const response = await app.inject(url);
      expect(response.statusCode).toBe(404);
      expect(response.body).not.toContain('private fixture');
    }
  } finally { await app.close(); await rm(base, { recursive: true, force: true }); }
});
