import { it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { multipart } from '../helpers/http-api.js';
import { gifFixture } from '../helpers/media-fixtures.js';

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
    const player = await fetch(`${address}/api/player`);
    expect(player.status).toBe(200);
    expect(await player.json()).toMatchObject({player:{state:'idle',sessionId:null}});
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

function launch(dataDir: string) {
  const child = spawn(process.execPath, [entry], {
    cwd: dataDir,
    env: { ...process.env, PIXOO_DATA_DIR: dataDir, PIXOO_PORT: '0', PIXOO_MODE: 'simulator' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit');
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
  const address = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Startup timed out: ${stderr}`)), 8000);
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      const match = /listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(output);
      if (match?.[1]) { clearTimeout(timeout); resolve(match[1]); }
    });
    child.once('exit', () => { clearTimeout(timeout); reject(new Error(`Exited before startup: ${stderr}`)); });
  });
  const stop = async () => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM'); return exited; };
  return { child, address, exited, stop };
}

// A user service manager stops the backend with SIGTERM. The same data
// directory must reopen afterwards with the interrupted session paused.
it('drains active playback on SIGTERM and releases the catalog for the next start', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'pixoo-process-'));
  const headers = { 'x-pixoo-request': '1', 'content-type': 'application/json' };
  const first = launch(dataDir);
  let second: ReturnType<typeof launch> | undefined;
  try {
    const address = await first.address;
    const upload = multipart(gifFixture(1, 1, [{ width: 1, height: 1, pixels: [1], delay: 50 }, { width: 1, height: 1, pixels: [2], delay: 50 }]));
    const asset = await (await fetch(`${address}/api/assets`, { method: 'POST', headers: upload.headers, body: upload.payload })).json();
    const playlist = await (await fetch(`${address}/api/playlists`, { method: 'POST', headers, body: JSON.stringify({ name: 'Service stop' }) })).json();
    await fetch(`${address}/api/playlists/${playlist.id}/items`, { method: 'PUT', headers, body: JSON.stringify({ revision: 1, items: [{ renditionId: asset.rendition.id }] }) });
    const { nextRequestId } = await (await fetch(`${address}/api/player`)).json();
    const started = await fetch(`${address}/api/player/commands`, { method: 'POST', headers, body: JSON.stringify({ requestId: nextRequestId, command: 'start', playlistId: playlist.id }) });
    expect(started.status).toBe(200);
    const active = await (await fetch(`${address}/api/player`)).json();
    expect(active.player.intent).toBe('active');
    const [code, signal] = await first.stop();
    if (process.platform !== 'win32') expect([code, signal]).toEqual([0, null]);
    second = launch(dataDir);
    const reopened = await (await fetch(`${await second.address}/api/player`)).json();
    expect(reopened.player).toMatchObject({ intent: 'paused', state: 'paused', sessionId: active.player.sessionId });
  } finally {
    await first.stop();
    await second?.stop();
    await rm(dataDir, { recursive: true, force: true });
  }
}, 20_000);
