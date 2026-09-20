import {expect,it} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../../apps/server/src/app.js';
import {createSessionSource,type MonitorConfig} from '../../apps/server/src/monitor-source.js';
import {provisionCredential} from '../../apps/server/src/mcp-config.js';
it('routes remote reads and labels to the owner, reports host loss and never creates local state',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'monitor-remote-')),directory=join(dataDir,'agent-monitor');await mkdir(directory);
 const config:MonitorConfig={version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]};
 await writeFile(join(directory,'config.json'),JSON.stringify(config));
 const token=await provisionCredential(directory,'consumer',['read','control']);
 const app=createApp({dataDir,monitorEnabled:true});
 const remoteDir=await mkdtemp(join(tmpdir(),'monitor-proxy-'));
 let remote:Awaited<ReturnType<typeof createSessionSource>>|undefined;
 try{
  const url=await app.listen({host:'127.0.0.1',port:0});
  const identity={provider:'codex',client:'cli',hostId:'host',sourceId:'source',sessionId:'session'} as const;
  const response=await fetch(url+'/api/monitor/v1/events',{method:'POST',headers:{authorization:`Bearer ${token}`,'x-pixoo-request':'1','content-type':'application/json'},body:JSON.stringify({apiVersion:'1.0',identity,turn:{status:'unknown'},parent:{status:'unknown'},event:{kind:'session.started'},ordering:{status:'unknown'},observedAtMs:1000})});expect(response.status).toBe(200);
  remote=await createSessionSource(remoteDir,{version:1,mode:'remote',ownerId:'owner',endpoint:url+'/api/monitor/v1',token});
  await remote.refresh();expect(remote.view()).toMatchObject({connection:'current',snapshot:{revision:1}});
  const command={operation:'label' as const,requestId:remote.view().nextRequestId!,identity,label:'Mine'};
  expect(await remote.command(command)).toMatchObject({ok:true,revision:2});
  expect(await remote.command(command)).toMatchObject({ok:true,revision:2});
  await expect(remote.command({...command,label:'Conflict'})).rejects.toMatchObject({code:'request-conflict',status:409});
  await remote.refresh();expect(remote.view().snapshot?.sessions[0]?.label).toBe('Mine');
  await app.close();await remote.refresh();expect(remote.view()).toMatchObject({connection:'stale',nextRequestId:null,snapshot:{revision:2}});
  await expect(remote.command(command)).rejects.toThrow();expect(await readdir(remoteDir)).toEqual([]);
 }finally{await remote?.close();await app.close();await rm(dataDir,{recursive:true,force:true});await rm(remoteDir,{recursive:true,force:true});}
});
it('quiesces, fences restart and transfers unchanged identities and notices to empty storage',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'monitor-migration-')),destination=await mkdtemp(join(tmpdir(),'monitor-destination-'));
 const config:MonitorConfig={version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]};
 const source=await createSessionSource(directory,config,()=>1000);
 try{
  const identity={provider:'codex',client:'cli',hostId:'host',sourceId:'source',sessionId:'session'};
  await source.ingest({apiVersion:'1.0',identity,turn:{status:'known',id:'turn'},parent:{status:'unknown'},event:{kind:'turn.ended'},ordering:{status:'known',epoch:'epoch',sequence:1},observedAtMs:1000});
  const before=source.view().snapshot!;
  const exported=await source.command({operation:'quiesce',requestId:source.view().nextRequestId!});
  expect(await source.ingest({})).toMatchObject({ok:false});await source.close();
  await expect(createSessionSource(directory,config)).rejects.toThrow('quiesced');
  await writeFile(join(destination,'import.json'),JSON.stringify(exported));
  const replacement=await createSessionSource(destination,config,()=>1000);
  try{expect(replacement.view().snapshot).toMatchObject({revision:before.revision,sessions:[{identity,notices:before.sessions[0]!.notices}]});}
  finally{await replacement.close();}
 }finally{await source.close();await rm(directory,{recursive:true,force:true});await rm(destination,{recursive:true,force:true});}
});
