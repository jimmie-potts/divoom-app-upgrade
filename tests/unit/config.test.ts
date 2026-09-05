import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../../apps/server/src/config.js';

const temporary: string[] = [];
async function fixture() {
  const base = await mkdtemp(join(tmpdir(), 'pixoo-config-'));
  temporary.push(base);
  const root = join(base, 'source');
  await mkdir(root);
  return { base, root, home: join(base, 'home') };
}
afterEach(async () => { await Promise.all(temporary.splice(0).map(p => rm(p, { recursive: true, force: true }))); });

describe('runtime configuration', () => {
  it('defaults to loopback and simulator with external user storage', async () => {
    const context = await fixture();
    const config = await loadConfig({}, { ...context, platform: 'linux' });
    expect(config).toEqual({ host: '127.0.0.1', port: 8787, mode: 'simulator', dataDir: join(context.home, '.local', 'share', 'pixoo-playlist-controller') });
    expect(await readdir(config.dataDir)).toEqual([]);
  });
  it('uses LOCALAPPDATA for Windows and keeps existing files', async () => {
    const context = await fixture();
    const local = join(context.base, 'local');
    const config = await loadConfig({ LOCALAPPDATA: local }, { ...context, platform: 'win32' });
    await writeFile(join(config.dataDir, 'keep.txt'), 'retain me');
    await loadConfig({ PIXOO_DATA_DIR: config.dataDir, PIXOO_PORT: '0' }, context);
    expect(await readFile(join(config.dataDir, 'keep.txt'), 'utf8')).toBe('retain me');
  });
  it.each(['', '-1', '65536', '3.14', '12abc', ' 8787', '1e3'])('rejects invalid port %j', async (value) => {
    await expect(loadConfig({ PIXOO_PORT: value }, await fixture())).rejects.toThrow('PIXOO_PORT');
  });
  it.each(['', 'relative/path'])('rejects invalid data path %j', async (value) => {
    await expect(loadConfig({ PIXOO_DATA_DIR: value }, await fixture())).rejects.toThrow('PIXOO_DATA_DIR');
  });
  it('rejects unsupported real-device mode', async () => {
    await expect(loadConfig({ PIXOO_MODE: 'real' }, await fixture())).rejects.toThrow('PIXOO_MODE');
  });
  it('rejects source subdirectories before creating them', async () => {
    const context = await fixture();
    await expect(loadConfig({ PIXOO_DATA_DIR: join(context.root, 'data') }, context)).rejects.toThrow('outside source');
    expect(await readdir(context.root)).toEqual([]);
  });
  it('rejects another Git checkout', async () => {
    const context = await fixture();
    const other = join(context.base, 'other');
    await mkdir(join(other, '.git'), { recursive: true });
    await writeFile(join(other, '.git', 'HEAD'), 'ref: refs/heads/main');
    await expect(loadConfig({ PIXOO_DATA_DIR: join(other, 'data') }, context)).rejects.toThrow('outside source');
    expect(await readdir(other)).toEqual(['.git']);
  });
  it('rejects a symlink alias into source before creating data', async () => {
    const context = await fixture();
    const alias = join(context.base, 'alias');
    await symlink(context.root, alias, process.platform === 'win32' ? 'junction' : 'dir');
    await expect(loadConfig({ PIXOO_DATA_DIR: join(alias, 'nested', 'data') }, context)).rejects.toThrow('outside source');
    expect(await readdir(context.root)).toEqual([]);
  });
  it('fails for a non-directory storage location', async () => {
    const context = await fixture();
    const file = join(context.base, 'file');
    await writeFile(file, 'retain');
    await expect(loadConfig({ PIXOO_DATA_DIR: file }, context)).rejects.toThrow();
    expect(await readFile(file, 'utf8')).toBe('retain');
  });
});
