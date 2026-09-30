// Preloaded with `node --import` into a verification run's server process, and
// by its own wrappers into every child it forks and every worker thread it
// starts. It refuses to let the server start unless the simulator is selected
// and removes inherited Pixoo settings the launch did not set. Through the
// public Node.js APIs, before a packet leaves the process, it blocks every
// outbound HTTP request, UDP socket, Unix socket connection, other process
// start and TCP connection except to the process's own listening port, so
// installed services on loopback are refused like a physical device. Each
// attempt is recorded, so "no physical transport and no installed state
// reached" is an observation rather than an assumption.
//
// Scope: the guard observes and refuses the app's and its dependencies' use of
// public APIs. It is not a sandbox against deliberately hostile code already
// running in the server process, for example values with a side-effecting
// toString, internal bindings (process.binding) or native addons.
import childProcess from 'node:child_process';
import dgram from 'node:dgram';
import {appendFileSync,realpathSync} from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import {syncBuiltinESMExports} from 'node:module';
import net from 'node:net';
import {basename,dirname} from 'node:path';
import {validateFeedPauseContext} from '../../apps/server/src/verification-feed-pause.ts';
import workerThreads from 'node:worker_threads';
import {installedPorts} from './installed-ports.ts';

const log=process.env.APP_VERIFY_TRANSPORT_LOG;
if(!log)throw new Error('Pixoo transport guard: APP_VERIFY_TRANSPORT_LOG is required');
if(process.env.PIXOO_MODE!=='simulator')throw new Error('Pixoo transport guard: a verification run requires PIXOO_MODE=simulator');
const path:string=log;
/**
 * Ports of another disposable run this run may reach on 127.0.0.1: the Hub
 * run's port, which only a `hub-paired` launch declares. Every launch sets the
 * variable, empty when the run is not paired. Never an installed port.
 */
function pairedPorts():ReadonlySet<number> {
 const raw=process.env.APP_VERIFY_PAIRED_PORTS;
 if(raw===undefined||raw==='')return new Set();
 const ports=raw.split(',');
 if(ports.some(port=>!/^\d{1,5}$/.test(port)||Number(port)<1||Number(port)>65535||installedPorts.includes(Number(port))))
  throw new Error('Pixoo transport guard: APP_VERIFY_PAIRED_PORTS must list loopback ports of disposable runs, never an installed port');
 return new Set(ports.map(Number));
}
const paired=pairedPorts();
const pauseDirectory=process.env.APP_VERIFY_FEED_PAUSE_DIR??'',pauseRunId=process.env.APP_VERIFY_FEED_PAUSE_RUN_ID??'';
if(pauseDirectory||pauseRunId){
 try{
  if(paired.size!==1||pauseDirectory!==dirname(path))throw new Error();
  validateFeedPauseContext(pauseDirectory,pauseRunId,process.env.PIXOO_DATA_DIR??'');
 }catch{throw new Error('Pixoo transport guard: invalid feed pause run context');}
 Object.defineProperty(globalThis,Symbol.for('pixoo.verificationFeedPause'),{value:Object.freeze({directory:pauseDirectory,runId:pauseRunId})});
}
/** Ports this process listens on; a connection back to one stays inside the run. Never an installed port. */
const own=new Set<number>();

function record(entry:Record<string,unknown>):void {
 appendFileSync(path,JSON.stringify({at:new Date().toISOString(),pid:process.pid,...entry})+'\n',{mode:0o600});
}
function refusal():Error {return new Error('Outbound transport is disabled in a Pixoo verification run');}

// The launch sets exactly these Pixoo settings. Anything else inherited from the
// user manager (MCP, controller identity, device IP) would change what the
// server opens. A paired launch also enables the native controller API for its
// Hub; the controller keeps its default identity.
const launchSettings=new Set(['PIXOO_MODE','PIXOO_DATA_DIR','PIXOO_PORT','PIXOO_MONITOR_ENABLED',...(paired.size?['PIXOO_CONTROLLER_ENABLED']:[])]);
const removed=Object.keys(process.env).filter(name=>name.startsWith('PIXOO_')&&!launchSettings.has(name)).sort();
for(const name of removed)delete process.env[name];

