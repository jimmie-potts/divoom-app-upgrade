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
  expect((await app.inject({url:url+'/sessions?q=Chosen&provider=claude',headers})).json().snapshot.sessions).toHaveLength(1);
  expect((await app.inject({url:url+'/sessions?q=Other',headers})).json().snapshot.sessions).toHaveLength(0);
  view=(await app.inject({url:url+'/sessions',headers})).json();
  expect((await send({operation:'acknowledge',requestId:view.nextRequestId,identity,consumerId:'pixoo',noticeId:view.snapshot.sessions[0].notices[0].id})).json().ok).toBe(true);
  const after=(await app.inject({url:url+'/sessions',headers})).json();expect(after.snapshot.sessions[0].read).toBe('unknown');expect(after.snapshot.sessions[0].notices[0].acknowledgedBy).toEqual(['pixoo']);
 }finally{await app.close();await rm(directory,{recursive:true,force:true});}
});
