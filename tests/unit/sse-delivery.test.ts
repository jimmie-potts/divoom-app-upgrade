import {EventEmitter} from 'node:events';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {FastifyInstance,FastifyReply,FastifyRequest} from 'fastify';
import type {Ticket} from '@jimmie-potts/device-contracts';
import {Events} from '../../apps/server/src/events.js';
import {ControllerEvents} from '../../apps/server/src/controller-events.js';
import type {ControllerState} from '../../apps/server/src/controller-state.js';
type Handler=(request:FastifyRequest,reply:FastifyReply)=>unknown;
const deferred=()=>{let resolve!:()=>void,reject!:(error:Error)=>void;const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
class Raw extends EventEmitter {
 headersSent=false;closed=false;acceptsWrites=true;
 writes:Array<{body:string;headersSent:boolean;closed:boolean}>=[];
 writeHead=vi.fn(()=>{this.headersSent=true;});
 write=vi.fn((body:string)=>{this.writes.push({body,headersSent:this.headersSent,closed:this.closed});return this.acceptsWrites;});
 destroy=vi.fn(()=>this.disconnect());
 end=vi.fn(()=>{this.emit('finish');this.disconnect();});
 disconnect(){if(this.closed)return;this.closed=true;this.emit('close');}
 drain(){this.acceptsWrites=true;this.emit('drain');}
}
const settle=()=>vi.advanceTimersByTimeAsync(0);
function fixture(kind:'browser'|'native',authenticated=true){
 let revision=0,handler!:Handler;
 const authenticate=vi.fn<(request:FastifyRequest)=>Promise<void>>(()=>Promise.resolve()),refreshCatalog=vi.fn(():Promise<void>=>Promise.resolve());
 // Protocol schema coverage stays in the owning integration suites.
 const state={feedEpoch:'characterization-feed',refreshCatalog,snapshot:(cursor:Ticket)=>({cursor,revision})} as unknown as ControllerState;
 const feed=kind==='native'?new ControllerEvents(state,authenticate):new Events(()=>({revision}),authenticated?authenticate:undefined);
 const app={server:{},get:(_path:string,callback:Handler)=>{handler=callback;}} as unknown as FastifyInstance;
 feed.register(app);
 const connect=()=>{const raw=new Raw(),request={headers:{}} as FastifyRequest,reply={raw,hijack:vi.fn()} as unknown as FastifyReply;return {raw,start:()=>handler(request,reply)};};
 return {feed,authenticate,refreshCatalog,connect,publish:()=>{revision++;feed.publish();}};
}
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});