type Target={host?:string;hostname?:string;port?:number|string;path?:unknown;socketPath?:unknown};
/** Host and port of an http.request/get call, from a URL string, URL object or options. The URL path is not recorded. */
function requestTarget(args:unknown[],defaultPort:number){
 const [first,second]=args,url=typeof first==='string'||first instanceof URL?new URL(String(first)):undefined;
 const options=((url?second:first)??{}) as Target;
 if(typeof options.socketPath==='string')return {socketPath:options.socketPath};
 return {host:options.hostname??options.host??url?.hostname??'localhost',port:Number(options.port??(url?.port||defaultPort))};
}
for(const [name,api,port] of [['http',http,80],['https',https,443]] as const){
 const blocked=(...args:unknown[])=>{record({event:'blocked',api:`${name}.request`,...requestTarget(args,port)});throw refusal();};
 Object.assign(api,{request:blocked,get:blocked});
}

// UDP: refuse creation, and every use of a socket made with `new dgram.Socket`.
Object.assign(dgram,{createSocket:()=>{record({event:'blocked',api:'dgram.createSocket'});throw refusal();}});
for(const method of ['bind','connect','send'] as const){
 Object.defineProperty(dgram.Socket.prototype,method,{configurable:true,writable:true,value(){record({event:'blocked',api:`dgram.${method}`});throw refusal();}});
}

// Child processes and threads. A fork of Node and a worker thread from a file or
// data: URL run under this guard with the run's settings; every other way the
// public API offers to start a process or replace this one is refused, including
// a fork of another program and an eval worker.
const guardUrl=import.meta.url;
/** The run's settings a guarded child needs, including exactly this process's pairing; NODE_OPTIONS is emptied so no preload runs before the guard. */
function guardedEnv(env:NodeJS.ProcessEnv|undefined):NodeJS.ProcessEnv {
 return {...(env??process.env),NODE_OPTIONS:'',PIXOO_MODE:'simulator',APP_VERIFY_TRANSPORT_LOG:path,APP_VERIFY_PAIRED_PORTS:[...paired].join(','),APP_VERIFY_FEED_PAUSE_DIR:pauseDirectory,APP_VERIFY_FEED_PAUSE_RUN_ID:pauseRunId};
}
const withGuard=(execArgv:readonly string[])=>execArgv.includes(guardUrl)?[...execArgv]:['--import',guardUrl,...execArgv];
const fork=childProcess.fork;
const programOf=(file:unknown)=>basename(String(file).trim().split(/\s+/)[0]??'');
/** The resolved path of a program, or the path itself when it cannot be resolved. */
function realPath(path:string):string {try{return realpathSync(path);}catch{return path;}}
/** The Node binary that loaded the guard; later code can overwrite process.execPath. */
const node=realPath(process.execPath);
/** Set only while guardedFork calls Node's fork, which spawns through ChildProcess#spawn. */
let forking=false;
function guardedFork(this:unknown,modulePath:string|URL,...rest:unknown[]){
 // Normalize like Node: fork(path), fork(path, args), fork(path, options), fork(path, null or undefined, options).
 let args:readonly string[]=[],options:childProcess.ForkOptions|undefined;
 if(rest[0]==null)options=rest[1] as childProcess.ForkOptions|undefined;
 else if(typeof rest[0]==='object'&&!Array.isArray(rest[0]))options=rest[0] as childProcess.ForkOptions;
 else{args=rest[0] as string[];options=rest[1] as childProcess.ForkOptions|undefined;}
 // A fork runs Node with the guard; another program would run unguarded. Node reads a falsy execPath as process.execPath.
 const execPath=String(options?.execPath||process.execPath);
 if(realPath(execPath)!==node){record({event:'blocked',api:'child_process.fork',program:programOf(execPath)});throw refusal();}
 // Pass the checked path, so Node never reads process.execPath again.
 const guarded:childProcess.ForkOptions={...options,execPath,execArgv:withGuard(options?.execArgv??process.execArgv),env:guardedEnv(options?.env)};
 record({event:'fork',module:basename(String(modulePath))});
 forking=true;
 try{return fork.call(this,modulePath,args,guarded);}finally{forking=false;}
}
const spawners=['spawn','spawnSync','exec','execSync','execFile','execFileSync'] as const;
const refusedSpawns=Object.fromEntries(spawners.map(name=>[name,(file:unknown)=>{
 record({event:'blocked',api:`child_process.${name}`,program:programOf(file)});throw refusal();
}]));
Object.assign(childProcess,{fork:guardedFork,...refusedSpawns});
// ChildProcess#spawn is public but undocumented in the type definitions.
const childPrototype=childProcess.ChildProcess.prototype as unknown as {spawn:(this:unknown,options:{file?:unknown})=>unknown};
const spawnProcess=childPrototype.spawn;
childPrototype.spawn=function(this:unknown,options:{file?:unknown}){
 if(!forking){record({event:'blocked',api:'ChildProcess.spawn',program:programOf(options?.file)});throw refusal();}
 return spawnProcess.call(this,options);
};
if(typeof process.execve==='function')Object.defineProperty(process,'execve',{configurable:true,writable:true,value:(file:unknown)=>{
 record({event:'blocked',api:'process.execve',program:programOf(file)});throw refusal();
}});
const Worker=workerThreads.Worker;
/** A file worker's base name. A data: URL holds the worker's source, so any URL but file: is recorded by scheme only. */
function workerModule(filename:string|URL):string {
 const href=String(filename),scheme=/^([a-z][a-z\d+.-]*):/i.exec(href)?.[1]?.toLowerCase();
 return !scheme||scheme==='file'?basename(href):`<${scheme}-url>`;
}
/** A worker thread always preloads the guard, even when its caller replaces execArgv or env. */
class GuardedWorker extends Worker {
 constructor(filename:string|URL,options:import('node:worker_threads').WorkerOptions={}){
  // An eval worker's source is code, not a file: it would run before a preload could guard it, and is never logged.
  if(options.eval){record({event:'blocked',api:'Worker(eval)',module:'<eval>'});throw refusal();}
  super(filename,{...options,execArgv:withGuard(options.execArgv??process.execArgv),
   ...(options.env&&typeof options.env==='object'?{env:guardedEnv(options.env as NodeJS.ProcessEnv)}:{})});
  record({event:'worker',module:workerModule(filename)});
 }
}
Object.assign(workerThreads,{Worker:GuardedWorker});

