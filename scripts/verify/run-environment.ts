// Pixoo verification run environment: the launch command, the environment
// that forces simulator transport, and the private data directory guard.
// Node runs this file directly with type stripping, so it uses erasable
// TypeScript only.
import {lstat,readdir,realpath} from 'node:fs/promises';
import {userInfo} from 'node:os';
import {basename,dirname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {installedPorts} from './installed-ports.ts';

export const checkoutRoot=fileURLToPath(new URL('../../',import.meta.url)).replace(/\/$/,'');
export const transportGuard=fileURLToPath(new URL('./transport-guard.ts',import.meta.url));
export const serverEntry=join(checkoutRoot,'apps','server','dist','main.js');
export {installedPorts};

/** The guard's record of blocked transport attempts. It lives beside `data/`, so a reseed keeps it. */
export function transportLog(runtimeDir:string):string {return join(runtimeDir,'pixoo-transport.jsonl');}

export interface LaunchInput {runtimeDir:string;dataDir:string;port:number;node:string}
export interface LaunchSpec {argv:string[];env:Record<string,string>;cwd:string}
/**
 * The server process for one run. Every Pixoo setting the run depends on is
 * explicit, so an inherited PIXOO_MODE, PIXOO_DATA_DIR or PIXOO_PORT never
 * decides it, and the transport guard removes any other inherited PIXOO_*
 * setting before the server reads its configuration. The guard also refuses to
 * start the server unless the environment it finally receives selects the
 * simulator.
 */
export function launchSpec({runtimeDir,dataDir,port,node}:LaunchInput):LaunchSpec {
 if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Port must be an integer from 0 through 65535');
 if(installedPorts.includes(port))throw new Error(`Port ${port} is an installed port; a verification run never binds it`);
 if(!isAbsolute(runtimeDir)||!isAbsolute(dataDir))throw new Error('Run directories must be absolute');
 return {
  argv:[node,'--import',pathToFileURL(transportGuard).href,serverEntry],
  env:{PIXOO_MODE:'simulator',PIXOO_DATA_DIR:dataDir,PIXOO_PORT:String(port),PIXOO_MONITOR_ENABLED:'1',APP_VERIFY_TRANSPORT_LOG:transportLog(runtimeDir)},
  cwd:checkoutRoot,
 };
}

function within(parent:string,child:string):boolean {
 const delta=relative(parent,child);
 return delta===''||(!delta.startsWith(`..${sep}`)&&delta!=='..'&&!isAbsolute(delta));
}
/** Resolve symlinks through the closest existing ancestor, so aliases compare equal. */
async function canonical(path:string):Promise<string> {
 const suffix:string[]=[];
 for(let existing=resolve(path);;existing=dirname(existing)){
  try{return join(await realpath(existing),...suffix.reverse());}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT'||dirname(existing)===existing)throw error;suffix.push(basename(existing));}
 }
}

export interface OwnerContext {home?:string;ambient?:NodeJS.ProcessEnv}
/** The owner's normal Pixoo state: default data and lock directories and any configured data directory. */
async function ownerState(context:OwnerContext):Promise<string[]> {
 const ambient=context.ambient??process.env;
 const homes=new Set(context.home!==undefined?[context.home]:[userInfo().homedir,...(ambient.HOME?[ambient.HOME]:[])]);
 const locations=[...homes].flatMap(home=>[join(home,'.local','share','pixoo-playlist-controller'),join(home,'.local','share','pixoo-playlist-controller-device-locks')]);
 if(ambient.PIXOO_DATA_DIR&&isAbsolute(ambient.PIXOO_DATA_DIR))locations.push(ambient.PIXOO_DATA_DIR);
 return Promise.all(locations.map(canonical));
}

/**
 * The run's data directory must be absolute, outside every Git checkout
 * (including through symlink aliases), and must neither be, contain nor sit
 * inside the owner's normal Pixoo state. Returns the canonical path.
 */
export async function assertPrivateDataDir(dataDir:string,context:OwnerContext={}):Promise<string> {
 // Loaded here, not at module load: the core builds the checkout before it seeds or launches.
 const {privatePath}=await import('../../apps/server/dist/config.js');
 const path=await privatePath(dataDir,checkoutRoot);
 for(const owned of await ownerState(context)){
  if(within(owned,path)||within(path,owned))throw new Error('Run data must not overlap the owner state directories');
 }
 return path;
}

/** Seeding writes only into an empty, real directory: anything already there is occupied or planted. */
export async function assertSeedable(dataDir:string,context:OwnerContext={}):Promise<string> {
 const path=await assertPrivateDataDir(dataDir,context);
 const info=await lstat(dataDir);
 if(info.isSymbolicLink()||!info.isDirectory())throw new Error('Run data is occupied by a link or file');
 if((await readdir(path)).length)throw new Error('Run data is occupied by state this seed did not create');
 return path;
}
