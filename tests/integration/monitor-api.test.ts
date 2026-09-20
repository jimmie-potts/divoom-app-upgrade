import {expect,it} from 'vitest';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../../apps/server/src/app.js';
import {provisionCredential} from '../../apps/server/src/mcp-config.js';
it('authenticates embedded monitoring and persists an event independently of playback',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'monitor-api-'));
 await mkdir(join(directory,'agent-monitor'));
 await writeFile(join(directory,'agent-monitor','config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]}));
 const token=await provisionCredential(join(directory,'agent-monitor'),'test',['read','control']);
 const app=createApp({dataDir:directory,monitorEnabled:true});
 const headers={authorization:`Bearer ${token}`,'x-pixoo-request':'1'};
 try{
  expect((await app.inject('/api/monitor/v1/sessions')).statusCode).toBe(401);
  const before=await app.inject({url:'/api/monitor/v1/sessions',headers});expect(before.statusCode).toBe(200);
  const response=await app.inject({method:'POST',url:'/api/monitor/v1/events',headers,payload:{apiVersion:'1.0',identity:{provider:'codex',client:'cli',hostId:'host',sourceId:'source',sessionId:'session'},turn:{status:'unknown'},parent:{status:'unknown'},event:{kind:'session.started'},ordering:{status:'unknown'},observedAtMs:1000}});
  expect(response.statusCode).toBe(200);expect(response.json().ok).toBe(true);
  const snapshot=(await app.inject({url:'/api/monitor/v1/sessions',headers})).json();expect(snapshot.snapshot.sessions).toHaveLength(1);
  expect((await app.inject('/api/health')).json().mode).toBe('simulator');
 }finally{await app.close();await rm(directory,{recursive:true,force:true});}
});
it('preserves origin/header protections, scopes, privacy, filtering and command replay',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'monitor-protection-'));await mkdir(join(directory,'agent-monitor'));
 await writeFile(join(directory,'agent-monitor','config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]}));
 const token=await provisionCredential(join(directory,'agent-monitor'),'writer',['control']);
 const reader=await provisionCredential(join(directory,'agent-monitor'),'reader',['read']);
 const app=createApp({dataDir:directory,monitorEnabled:true}),url='/api/monitor/v1';
 const headers={authorization:`Bearer ${token}`,'x-pixoo-request':'1'};
 const identity={provider:'claude',client:'code',hostId:'host',sourceId:'source',sessionId:'session'} as const;
 const event={apiVersion:'1.0',identity,turn:{status:'known',id:'turn'},parent:{status:'unknown'},event:{kind:'turn.ended'},ordering:{status:'known',epoch:'epoch',sequence:1},observedAtMs:1000};
 try{
  expect((await app.inject({url:url+'/sessions',headers:{...headers,origin:'https://foreign.test'}})).statusCode).toBe(403);
  expect((await app.inject({method:'POST',url:url+'/events',headers:{authorization:`Bearer ${token}`},payload:event})).statusCode).toBe(403);
  expect((await app.inject({method:'POST',url:url+'/events',headers:{...headers,authorization:`Bearer ${reader}`},payload:event})).statusCode).toBe(403);
  expect((await app.inject({method:'POST',url:url+'/events',headers,payload:{...event,prompt:'PRIVATE-CANARY'}})).json()).toMatchObject({ok:false,code:'invalid-event'});
  expect((await app.inject({method:'POST',url:url+'/events',headers,payload:{padding:'x'.repeat(2049)}})).statusCode).toBe(413);
  expect((await app.inject({method:'POST',url:url+'/events',headers,payload:event})).json().ok).toBe(true);
  let view=(await app.inject({url:url+'/sessions',headers})).json();
  const label={operation:'label',requestId:view.nextRequestId,identity,label:'Chosen'};
  const send=(payload:Record<string,unknown>)=>app.inject({method:'POST',url:url+'/commands',headers,payload});
  expect((await send(label)).json()).toMatchObject({ok:true,revision:2});expect((await send(label)).json()).toMatchObject({ok:true,revision:2});
  expect((await send({...label,label:'Other'})).statusCode).toBe(409);
  expect((await app.inject({url:url+'/sessions?q=Chosen&provider=claude',headers})).json().matches).toHaveLength(1);
  expect((await app.inject({url:url+'/sessions?q=Other',headers})).json().matches).toHaveLength(0);
  view=(await app.inject({url:url+'/sessions',headers})).json();
  expect((await send({operation:'acknowledge',requestId:view.nextRequestId,identity,consumerId:'pixoo',noticeId:view.snapshot.sessions[0].notices[0].id})).json().ok).toBe(true);
  const after=(await app.inject({url:url+'/sessions',headers})).json();expect(after.snapshot.sessions[0].read).toBe('unknown');expect(after.snapshot.sessions[0].notices[0].acknowledgedBy).toEqual(['pixoo']);
 }finally{await app.close();await rm(directory,{recursive:true,force:true});}
});
it('keeps parent/child snapshots valid when a filter selects only the parent',async()=>{
 const {validateSnapshot}=await import('@jimmie-potts/agent-state');
 const directory=await mkdtemp(join(tmpdir(),'monitor-child-'));await mkdir(join(directory,'agent-monitor'));
 await writeFile(join(directory,'agent-monitor','config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]}));
 const token=await provisionCredential(join(directory,'agent-monitor'),'writer',['control']);const headers={authorization:`Bearer ${token}`,'x-pixoo-request':'1'};
 const app=createApp({dataDir:directory,monitorEnabled:true}),parent={provider:'codex',client:'cli',hostId:'host',sourceId:'source',sessionId:'parent'};
 try{
  for(const sessionId of ['parent','child']){
   const result=await app.inject({method:'POST',url:'/api/monitor/v1/events',headers,payload:{apiVersion:'1.0',identity:{...parent,sessionId},turn:{status:'known',id:'turn'},parent:sessionId==='parent'?{status:'unknown'}:{status:'known',identity:parent},event:{kind:'turn.started'},ordering:{status:'known',epoch:'epoch',sequence:1},observedAtMs:Date.now()}});
   expect(result.json().ok).toBe(true);
  }
  const filtered=(await app.inject({url:'/api/monitor/v1/sessions?q=parent',headers})).json();
  expect(filtered.matches).toEqual([parent]);expect(filtered.snapshot.sessions).toHaveLength(2);expect(validateSnapshot(filtered.snapshot).ok).toBe(true);
 }finally{await app.close();await rm(directory,{recursive:true,force:true});}
});
it('serves authenticated exact dashboard renditions without taking over the simulator',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'monitor-rendition-'));await mkdir(join(directory,'agent-monitor'));
 await writeFile(join(directory,'agent-monitor','config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]}));
 const token=await provisionCredential(join(directory,'agent-monitor'),'reader',['read']);
 const app=createApp({dataDir:directory,monitorEnabled:true});
 try{
  expect((await app.inject('/api/monitor/v1/rendition')).statusCode).toBe(401);
  const response=await app.inject({url:'/api/monitor/v1/rendition',headers:{authorization:`Bearer ${token}`}});
  expect(response.statusCode).toBe(200);const result=response.json();
  expect(result.state).toBe('current');expect(result.rendition.rgb).toHaveLength(12288);
  expect(result.rendition.layout).toMatchObject({ownerId:'owner',rows:[],connection:'current'});
  const {renderDashboard}=await import('../../apps/server/src/dashboard-pixels.js');
  expect(result.rendition.rgb).toEqual(Array.from(renderDashboard(result.rendition.layout)));
  expect((await app.inject('/api/health')).json().mode).toBe('simulator');
 }finally{await app.close();await rm(directory,{recursive:true,force:true});}
});
