import {expect,it} from 'vitest';
import {DashboardPager} from '../../apps/server/src/agent-dashboard.js';
import {mkdtemp,mkdir,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../../apps/server/src/app.js';
import {createSessionSource,type MonitorConfig} from '../../apps/server/src/monitor-source.js';
import {provisionCredential} from '../../apps/server/src/mcp-config.js';
it('routes remote reads, labels and acknowledgment to the owner, reports host loss and never creates local state',async()=>{
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
  expect(new DashboardPager().layout(remote.view(),0).rows[0]?.label).toBe('Mine');
  const ended=await fetch(url+'/api/monitor/v1/events',{method:'POST',headers:{authorization:`Bearer ${token}`,'x-pixoo-request':'1','content-type':'application/json'},body:JSON.stringify({apiVersion:'1.0',identity,turn:{status:'known',id:'turn'},parent:{status:'unknown'},event:{kind:'turn.ended'},ordering:{status:'known',epoch:'epoch',sequence:1},observedAtMs:1001})});expect(ended.status).toBe(200);
  await remote.refresh();const notice=remote.view().snapshot!.sessions[0]!.notices[0]!;
  const acknowledgment={operation:'acknowledge' as const,requestId:remote.view().nextRequestId!,identity,noticeId:notice.id,consumerId:'pixoo'};
  expect(await remote.command(acknowledgment)).toMatchObject({ok:true,revision:4});
  expect(await remote.command(acknowledgment)).toMatchObject({ok:true,revision:4});
  await remote.refresh();expect(remote.view().snapshot!.sessions[0]!.notices[0]!.acknowledgedBy).toEqual(['pixoo']);
  await app.close();await remote.refresh();expect(remote.view()).toMatchObject({connection:'stale',nextRequestId:null,snapshot:{revision:4}});
  expect(new DashboardPager().layout(remote.view(),0)).toMatchObject({connection:'stale',collector:'running',rows:[{uncertain:true,noticeIds:[]}]});
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
it('marks malformed remote mutation responses stale and clears replay admission',async()=>{
 const {createServer}=await import('node:http');
 const {MemoryStorage,createAgentState}=await import('@jimmie-potts/agent-state');
 const owner=await createAgentState({storage:new MemoryStorage(),ownerId:'owner',consumers:[]});
 const server=createServer((request,response)=>{response.setHeader('content-type','application/json');response.end(JSON.stringify(request.method==='POST'?{}:{apiVersion:'1.0',ownerId:'owner',connection:'current',admissionRejected:0,snapshot:owner.snapshot(),nextRequestId:'epoch:1'}));});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('address');
 const source=await createSessionSource('/unused',{version:1,mode:'remote',ownerId:'owner',endpoint:`http://127.0.0.1:${address.port}/api/monitor/v1`,token:'a'.repeat(43)});
 try{
  await source.refresh();expect(source.view().connection).toBe('current');
  await expect(source.command({operation:'label',requestId:'epoch:1',identity:{provider:'codex',client:'cli',hostId:'host',sourceId:'source',sessionId:'session'},label:null})).rejects.toThrow();
  expect(source.view()).toMatchObject({connection:'stale',nextRequestId:null});
 }finally{await source.close();await owner.shutdown();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
it('imports only into empty stores and explicitly resumes the current quiesced copy',async()=>{
 const {monitorOperation}=await import('../../apps/server/src/monitor-cli.js');
 const {writeMonitorJson}=await import('../../apps/server/src/monitor-source.js');
 const root=await mkdtemp(join(tmpdir(),'monitor-cli-')),old=join(root,'old','agent-monitor'),next=join(root,'new','agent-monitor');await mkdir(old,{recursive:true});await mkdir(next,{recursive:true});
 const config:MonitorConfig={version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]};
 const source=await createSessionSource(old,config,()=>1000);
 let replacement:Awaited<ReturnType<typeof createSessionSource>>|undefined;
 try{
  await source.ingest({apiVersion:'1.0',identity:{provider:'codex',client:'cli',hostId:'host',sourceId:'source',sessionId:'session'},turn:{status:'known',id:'turn'},parent:{status:'unknown'},event:{kind:'turn.ended'},ordering:{status:'known',epoch:'epoch',sequence:1},observedAtMs:1000});
  const exported=await source.command({operation:'quiesce',requestId:source.view().nextRequestId!});
  await writeMonitorJson(join(root,'export.json'),exported);
  await expect(monitorOperation('resume',join(root,'old'),'replacement-stopped-and-state-current')).rejects.toThrow();
  await source.close();
  await monitorOperation('import',join(root,'new'),join(root,'export.json'));
  replacement=await createSessionSource(next,config,()=>1000);const snapshot=replacement.view().snapshot!;
  await expect(monitorOperation('import',join(root,'new'),join(root,'export.json'))).rejects.toThrow();
  await replacement.close();await expect(monitorOperation('import',join(root,'new'),join(root,'export.json'))).rejects.toThrow();
  await expect(monitorOperation('resume',join(root,'old'),'guess')).rejects.toThrow();
  await monitorOperation('resume',join(root,'old'),'replacement-stopped-and-state-current');
  const rollback=await createSessionSource(old,config,()=>1000);
  try{expect(rollback.view().snapshot).toEqual(snapshot);}finally{await rollback.close();}
 }finally{await replacement?.close();await source.close();await rm(root,{recursive:true,force:true});}
});
it('serves remote filters and change notifications through the same protected HTTP facade',async()=>{
 const root=await mkdtemp(join(tmpdir(),'monitor-facades-'));const ownerDir=join(root,'owner'),proxyDir=join(root,'proxy');
 await mkdir(join(ownerDir,'agent-monitor'),{recursive:true});await mkdir(join(proxyDir,'agent-monitor'),{recursive:true});
 await writeFile(join(ownerDir,'agent-monitor','config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]}));
 const ownerToken=await provisionCredential(join(ownerDir,'agent-monitor'),'remote',['control']);
 const proxyToken=await provisionCredential(join(proxyDir,'agent-monitor'),'reader',['read']);
 const owner=createApp({dataDir:ownerDir,monitorEnabled:true});let proxy:ReturnType<typeof createApp>|undefined;const abort=new AbortController();
 try{
  const address=await owner.listen({host:'127.0.0.1',port:0});
  await writeFile(join(proxyDir,'agent-monitor','config.json'),JSON.stringify({version:1,mode:'remote',ownerId:'owner',endpoint:address+'/api/monitor/v1',token:ownerToken}));
  proxy=createApp({dataDir:proxyDir,monitorEnabled:true});const url=await proxy.listen({host:'127.0.0.1',port:0}),headers={authorization:`Bearer ${proxyToken}`};
  expect((await fetch(url+'/api/monitor/v1/sessions')).status).toBe(401);
  const stream=await fetch(url+'/api/monitor/v1/changes',{headers,signal:abort.signal}),reader=stream.body!.getReader();await reader.read();
  await fetch(address+'/api/monitor/v1/events',{method:'POST',headers:{authorization:`Bearer ${ownerToken}`,'content-type':'application/json','x-pixoo-request':'1'},body:JSON.stringify({apiVersion:'1.0',identity:{provider:'codex',client:'cli',hostId:'host',sourceId:'source',sessionId:'selected'},turn:{status:'unknown'},parent:{status:'unknown'},event:{kind:'session.started'},ordering:{status:'unknown'},observedAtMs:1000})});
  const view=await(await fetch(url+'/api/monitor/v1/sessions?q=selected&provider=codex',{headers})).json();expect(view).toMatchObject({snapshot:{revision:1},matches:[{sessionId:'selected'}]});
  expect((await(await fetch(url+'/api/monitor/v1/sessions?q=absent',{headers})).json()).matches).toEqual([]);
  const notification=await Promise.race([reader.read(),new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('remote-notification-timeout')),3000).unref())]);expect(new TextDecoder().decode(notification.value)).toContain('"revision":1');
  expect(await readdir(join(proxyDir,'agent-monitor'))).not.toContain('state');
 }finally{abort.abort();await proxy?.close();await owner.close();await rm(root,{recursive:true,force:true});}
},10000);