function loopback(host:string):boolean {return host==='localhost'||host==='::1'||/^127\.\d+\.\d+\.\d+$/.test(host)||host==='::ffff:127.0.0.1';}
const connect=net.Socket.prototype.connect;
// Undici (fetch), TLS and raw sockets all reach Socket#connect.
net.Socket.prototype.connect=function(this:net.Socket,...args:unknown[]){
 // net.connect passes its normalized [options, callback] array as the only argument.
 const [first,second]=Array.isArray(args[0])?args[0] as unknown[]:args;
 const options=(typeof first==='object'&&first!==null&&!Array.isArray(first)?first:typeof first==='number'||(typeof first==='string'&&/^\d+$/.test(first))?{port:first,host:typeof second==='string'?second:undefined}:{path:first}) as Target;
 const refuse=(entry:Record<string,unknown>)=>{record({event:'blocked',api:'net.connect',...entry});const error=refusal();process.nextTick(()=>this.destroy(error));return this;};
 // Only a string path is a Unix socket; the http Agent passes `path: null` for TCP.
 if(typeof options.path==='string')return refuse({socketPath:options.path});
 const host=options.host??'localhost',port=Number(options.port);
 // A paired port is the Hub run's origin, http://127.0.0.1:<port>/: only that exact host, never another loopback name or address.
 const target=!loopback(host)||installedPorts.includes(port)?undefined:own.has(port)?'own':host==='127.0.0.1'&&paired.has(port)?'paired':undefined;
 if(!target)return refuse({host,port});
 record({event:'allowed',api:'net.connect',host,port,target});
 return (connect as (...values:unknown[])=>net.Socket).apply(this,args);
} as typeof connect;
// Record which process serves which port, so a check can tie this log to the live server.
const listen=net.Server.prototype.listen;
net.Server.prototype.listen=function(this:net.Server,...args:unknown[]){
 this.once('listening',()=>{
  const address=this.address();
  if(address&&typeof address==='object'){if(!installedPorts.includes(address.port))own.add(address.port);record({event:'listening',address:address.address,port:address.port});}
 });
 return (listen as (...values:unknown[])=>net.Server).apply(this,args);
} as typeof listen;
syncBuiltinESMExports();
record({event:'armed',paired:[...paired],removed});
