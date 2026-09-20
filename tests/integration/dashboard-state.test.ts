import {expect,it} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSessionSource,type MonitorConfig} from '../../apps/server/src/monitor-source.js';
import {DashboardPager} from '../../apps/server/src/agent-dashboard.js';
import {syntheticDashboardRenditions} from '../../apps/server/src/dashboard-examples.js';
import {FakeDeviceAdapter} from '../../packages/device/src/fake.js';

it('projects durable notices after restart and respects dismissal and new-turn policies',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'dashboard-state-'));
 const config:MonitorConfig={version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true},{id:'keep',clearOnNewTurn:false}]};
 let source=await createSessionSource(directory,config,()=>1000);
 const identity={provider:'codex',client:'cli',hostId:'h',sourceId:'s',sessionId:'task'} as const;
 const ingest=(kind:string,turn:string,sequence:number)=>source.ingest({apiVersion:'1.0',identity,turn:{status:'known',id:turn},parent:{status:'top-level'},event:{kind},ordering:{status:'known',epoch:'e',sequence},observedAtMs:1000});
 const row=(consumer='pixoo')=>new DashboardPager(consumer).layout(source.view(),0).rows[0]!;
 try{
  expect(await ingest('turn.ended','t1',1)).toMatchObject({ok:true});const notice=row().noticeIds[0]!;
  expect(notice).toBeTruthy();expect(row().activity).toBe('idle');
  await source.close();source=await createSessionSource(directory,config,()=>1000);
  expect(row()).toMatchObject({noticeIds:[notice],uncertain:true});
  expect(await source.command({operation:'acknowledge',identity,noticeId:notice,consumerId:'pixoo',requestId:source.view().nextRequestId!})).toMatchObject({ok:true});
  expect(row().noticeIds).toEqual([]);expect(row('keep').noticeIds).toEqual([notice]);
  expect(await ingest('turn.started','t2',2)).toMatchObject({ok:true});
  expect(row()).toMatchObject({activity:'active',noticeIds:[]});expect(row('keep').noticeIds).toEqual([notice]);
  expect(source.view().snapshot!.sessions[0]!.read).toBe('unknown');
  expect(await ingest('turn.ended','t2',3)).toMatchObject({ok:true});expect(row().noticeIds).toHaveLength(1);
  expect(await ingest('turn.started','t3',4)).toMatchObject({ok:true});expect(row().noticeIds).toEqual([]);
 }finally{await source.close();await rm(directory,{recursive:true,force:true});}
});
it('sends exact synthetic renderer pixels through the deterministic fake boundary',async()=>{
 const fake=new FakeDeviceAdapter();
 for(const {rendition} of syntheticDashboardRenditions()){
  const result=await fake.uploadAnimation({frames:[{rgb:new Uint8Array(rendition.rgb),delayMs:1000}]},{generation:fake.generation});
  expect(result.ok).toBe(true);const effect=fake.effects.at(-1)!;
  expect(effect.kind).toBe('frame');if(effect.kind==='frame')expect(Array.from(effect.frame.rgb)).toEqual(rendition.rgb);
 }
});
