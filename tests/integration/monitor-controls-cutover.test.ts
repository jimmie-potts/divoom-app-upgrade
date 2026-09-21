import {expect,it} from 'vitest';
import {mkdtemp,mkdir,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../../apps/server/src/app.js';
import {provisionCredential} from '../../apps/server/src/mcp-config.js';
it('retains the selected view while labels and notices follow owner cutover and rollback',async()=>{
 const root=await mkdtemp(join(tmpdir(),'monitor-controls-cutover-')),local=join(root,'local'),replacement=join(root,'replacement'),rollback=join(root,'rollback');
 const config={version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]};
 for(const dir of [local,replacement,rollback]){await mkdir(join(dir,'agent-monitor'),{recursive:true});await provisionCredential(join(dir,'agent-monitor'),'reader',['read']);}
 await writeFile(join(local,'agent-monitor','config.json'),JSON.stringify(config));
 const token=await provisionCredential(join(local,'agent-monitor'),'writer',['control']);
 let app=createApp({dataDir:local,monitorEnabled:true,monitorRenderCadenceMs:1});let owner:ReturnType<typeof createApp>|undefined;
 const identity={provider:'codex',client:'cli',hostId:'host',sourceId:'source',sessionId:'chosen'};
 const browser={'x-pixoo-request':'1'},machine={...browser,authorization:`Bearer ${token}`};
 const read=async()=> (await app.inject('/api/integration/v1/view')).json();
 const label=async(text:string)=>{const view=await read();expect((await app.inject({method:'POST',url:'/api/integration/v1/shared-actions',headers:browser,payload:{operation:'label',requestId:view.source.nextRequestId,identity,label:text}})).json().ok).toBe(true);};
 try{
  expect((await app.inject({method:'POST',url:'/api/monitor/v1/events',headers:machine,payload:{apiVersion:'1.0',identity,projectId:'project',turn:{status:'known',id:'turn'},parent:{status:'top-level'},ordering:{status:'known',epoch:'epoch',sequence:1},observedAtMs:Date.now(),event:{kind:'turn.ended'}}})).json().ok).toBe(true);
  const first=await read();
  await app.inject({method:'POST',url:'/api/integration/v1/commands',headers:browser,payload:{apiVersion:'pixoo-integration/1.0',requestId:first.integration.nextRequestId,expectedConfigurationRevision:first.integration.configurationRevision,expectedGeneration:first.integration.generation,action:{operation:'view',filter:{projectId:'project',session:identity},cadenceMs:2000}}});
  await label('Before cutover');
  const exported=(await app.inject({method:'POST',url:'/api/monitor/v1/commands',headers:machine,payload:{operation:'quiesce',requestId:(await read()).source.nextRequestId}})).json();await app.close();
  await writeFile(join(replacement,'agent-monitor','config.json'),JSON.stringify(config));await writeFile(join(replacement,'agent-monitor','import.json'),JSON.stringify(exported));
  const remoteToken=await provisionCredential(join(replacement,'agent-monitor'),'proxy',['read','control']);
  owner=createApp({dataDir:replacement,monitorEnabled:true});let address=await owner.listen({host:'127.0.0.1',port:0});
  const point=async()=>writeFile(join(local,'agent-monitor','config.json'),JSON.stringify({version:1,mode:'remote',ownerId:'owner',endpoint:address+'/api/monitor/v1',token:remoteToken}));
  await point();app=createApp({dataDir:local,monitorEnabled:true,monitorRenderCadenceMs:1});
  expect((await read()).integration.configuration).toMatchObject({filter:{projectId:'project',session:identity},cadenceMs:2000});
  await label('Remote label');let view=await read();const notice=view.source.snapshot.sessions[0].notices[0];
  expect((await app.inject({method:'POST',url:'/api/integration/v1/shared-actions',headers:browser,payload:{operation:'acknowledge',requestId:view.source.nextRequestId,identity,noticeId:notice.id}})).json().ok).toBe(true);
  view=await read();expect(view.source.snapshot.sessions[0]).toMatchObject({label:'Remote label',notices:[{acknowledgedBy:['pixoo']}]});
  const current=(await owner.inject({method:'POST',url:'/api/monitor/v1/commands',headers:{host:new URL(address).host,...browser,authorization:`Bearer ${remoteToken}`},payload:{operation:'quiesce',requestId:view.source.nextRequestId}})).json();
  await owner.close();await app.close();
  await writeFile(join(rollback,'agent-monitor','config.json'),JSON.stringify(config));await writeFile(join(rollback,'agent-monitor','import.json'),JSON.stringify(current));
  // Roll back to an embedded owner in clean storage using the latest export.
  owner=createApp({dataDir:rollback,monitorEnabled:true});const rollbackToken=await provisionCredential(join(rollback,'agent-monitor'),'proxy',['read','control']);address=await owner.listen({host:'127.0.0.1',port:0});
  await writeFile(join(local,'agent-monitor','config.json'),JSON.stringify({version:1,mode:'remote',ownerId:'owner',endpoint:address+'/api/monitor/v1',token:rollbackToken}));
  app=createApp({dataDir:local,monitorEnabled:true,monitorRenderCadenceMs:1});await label('After rollback');view=await read();
  expect(view.source.snapshot.sessions[0]).toMatchObject({label:'After rollback',notices:[{acknowledgedBy:['pixoo']}]});expect(view.integration.configuration.filter.projectId).toBe('project');
  expect(view.integration.participating).toBe(false);expect(await readdir(join(local,'agent-monitor'))).toContain('quiesced.json');
  await owner.close();view=await read();expect(view.source.connection).toBe('stale');expect(view.source.nextRequestId).toBeNull();
 }finally{await app.close();await owner?.close();await rm(root,{recursive:true,force:true});}
},15000);