it('writes browser delivery synchronously when continuous authentication is absent',()=>{
 const f=fixture('browser',false),c=f.connect();try{c.start();expect(c.raw.writes).toHaveLength(1);f.publish();expect(c.raw.writes).toHaveLength(2);expect(f.authenticate).not.toHaveBeenCalled();expect(c.raw.writes.every(w=>w.headersSent&&!w.closed)).toBe(true);}finally{f.feed.close();}
});
it('reserves native registration before catalog work and writes only after headers',async()=>{
 const f=fixture('native'),gate=deferred(),clients=Array.from({length:16},()=>f.connect());f.refreshCatalog.mockReturnValue(gate.promise);
 try{
  const registrations=clients.map(c=>Promise.resolve(c.start()));f.publish();await vi.advanceTimersByTimeAsync(1000);
  for(const c of clients){expect(c.raw.writeHead).not.toHaveBeenCalled();expect(c.raw.write).not.toHaveBeenCalled();}
  expect(f.authenticate).not.toHaveBeenCalled();await expect(f.connect().start()).rejects.toMatchObject({code:'capacity'});expect(f.refreshCatalog).toHaveBeenCalledTimes(16);
  gate.resolve();await Promise.all(registrations);await settle();
  for(const c of clients){expect(c.raw.writes).toHaveLength(1);expect(c.raw.writes.every(w=>w.headersSent&&!w.closed)).toBe(true);}
 }finally{gate.resolve();f.feed.close();}
});
it.each(['catalog','authentication'])('shutdown during native registration %s prevents late headers',async stage=>{
 const f=fixture('native'),gate=deferred(),c=f.connect();
 if(stage==='catalog')f.refreshCatalog.mockReturnValueOnce(gate.promise);else f.authenticate.mockReturnValueOnce(gate.promise);
 try{const result=Promise.resolve(c.start()).catch(error=>error);await settle();f.feed.close();gate.resolve();expect(await result).toMatchObject({code:'capacity'});expect(c.raw.writeHead).not.toHaveBeenCalled();expect(c.raw.write).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);}finally{f.feed.close();}
});
it('rejected native registrations release their reserved slots',async()=>{
 const f=fixture('native');try{for(let i=0;i<20;i++){f.authenticate.mockRejectedValueOnce(new Error('denied'));const c=f.connect();await expect(c.start()).rejects.toThrow('denied');expect(c.raw.writeHead).not.toHaveBeenCalled();}const c=f.connect();await c.start();await settle();expect(c.raw.writes).toHaveLength(1);}finally{f.feed.close();}
});
for(const kind of ['browser','native'] as const){
 it(`${kind} serializes authorization and delivery without blocking publication`,async()=>{
  const f=fixture(kind),c=f.connect(),gate=deferred();try{await c.start();await settle();const count=f.authenticate.mock.calls.length;f.authenticate.mockReturnValueOnce(gate.promise);f.publish();f.publish();f.publish();expect(f.authenticate).toHaveBeenCalledTimes(count+1);expect(c.raw.writes).toHaveLength(1);gate.resolve();await settle();expect(c.raw.writes.slice(1).map(w=>JSON.parse(w.body.split('data: ')[1]!.trim())).map(v=>kind==='browser'?v.revision:v.snapshot.revision)).toEqual([1,2,3]);expect(c.raw.writes.every(w=>w.headersSent&&!w.closed)).toBe(true);}finally{gate.resolve();f.feed.close();}
 });
 it(`${kind} counts the awaiting-auth message within the 32-entry queue`,async()=>{
  const f=fixture(kind),c=f.connect(),gate=deferred();try{await c.start();await settle();f.authenticate.mockReturnValueOnce(gate.promise);for(let i=0;i<32;i++)f.publish();expect(c.raw.destroy).not.toHaveBeenCalled();f.publish();expect(c.raw.destroy).toHaveBeenCalledOnce();gate.resolve();await settle();expect(c.raw.writes).toHaveLength(1);}finally{gate.resolve();f.feed.close();}
 });
 it.each(['reject','disconnect','shutdown'])(`${kind} discards queued messages after %s during authentication`,async action=>{
  const f=fixture(kind),c=f.connect(),gate=deferred();try{await c.start();await settle();f.authenticate.mockReturnValueOnce(gate.promise);f.publish();f.publish();if(action==='reject')gate.reject(new Error('denied'));else{if(action==='shutdown')f.feed.close();else c.raw.disconnect();gate.resolve();}await settle();expect(c.raw.writes).toHaveLength(1);const calls=f.authenticate.mock.calls.length;f.publish();await vi.advanceTimersByTimeAsync(15000);expect(f.authenticate).toHaveBeenCalledTimes(calls);expect(c.raw.writes).toHaveLength(1);if(action==='shutdown')expect(vi.getTimerCount()).toBe(0);}finally{gate.resolve();f.feed.close();}
 });
 it(`${kind} drains before the next publication and clears the old deadline`,async()=>{
  const f=fixture(kind),c=f.connect();try{await c.start();await settle();c.raw.acceptsWrites=false;f.publish();await settle();c.raw.drain();f.publish();await settle();expect(c.raw.writes).toHaveLength(3);await vi.advanceTimersByTimeAsync(5000);expect(c.raw.destroy).not.toHaveBeenCalled();}finally{f.feed.close();}
 });
 it(`${kind} rechecks each second and sends a heartbeat at 15 seconds`,async()=>{
  const f=fixture(kind),c=f.connect();try{await c.start();await settle();const count=f.authenticate.mock.calls.length;await vi.advanceTimersByTimeAsync(14000);expect(f.authenticate).toHaveBeenCalledTimes(count+14);expect(c.raw.writes).toHaveLength(1);await vi.advanceTimersByTimeAsync(1000);expect(c.raw.writes.at(-1)?.body).toBe(': heartbeat\n\n');f.feed.close();expect(vi.getTimerCount()).toBe(0);}finally{f.feed.close();}
 });
}
it('browser can drain during the next authorization while native rejects before authorization',async()=>{
 for(const kind of ['browser','native'] as const){const f=fixture(kind),c=f.connect(),gate=deferred();try{await c.start();await settle();c.raw.acceptsWrites=false;f.publish();await settle();const count=f.authenticate.mock.calls.length;f.authenticate.mockReturnValueOnce(gate.promise);f.publish();if(kind==='native'){expect(c.raw.destroy).toHaveBeenCalledOnce();expect(f.authenticate).toHaveBeenCalledTimes(count);}else{expect(c.raw.destroy).not.toHaveBeenCalled();c.raw.drain();gate.resolve();await settle();expect(c.raw.writes).toHaveLength(3);expect(c.raw.destroy).not.toHaveBeenCalled();}}finally{gate.resolve();f.feed.close();}}
});
it('browser authenticates blocked empty rechecks but native terminates before authentication',async()=>{
 for(const kind of ['browser','native'] as const){const f=fixture(kind),c=f.connect();try{await c.start();await settle();c.raw.acceptsWrites=false;f.publish();await settle();const count=f.authenticate.mock.calls.length;await vi.advanceTimersByTimeAsync(1000);expect(c.raw.writes).toHaveLength(2);if(kind==='native'){expect(c.raw.destroy).toHaveBeenCalledOnce();expect(f.authenticate).toHaveBeenCalledTimes(count);}else{expect(c.raw.destroy).not.toHaveBeenCalled();expect(f.authenticate).toHaveBeenCalledTimes(count+1);await vi.advanceTimersByTimeAsync(3999);expect(c.raw.destroy).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1);expect(c.raw.destroy).toHaveBeenCalledOnce();}}finally{f.feed.close();}}
});
it('a false write with queued work preserves each feeds existing authorization order',async()=>{
 for(const kind of ['browser','native'] as const){const f=fixture(kind),c=f.connect(),first=deferred(),second=deferred();try{await c.start();await settle();const count=f.authenticate.mock.calls.length;f.authenticate.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);f.publish();f.publish();c.raw.acceptsWrites=false;first.resolve();await settle();if(kind==='native'){expect(c.raw.destroy).toHaveBeenCalledOnce();expect(f.authenticate).toHaveBeenCalledTimes(count+1);}else{expect(c.raw.destroy).not.toHaveBeenCalled();expect(f.authenticate).toHaveBeenCalledTimes(count+2);c.raw.drain();second.resolve();await settle();expect(c.raw.writes).toHaveLength(3);expect(c.raw.destroy).not.toHaveBeenCalled();}}finally{first.resolve();second.resolve();f.feed.close();}}
});
it('unauthenticated browser heartbeats and drain deadlines remain independent',async()=>{
 const f=fixture('browser',false),c=f.connect();try{c.start();await vi.advanceTimersByTimeAsync(14999);expect(c.raw.writes).toHaveLength(1);await vi.advanceTimersByTimeAsync(1);expect(c.raw.writes.at(-1)?.body).toBe(': heartbeat\n\n');expect(f.authenticate).not.toHaveBeenCalled();c.raw.acceptsWrites=false;f.publish();await vi.advanceTimersByTimeAsync(4999);expect(c.raw.destroy).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1);expect(c.raw.destroy).toHaveBeenCalledOnce();f.feed.close();expect(vi.getTimerCount()).toBe(0);}finally{f.feed.close();}
});

for(const kind of ['browser','native'] as const){
 it.each(['disconnect','shutdown'])(`${kind} releases a blocked drain listener and deadline on %s`,async action=>{
  const f=fixture(kind),c=f.connect();try{await c.start();await settle();c.raw.acceptsWrites=false;f.publish();await settle();expect(c.raw.listenerCount('drain')).toBe(1);if(action==='disconnect')c.raw.disconnect();else f.feed.close();expect(c.raw.listenerCount('drain')).toBe(0);expect(vi.getTimerCount()).toBe(action==='disconnect'?1:0);}finally{f.feed.close();}
 });
}
