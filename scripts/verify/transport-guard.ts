// Preloaded with `node --import` into a verification run's server process.
// It refuses to let the server start unless the simulator is selected, and it
// blocks every outbound HTTP request, UDP socket, Unix socket connection and
// TCP connection except to the process's own listening port, before a packet
// leaves the process. Installed services on loopback are refused like a
// physical device. Each attempt is recorded, so "no physical transport and no
// installed state reached" is an observation rather than an assumption.
import dgram from 'node:dgram';
import {appendFileSync} from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import {syncBuiltinESMExports} from 'node:module';
import net from 'node:net';

const log=process.env.APP_VERIFY_TRANSPORT_LOG;
if(!log)throw new Error('Pixoo transport guard: APP_VERIFY_TRANSPORT_LOG is required');
if(process.env.PIXOO_MODE!=='simulator')throw new Error('Pixoo transport guard: a verification run requires PIXOO_MODE=simulator');
const path:string=log;
/** Ports of the owner's installed services. A paired port may never name one. */
const installed:readonly number[]=[8765,8787,8788,8791,41230,41231];
/**
 * Loopback ports of another disposable run this run may reach, declared
 * explicitly (for a later hub-paired scenario). Empty unless set.
 */
function pairedPorts():ReadonlySet<number> {
 const raw=process.env.APP_VERIFY_PAIRED_PORTS;
 if(raw===undefined||raw==='')return new Set();
 const ports=raw.split(',');
 if(ports.some(port=>!/^\d{1,5}$/.test(port)||Number(port)<1||Number(port)>65535||installed.includes(Number(port))))
  throw new Error('Pixoo transport guard: APP_VERIFY_PAIRED_PORTS must list loopback ports of disposable runs, never an installed port');
 return new Set(ports.map(Number));
}
const paired=pairedPorts();
/** Ports this process listens on; a connection back to one stays inside the run. */
const own=new Set<number>();

function record(entry:Record<string,unknown>):void {
 appendFileSync(path,JSON.stringify({at:new Date().toISOString(),pid:process.pid,...entry})+'\n',{mode:0o600});
}
function refusal():Error {return new Error('Outbound transport is disabled in a Pixoo verification run');}

type Target={host?:string;hostname?:string;port?:number|string;path?:string;socketPath?:string};
/** Host, port and path of an http.request/get call, from a URL string, URL object or options. */
function requestTarget(args:unknown[],defaultPort:number){
 const [first,second]=args,url=typeof first==='string'||first instanceof URL?new URL(String(first)):undefined;
 const options=((url?second:first)??{}) as Target;
 return {host:options.hostname??options.host??url?.hostname??'localhost',port:Number(options.port??(url?.port||defaultPort)),path:options.path??(url?`${url.pathname}${url.search}`:'/')};
}
for(const [name,api,port] of [['http',http,80],['https',https,443]] as const){
 const blocked=(...args:unknown[])=>{record({event:'blocked',api:`${name}.request`,...requestTarget(args,port)});throw refusal();};
 Object.assign(api,{request:blocked,get:blocked});
}
Object.assign(dgram,{createSocket:()=>{record({event:'blocked',api:'dgram.createSocket'});throw refusal();}});

function loopback(host:string):boolean {return host==='localhost'||host==='::1'||/^127\.\d+\.\d+\.\d+$/.test(host)||host==='::ffff:127.0.0.1';}
const connect=net.Socket.prototype.connect;
// Undici (fetch), TLS and raw sockets all reach Socket#connect.
net.Socket.prototype.connect=function(this:net.Socket,...args:unknown[]){
 // net.connect passes its normalized [options, callback] array as the only argument.
 const [first,second]=Array.isArray(args[0])?args[0] as unknown[]:args;
 const options=(typeof first==='object'&&first!==null&&!Array.isArray(first)?first:typeof first==='number'||(typeof first==='string'&&/^\d+$/.test(first))?{port:first,host:typeof second==='string'?second:undefined}:{path:first}) as Target;
 const refuse=(entry:Record<string,unknown>)=>{record({event:'blocked',api:'net.connect',...entry});const error=refusal();process.nextTick(()=>this.destroy(error));return this;};
 if(options.path!==undefined)return refuse({path:String(options.path)});
 const host=options.host??'localhost',port=Number(options.port);
 const target=!loopback(host)?undefined:own.has(port)?'own':paired.has(port)?'paired':undefined;
 if(!target)return refuse({host,port});
 record({event:'allowed',api:'net.connect',host,port,target});
 return (connect as (...values:unknown[])=>net.Socket).apply(this,args);
} as typeof connect;
// Record which process serves which port, so a check can tie this log to the live server.
const listen=net.Server.prototype.listen;
net.Server.prototype.listen=function(this:net.Server,...args:unknown[]){
 this.once('listening',()=>{const address=this.address();if(address&&typeof address==='object'){own.add(address.port);record({event:'listening',address:address.address,port:address.port});}});
 return (listen as (...values:unknown[])=>net.Server).apply(this,args);
} as typeof listen;
syncBuiltinESMExports();
record({event:'armed',paired:[...paired]});
