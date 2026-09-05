import { it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('../../apps/server/dist/main.js', import.meta.url));

it('starts the built process from another cwd and shuts down without deleting data', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'pixoo-process-'));
  await writeFile(join(dataDir, 'keep.txt'), 'preserve');
  const child = spawn(process.execPath, [entry], {
    cwd: dataDir,
    env: { ...process.env, PIXOO_DATA_DIR: dataDir, PIXOO_PORT: '0', PIXOO_MODE: 'simulator' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit');
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
  try {
    const address = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Startup timed out: ${stderr}`)), 8000);
      let output = '';
      child.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString();
        const match = /listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(output);
        if (match?.[1]) { clearTimeout(timeout); resolve(match[1]); }
      });
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', () => { clearTimeout(timeout); reject(new Error(`Exited before startup: ${stderr}`)); });
    });
    const health = await fetch(`${address}/api/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ mode: 'simulator', device: { connected: false } });
    const page = await fetch(address);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('<div id="root">');
    child.kill('SIGTERM');
    const [code, signal] = await exited;
    if (process.platform !== 'win32') expect([code, signal]).toEqual([0, null]);
    expect(await readFile(join(dataDir, 'keep.txt'), 'utf8')).toBe('preserve');
    await expect(fetch(`${address}/api/health`)).rejects.toThrow();
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    await exited;
    await rm(dataDir, { recursive: true, force: true });
  }
}, 15_000);
