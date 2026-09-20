import {expect,it} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAgentState} from '@jimmie-potts/agent-state';
import {MonitorStorage} from '../../apps/server/src/monitor-storage.js';
const identity={provider:'codex',client:'cli',hostId:'host',sourceId:'source',sessionId:'session'} as const;
const event={apiVersion:'1.0',identity,turn:{status:'known',id:'turn'},parent:{status:'unknown'},event:{kind:'session.started'},observedAtMs:1000,ordering:{status:'unknown'}};
it('persists shared revisions and labels, refuses a competing owner, restores uncertain',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'monitor-store-'));
 const options={ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}],clock:()=>1000};
 try{
  const first=await createAgentState({...options,storage:new MonitorStorage(directory)});
  try{
   expect((await first.ingest(event)).ok).toBe(true);
   expect((await first.setLabel(identity,'Chosen label')).ok).toBe(true);
   await expect(createAgentState({...options,storage:new MonitorStorage(directory)})).rejects.toThrow();
  }finally{await first.shutdown();}
  const second=await createAgentState({...options,storage:new MonitorStorage(directory)});
  try{expect(second.snapshot()).toMatchObject({revision:2,sessions:[{label:'Chosen label',restartUncertain:true,freshness:'uncertain'}]});}
  finally{await second.shutdown();}
 }finally{await rm(directory,{recursive:true,force:true});}
});
it('enforces the 10000-entry storage journal limit without deleting current state',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'monitor-retention-')),signal=new AbortController().signal;
 const lease=await new MonitorStorage(directory).acquire('owner',signal);
 try{
  const journal=Array.from({length:10001},(_,index)=>({revision:index+1,atMs:1000,sessionKey:'0'.repeat(64),kind:'session.started',outcome:'applied' as const}));
  await lease.commit({expectedRevision:null,revision:10001,atMs:1000,pruneBeforeMs:0,replace:{formatVersion:'1.0',ownerId:'owner',revision:10001,lastCommitAtMs:1000,consumers:[],sessions:[],journal}},signal);
  const state=await lease.load(signal) as {journal:unknown[]};expect(state.journal).toHaveLength(10000);
  await lease.commit({expectedRevision:10001,revision:10002,atMs:86401001,pruneBeforeMs:1001},signal);
  expect(await lease.load(signal)).toMatchObject({revision:10002,journal:[]});
 }finally{await lease.release();await rm(directory,{recursive:true,force:true});}
});
