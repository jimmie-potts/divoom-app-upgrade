import {expect,it} from 'vitest';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createAgentState} from '@jimmie-potts/agent-state';
import {MonitorStorage} from '../../apps/server/src/monitor-storage.js';
const identity={provider:'codex',client:'cli',hostId:'host',sourceId:'source',sessionId:'session'} as const;
const event=(kind:string,sequence:number,turn='turn')=>({apiVersion:'1.0',identity,turn:{status:'known',id:turn},parent:{status:'unknown'},event:{kind},observedAtMs:1000,ordering:{status:'known',epoch:'epoch',sequence}});
const consumers=[{id:'pixoo',clearOnNewTurn:true},{id:'nanoleaf',clearOnNewTurn:false}];
it('rejects privacy canaries, deduplicates, retains acknowledgment and separates aging from health',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'monitor-privacy-'));let now=1000;
 const owner=await createAgentState({storage:new MonitorStorage(directory),ownerId:'owner',consumers,clock:()=>now});
 try{
  expect(await owner.ingest({...event('turn.started',1),prompt:'PRIVATE-CANARY'})).toMatchObject({ok:false});
  await owner.ingest(event('turn.started',1));expect(await owner.ingest(event('turn.started',1))).toMatchObject({outcome:'duplicate'});
  await owner.ingest(event('turn.ended',2));const notice=owner.snapshot().sessions[0]!.notices[0]!;
  await owner.acknowledge(identity,notice.id,'pixoo');
  await owner.ingest(event('turn.started',3,'next'));await owner.ingest(event('turn.ended',2));
  expect(owner.snapshot().sessions[0]!.notices.filter(n=>!n.acknowledgedBy.includes('pixoo'))).toEqual([]);
  now+=300000;expect(owner.snapshot()).toMatchObject({collector:'running',sessions:[{freshness:'uncertain'}]});
  now+=86400000;await owner.maintain();expect(owner.journal()).toEqual([]);
  expect(owner.snapshot().sessions[0]!.notices.length).toBeGreaterThan(0);
  expect((await readFile(join(directory,'state.sqlite'))).includes(Buffer.from('PRIVATE-CANARY'))).toBe(false);
 }finally{await owner.shutdown();await rm(directory,{recursive:true,force:true});}
});
it('rolls back an aborted transaction and releases an OS lease when a process is killed',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'monitor-crash-'));
 const storage=new MonitorStorage(directory),signal=new AbortController().signal;
 const lease=await storage.acquire('owner',signal);
 const initial={formatVersion:'1.0' as const,ownerId:'owner',revision:0,lastCommitAtMs:1000,consumers,sessions:[],journal:[]};
 try{
  await lease.commit({expectedRevision:null,revision:0,atMs:1000,pruneBeforeMs:0,replace:initial},signal);
  await expect(lease.commit({expectedRevision:999,revision:1,atMs:1000,pruneBeforeMs:0},signal)).rejects.toThrow();
  expect(await lease.load(signal)).toMatchObject({revision:0});
 }finally{await lease.release();}
 const moduleUrl=new URL('../../apps/server/dist/monitor-storage.js',import.meta.url).href;
 const code=`const {MonitorStorage}=await import(${JSON.stringify(moduleUrl)}); await new MonitorStorage(process.argv[1]).acquire('child',new AbortController().signal); process.stdout.write('ready'); setInterval(()=>{},1000);`;
 const child=spawn(process.execPath,['--input-type=module','-e',code,directory],{stdio:['ignore','pipe','pipe']});
 try{
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw new Error('child exited');}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('child timeout')),5000).unref())]);
  await expect(storage.acquire('second',signal)).rejects.toThrow();
  child.kill('SIGKILL');await once(child,'exit');
  const recovered=await storage.acquire('owner',signal);try{expect(await recovered.load(signal)).toMatchObject({revision:0});}finally{await recovered.release();}
 }finally{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await once(child,'exit');}await rm(directory,{recursive:true,force:true});}
});
