import { mkdir, mkdtemp, writeFile, rm, stat, readFile, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {loadRuntimeSelection,type RuntimeSelection} from './device-settings.js';
import {controllerIdentity,type ControllerIdentity} from './controller.js';

export const sourceRoot = fileURLToPath(new URL('../../../', import.meta.url));
export interface RuntimeConfig extends RuntimeSelection {
  host: '127.0.0.1';
  port: number;
  dataDir: string;
  mcpEnabled?:boolean;
  monitorEnabled?:boolean;
  controllerEnabled?:boolean;
  controllerIdentity?:ControllerIdentity;
}
interface ConfigContext { root?: string; home?: string; platform?: string }

export function within(parent: string, child: string): boolean {
  const delta = relative(parent, child);
  return delta === '' || (!delta.startsWith(`..${sep}`) && delta !== '..' && !isAbsolute(delta));
}

// Resolve the closest existing ancestor, so even a not-yet-created child of a
// symlink is checked against the actual storage location before mkdir.
async function canonicalPath(path: string): Promise<string> {
  const suffix: string[] = [];
  let existing = resolve(path);
  for (;;) {
    try { return join(await realpath(existing), ...suffix.reverse()); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || dirname(existing) === existing) throw error;
      suffix.push(basename(existing));
      existing = dirname(existing);
    }
  }
}

async function insideGit(path: string): Promise<boolean> {
  for (let current = path; ; current = dirname(current)) {
    try {
      const marker = join(current, '.git');
      const info = await stat(marker);
      if (info.isDirectory()) { await stat(join(marker, 'HEAD')); return true; }
      if (info.isFile() && (await readFile(marker, 'utf8')).startsWith('gitdir: ')) return true;
    }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (dirname(current) === current) return false;
  }
}

export async function privatePath(requested:string,root=sourceRoot):Promise<string> {
  if(!requested.trim() || !isAbsolute(requested))throw new Error('Use an absolute directory outside source control');
  const path=await canonicalPath(requested);
  if(within(await canonicalPath(root),path) || await insideGit(path))throw new Error('Directory must be outside source control');
  return path;
}

export async function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  context: ConfigContext = {},
): Promise<RuntimeConfig> {
  if (env.PIXOO_MODE !== undefined && env.PIXOO_MODE !== 'simulator' && env.PIXOO_MODE !== 'device') {
    throw new Error('PIXOO_MODE must be simulator or device');
  }
  if(env.PIXOO_MCP_ENABLED!==undefined&&env.PIXOO_MCP_ENABLED!=='1')throw new Error('PIXOO_MCP_ENABLED must be 1 or absent');
  if(env.PIXOO_MONITOR_ENABLED!==undefined&&env.PIXOO_MONITOR_ENABLED!=='1')throw new Error('PIXOO_MONITOR_ENABLED must be 1 or absent');
  if(env.PIXOO_CONTROLLER_ENABLED!==undefined&&env.PIXOO_CONTROLLER_ENABLED!=='1')throw new Error('PIXOO_CONTROLLER_ENABLED must be 1 or absent');
  const identity=controllerIdentity({deviceId:env.PIXOO_CONTROLLER_DEVICE_ID??'pixoo-local',controllerId:env.PIXOO_CONTROLLER_ID??'pixoo-controller',sourceId:env.PIXOO_CONTROLLER_SOURCE_ID??'pixoo'});
  const rawPort = env.PIXOO_PORT ?? '8787';
  if (!/^\d+$/.test(rawPort) || Number(rawPort) > 65535) {
    throw new Error('PIXOO_PORT must be an integer from 0 through 65535');
  }
  const home = context.home ?? homedir();
  const platform = context.platform ?? process.platform;
  const defaultDir = platform === 'win32'
    ? join(env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'PixooPlaylistController')
    : join(home, '.local', 'share', 'pixoo-playlist-controller');
  const requested = env.PIXOO_DATA_DIR ?? defaultDir;
  if (!requested.trim() || !isAbsolute(requested)) {
    throw new Error('PIXOO_DATA_DIR must be an absolute directory outside source control');
  }
  const dataDir = await canonicalPath(requested);
  if (within(await canonicalPath(context.root ?? sourceRoot), dataDir) || await insideGit(dataDir)) {
    throw new Error('PIXOO_DATA_DIR must be outside source control');
  }
  await mkdir(dataDir, { recursive: true });
  const probe = await mkdtemp(join(dataDir, '.pixoo-write-check-'));
  try { await writeFile(join(probe, 'probe'), ''); }
  finally { await rm(probe, { recursive: true, force: true }); }
  return Object.freeze({ host: '127.0.0.1', port: Number(rawPort), dataDir, ...(env.PIXOO_MONITOR_ENABLED==='1'?{monitorEnabled:true}:{}), ...(env.PIXOO_MCP_ENABLED==='1'?{mcpEnabled:true}:{}), ...(env.PIXOO_CONTROLLER_ENABLED==='1'?{controllerEnabled:true,controllerIdentity:identity}:{}), ...await loadRuntimeSelection(dataDir,env.PIXOO_MODE??'simulator') });
}
