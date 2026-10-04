import {DatabaseSync,backup} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {cp,lstat,mkdir,readdir,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {runtimeAssert,runtimeExists,runtimeOwned,runtimeSync,runtimeWrite} from './runtime-files.js';
import {canonicalRuntime,readRuntimeFile,runtimeFileHash,runtimeHash,runtimeInventory} from './runtime-release.js';
import {runtimeCommand} from './runtime-command.js';
import {backupData} from './operations.js';
import {ROOT_CONFIG,MONITOR_CONFIG} from './runtime-config.js';
import {runtimeEnvironment,type InstallConfig} from './runtime-config.js';
import {readDeviceSettings} from './device-settings.js';
import {acquireDeviceOwner} from './device-owner.js';

const DATABASES=new Set(['library/catalog.sqlite','agent-monitor/state/state.sqlite']);
const JSON_FILES=new Set([...ROOT_CONFIG,...MONITOR_CONFIG.map(name=>'agent-monitor/'+name),'agent-monitor/presentation.json','agent-monitor/now-playing.json']);
const DIRECTORIES=new Set(['library','library/media','library/media/originals','library/media/renditions','agent-monitor','agent-monitor/state']);
const LOCKS=new Set(['library/owner.sqlite','agent-monitor/state/owner.sqlite']);
const transient=(path:string)=>LOCKS.has(path)||[...DATABASES,...LOCKS].some(database=>['-wal','-shm','-journal'].some(suffix=>path===database+suffix))||path==='library/media/staging';
export async function runtimeStatePaths(root:string):Promise<string[]>{
 const files:string[]=[];let bytes=0;
 async function visit(prefix:string):Promise<void>{
  for(const name of (await readdir(join(root,prefix))).sort()){
   const path=prefix?prefix+'/'+name:name,info=await lstat(join(root,path));
   runtimeAssert(!info.isSymbolicLink(),'linked-runtime-state');
   if(transient(path)){runtimeAssert(info.isFile()||path==='library/media/staging'&&info.isDirectory(),'unsupported-transient-state');continue;}
   if(info.isDirectory()){
    runtimeAssert(DIRECTORIES.has(path)||/^library\/media\/renditions\/[a-f0-9]{64}$/.test(path),'unknown-runtime-state-directory');await visit(path);
   }else{
    runtimeAssert(info.isFile()&&info.nlink===1&&(DATABASES.has(path)||JSON_FILES.has(path)||/^library\/media\/originals\/[a-f0-9]{64}$/.test(path)||/^library\/media\/renditions\/[a-f0-9]{64}\/(manifest\.json|(?:0|[1-9]\d{0,3})\.(rgb|png))$/.test(path)),'unknown-runtime-state-file');
    bytes+=info.size;runtimeAssert(files.length<100000&&info.size<=512*1024*1024&&bytes<=20*1024*1024*1024,'runtime-state-capacity');files.push(path);
   }
  }
 }
 await visit('');runtimeAssert(files.includes('library/catalog.sqlite'),'runtime-catalog-missing');return files;
}
export async function runtimeSqlDigest(path:string):Promise<string>{
 const db=new DatabaseSync(path,{readOnly:true,allowExtension:false,timeout:1000}),hash=createHash('sha256');
 try{
  db.exec('BEGIN');runtimeAssert(db.prepare('PRAGMA integrity_check').get()?.integrity_check==='ok','runtime-state-integrity');
  hash.update(canonicalRuntime(db.prepare('PRAGMA user_version').get()));hash.update(canonicalRuntime(db.prepare('PRAGMA application_id').get()));
  const tables=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name").all();
  for(const table of tables){hash.update(canonicalRuntime(table));const name=String(table.name).replaceAll('"','""');let count=0;
   for(const row of db.prepare('SELECT * FROM "'+name+'" ORDER BY rowid').iterate()){runtimeAssert(++count<=100000,'runtime-state-capacity');hash.update(canonicalRuntime(row));}
  }
  return hash.digest('hex');
 }finally{db.close();}
}
export async function runtimeStateDigest(root:string):Promise<string>{
 const items=[];for(const path of await runtimeStatePaths(root))items.push({path,sha256:DATABASES.has(path)?await runtimeSqlDigest(join(root,path)):await runtimeFileHash(join(root,path),512*1024*1024)});
 return runtimeHash(canonicalRuntime(items));
}
export async function snapshotRuntimeState(source:string,destination:string):Promise<void>{
 const files=await runtimeStatePaths(source);await mkdir(destination,{mode:0o700});
 for(const path of files){
  const target=join(destination,path);await mkdir(dirname(target),{recursive:true,mode:0o700});
  if(DATABASES.has(path)){
   const db=new DatabaseSync(join(source,path),{readOnly:true,allowExtension:false,timeout:1000});
   try{await backup(db,target);}finally{db.close();}
  }else await cp(join(source,path),target,{force:false,errorOnExist:true,preserveTimestamps:true});
  await runtimeSync(target);
 }
 const directories=new Set(files.flatMap(path=>{const values:string[]=[];for(let parent=dirname(path);parent!=='.';parent=dirname(parent))values.push(parent);return values;}));
 for(const path of [...directories].sort((a,b)=>b.length-a.length))await runtimeSync(join(destination,path));
 await runtimeSync(destination);
}
interface RuntimeBackupConfiguration {name:'service.env'|'pixoo-playlist-controller.service';path:string;sha256:string}
/** Existing verified library backup, every named durable record and bound external configuration. */
export async function backupRuntimeState(source:string,destination:string,whileLocked?:(sha256:string)=>Promise<void>,configuration:readonly RuntimeBackupConfiguration[]=[]):Promise<string>{
 await runtimeStatePaths(source);await mkdir(destination,{mode:0o700});
 let digest='';
 await backupData(source,join(destination,'library-backup'),async()=>{
  await snapshotRuntimeState(source,join(destination,'complete-state'));
  const retained=[];
  if(configuration.length)await mkdir(join(destination,'configuration'),{mode:0o700});
  for(const item of configuration){
   await runtimeOwned(item.path,false,item.name==='service.env');const bytes=await readRuntimeFile(item.path,16384);
   runtimeAssert(runtimeHash(bytes)===item.sha256,'runtime-backup-configuration-drift');
   const path=join('configuration',item.name),copy=join(destination,path);await writeFile(copy,bytes,{mode:0o600,flag:'wx'});await runtimeSync(copy);
   runtimeAssert(await runtimeFileHash(copy)===item.sha256,'runtime-backup-configuration-copy-failed');
   retained.push({path,source:item.path,sha256:item.sha256,originalMode:(await lstat(item.path)).mode&0o777});
  }
  if(configuration.length)await runtimeSync(join(destination,'configuration'));
  // Retained backup evidence is never an automatic rollback input.
  const manifest=join(destination,'manifest.json');await runtimeWrite(manifest,{schemaVersion:1,
   libraryBackupManifestSha256:await runtimeFileHash(join(destination,'library-backup/manifest.json')),
   completeStateSha256:await runtimeStateDigest(join(destination,'complete-state')),configuration:retained});
  await runtimeSync(destination);digest=await runtimeFileHash(manifest);await whileLocked?.(digest);
 });return digest;
}

const PERSISTENCE=['device-settings.js','mcp-config.js','monitor-source.js','monitor-storage.js','monitor-presentation.js','now-playing-source.js'];
export async function durableRuntimeFingerprint(program:string):Promise<string>{
 const values:Record<string,string>={};
 for(const packageName of ['core','library','media','playback']){
  const directory=join(program,'packages',packageName,'dist'),inventory=await runtimeInventory(directory);
  values[packageName]=runtimeHash(canonicalRuntime(inventory.entries.filter(entry=>entry.path.endsWith('.js'))));
 }
 for(const name of PERSISTENCE)values[name]=await runtimeFileHash(join(program,'apps/server/dist',name));
 values.agentState=(await runtimeInventory(join(program,'node_modules/@jimmie-potts/agent-state'))).sha256;
 return runtimeHash(canonicalRuntime(values));
}

const PROBE=String.raw`
import {mkdir,writeFile,access,readFile} from 'node:fs/promises';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const [program,data,mode]=process.argv.slice(1),load=path=>import(pathToFileURL(join(program,path)).href),exists=async path=>{try{await access(path);return true;}catch{return false;}};
const {Library}=await load('packages/library/dist/index.js'),core=await load('packages/core/dist/index.js'),media=await load('packages/media/dist/index.js');
const {MonitorStorage}=await load('apps/server/dist/monitor-storage.js'),monitor=await load('apps/server/dist/monitor-source.js'),credentials=await load('apps/server/dist/mcp-config.js'),settings=await load('apps/server/dist/device-settings.js');
const library=await Library.open({directory:join(data,'library'),...(mode==='write'?{}:{requireExisting:true})});
try{
 if(mode==='write'){
  const bytes=Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==','base64');
  bytes[bytes.indexOf(Buffer.from([0x21,0xf9,0x04]))+4]=50;
  const imported=await library.importMedia((async function*(){yield bytes;})(),'upgrade-fixture.gif');
  for(const profile of media.DEVICE_PROFILES)await library.renderAsset(imported.asset.id,{profile});
  let list=await library.createPlaylist('Upgrade fixture',{shuffle:true});list=await library.replaceItems(list.id,list.revision,[{renditionId:imported.rendition.id}]);
  await library.createPlaybackCheckpoint(list.id);await library.retainSession([imported.rendition.id]);
 }
 await library.verifyStorage();await library.listAssets();await library.listPlaylists();await library.listSessions();await library.getPlaybackCheckpoint();
}finally{await library.close();}
const directory=join(data,'agent-monitor');
if(mode==='write'){
 await mkdir(directory,{recursive:true,mode:0o700});
 await writeFile(join(data,'device.json'),JSON.stringify({version:1,configuration:{ip:'10.255.0.1',profile:'simulator-v1'}}));
 await writeFile(join(data,'hosted-gif.json'),JSON.stringify({bind:'127.0.0.1',port:8788,origin:'http://127.0.0.1:8788'}));
 await writeFile(join(data,'monitor-operator-token'),'A'.repeat(43));
 await writeFile(join(directory,'config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'upgrade-fixture',consumers:[{id:'pixoo',clearOnNewTurn:true}]}));
 await writeFile(join(directory,'presentation.json'),JSON.stringify({version:1,mode:'media',filter:{},cadenceMs:1000}));
 await writeFile(join(directory,'now-playing.json'),JSON.stringify({version:1,media:'off'}));
 await writeFile(join(directory,'playback.json'),JSON.stringify({version:1,endpoint:'http://127.0.0.1:8789/api/playback/v1/snapshot',token:'A'.repeat(43),sourceId:'upgrade-fixture'}));
 for(const root of [data,directory])await credentials.registerCredential(root,'upgrade-fixture','A'.repeat(43),['read']);
 const {createAgentState}=await load('node_modules/@jimmie-potts/agent-state/dist/index.js');
 const owner=await createAgentState({ownerId:'upgrade-fixture',consumers:[{id:'pixoo',clearOnNewTurn:true}],clock:()=>1000,storage:new MonitorStorage(join(directory,'state'))});
 const identity={provider:'codex',client:'cli',hostId:'fixture',sourceId:'fixture',sessionId:'fixture'};
 try{await owner.ingest({apiVersion:'1.0',identity,turn:{status:'known',id:'turn'},parent:{status:'unknown'},event:{kind:'session.started'},observedAtMs:1000,ordering:{status:'unknown'}});await owner.setLabel(identity,'Retained label');const state=await owner.exportState();await writeFile(join(directory,'import.json'),JSON.stringify(state));await writeFile(join(directory,'quiesced.json'),JSON.stringify({version:1,ownerId:'upgrade-fixture',revision:state.revision}));}finally{await owner.shutdown();}
}
await settings.readDeviceSettings(data);if(await exists(join(data,'hosted-gif.json')))await settings.readHostedSettings(data);
for(const root of [data,directory])if(await exists(join(root,'mcp-credentials.json')))await credentials.validateMcpConfiguration(root);
if(await exists(join(directory,'config.json')))await monitor.loadMonitorConfig(directory);
if(await exists(join(directory,'presentation.json')))core.presentationConfiguration.parse(await monitor.readMonitorJson(join(directory,'presentation.json')));
if(await exists(join(directory,'now-playing.json')))core.nowPlayingSetting.parse(await monitor.readMonitorJson(join(directory,'now-playing.json')));
if(await exists(join(directory,'playback.json')))await (await load('apps/server/dist/now-playing-source.js')).loadPlaybackConfig(directory);
if(await exists(join(directory,'quiesced.json'))){const marker=await monitor.readMonitorJson(join(directory,'quiesced.json'));if(marker.version!==1||typeof marker.ownerId!=='string'||!Number.isSafeInteger(marker.revision))throw Error('invalid-quiescence-marker');}
if(await exists(join(directory,'import.json'))){const {validateExport}=await load('node_modules/@jimmie-potts/agent-state/dist/index.js');if(!validateExport(JSON.parse(await readFile(join(directory,'import.json'),'utf8'))).ok)throw Error('invalid-import');}
if(await exists(join(directory,'state/state.sqlite'))){const signal=new AbortController().signal,lease=await new MonitorStorage(join(directory,'state')).acquire('upgrade-reader',signal);try{await lease.load(signal);}finally{await lease.release();}}
console.log('reopened');
`;
export async function probeRuntimeState(program:string,data:string,node:string,mode:'write'|'reopen'):Promise<void>{
 const result=await runtimeCommand(node,['--input-type=module','-e',PROBE,program,data,mode],{timeout:60000,
  env:{PATH:process.env.PATH,HOME:process.env.HOME,PIXOO_MODE:'simulator',PIXOO_OBSERVABILITY_ENABLED:'0'}});
 runtimeAssert(result.toString().trim()==='reopened','runtime-state-probe-failed');
}
export async function qualifyRuntimeState(previous:string,target:string,node:string,scratch:string):Promise<{status:'compatible';fingerprint:string;stateSha256:string}>{
 const fingerprint=await durableRuntimeFingerprint(previous);runtimeAssert(fingerprint===await durableRuntimeFingerprint(target),'durable-runtime-implementation-unqualified');
 await mkdir(scratch,{mode:0o700});await probeRuntimeState(target,scratch,node,'write');const before=await runtimeStateDigest(scratch);
 await probeRuntimeState(previous,scratch,node,'reopen');runtimeAssert(before===await runtimeStateDigest(scratch),'previous-runtime-changed-state');
 return {status:'compatible',fingerprint,stateSha256:before};
}
export async function reopenRuntimeState(previous:string,target:string,node:string,snapshot:string):Promise<string>{
 const before=await runtimeStateDigest(snapshot);
 for(const program of [target,previous]){await probeRuntimeState(program,snapshot,node,'reopen');runtimeAssert(before===await runtimeStateDigest(snapshot),'runtime-state-migration-unqualified');}
 return before;
}
export async function withMonitorLock<T>(data:string,work:()=>Promise<T>):Promise<T>{
 const path=join(data,'agent-monitor/state/owner.sqlite');let lock:DatabaseSync|undefined;
 try{if(await runtimeExists(path)){lock=new DatabaseSync(path,{timeout:0,allowExtension:false});lock.exec('BEGIN EXCLUSIVE');}return await work();}
 finally{lock?.close();}
}
export async function withRuntimeOwners<T>(config:InstallConfig,work:()=>Promise<T>,library=false):Promise<T>{
 let release:(()=>void)|undefined,lock:DatabaseSync|undefined;
 try{
  if((await runtimeEnvironment(config)).PIXOO_MODE==='device'){
   const settings=await readDeviceSettings(config.dataDirectory);runtimeAssert(settings,'missing-device-settings');release=await acquireDeviceOwner(settings.ip);
  }
  if(library){const path=join(config.dataDirectory,'library/owner.sqlite');runtimeAssert(await runtimeExists(path),'library-owner-lock-missing');lock=new DatabaseSync(path,{timeout:0,allowExtension:false});lock.exec('BEGIN EXCLUSIVE');}
  return await withMonitorLock(config.dataDirectory,work);
 }finally{lock?.close();release?.();}
}
