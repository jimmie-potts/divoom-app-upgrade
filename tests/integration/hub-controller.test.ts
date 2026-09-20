import {expect,it} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../../apps/server/src/app.js';
import {provisionCredential,revokeCredential} from '../../apps/server/src/mcp-config.js';
import {validate} from '@jimmie-potts/device-contracts';
import {loadConfig} from '../../apps/server/src/config.js';

it('requires a machine credential and returns an honest simulator contract snapshot',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-hub-test-'));
 const token=await provisionCredential(dataDir,'hub',['read','control']);
 const app=createApp({dataDir,...{controllerEnabled:true}});
 try{
  expect((await app.inject('/controller/v1/snapshot')).statusCode).toBe(401);
  const result=await app.inject({url:'/controller/v1/snapshot',headers:{authorization:`Bearer ${token}`}});
  expect(result.statusCode).toBe(200);
  expect(validate('snapshot',result.json())).toBe(true);
  expect(result.json()).toMatchObject({apiVersion:'1.0',identity:{deviceId:'pixoo-local',controllerId:'pixoo-controller',sourceId:'pixoo'},serviceHealth:'ready',state:{observation:{status:'unknown'},externalControl:{status:'unknown'}}});
 }finally{await app.close();await rm(dataDir,{recursive:true,force:true});}
});

it('keeps native startup opt-in and validates configured identity without activating hardware',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-hub-config-'));
 let app=createApp({dataDir});
 try{
  expect((await app.inject('/controller/v1/snapshot')).statusCode).toBe(404);await app.close();
  for(const env of [{PIXOO_CONTROLLER_ENABLED:'true'},{PIXOO_CONTROLLER_ID:'bad/path'}])await expect(loadConfig({PIXOO_DATA_DIR:dataDir,...env})).rejects.toThrow();
  const config=await loadConfig({PIXOO_DATA_DIR:dataDir,PIXOO_CONTROLLER_ENABLED:'1',PIXOO_CONTROLLER_DEVICE_ID:'desk-pixoo',PIXOO_CONTROLLER_ID:'desk-controller',PIXOO_CONTROLLER_SOURCE_ID:'desk'});
  expect(config.host).toBe('127.0.0.1');expect(config.mode).toBe('simulator');
  const token=await provisionCredential(dataDir,'hub',['read','control']);
  app=createApp({dataDir,controllerEnabled:config.controllerEnabled!,controllerIdentity:config.controllerIdentity!});
  const headers={authorization:`Bearer ${token}`};
  expect((await app.inject({url:'/controller/v1/snapshot',headers})).json().identity).toMatchObject({deviceId:'desk-pixoo',controllerId:'desk-controller',sourceId:'desk'});
  const before=(await app.inject('/api/player')).json().nextRequestId;
  expect((await app.inject({method:'POST',url:'/controller/v1/commands',headers,payload:{large:'x'.repeat(65536)}})).statusCode).toBe(429);
  expect((await app.inject('/api/player')).json().nextRequestId).toBe(before);
 }finally{await app.close();await rm(dataDir,{recursive:true,force:true});}
});

it('resyncs authenticated streams and terminates them after credential revocation',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-hub-events-'));
 const token=await provisionCredential(dataDir,'hub',['read','control']);
 const app=createApp({dataDir,controllerEnabled:true});
 const abort=new AbortController();
 try{
  const url=await app.listen({host:'127.0.0.1',port:0});
  const response=await fetch(url+'/controller/v1/events',{headers:{authorization:`Bearer ${token}`},signal:abort.signal});
  expect(response.status).toBe(200);
  const reader=response.body!.getReader(),first=await reader.read();
  const text=new TextDecoder().decode(first.value);
  expect(text).toContain('event: resync');
  const envelope=JSON.parse(text.split('\n').find(line=>line.startsWith('data: '))!.slice(6));
  expect(validate('feed',envelope)).toBe(true);
  await revokeCredential(dataDir,'hub');
  const ended=await Promise.race([reader.read().then(result=>result.done,()=>true),new Promise<boolean>(resolve=>setTimeout(()=>resolve(false),3000))]);
  expect(ended).toBe(true);
 }finally{abort.abort();await app.close();await rm(dataDir,{recursive:true,force:true});}
},10000);

it('shares command identities, guards revisions and replays native outcomes without another write',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-hub-command-'));
 const token=await provisionCredential(dataDir,'hub',['read','control']);
 const app=createApp({dataDir,controllerEnabled:true});
 const headers={authorization:`Bearer ${token}`};
 try{
  const initial=(await app.inject({url:'/controller/v1/snapshot',headers})).json();
  const body={apiVersion:'1.0',controllerId:initial.identity.controllerId,deviceId:initial.identity.deviceId,requestId:initial.nextRequestId,expectedConfigurationRevision:initial.configurationRevision,expectedGeneration:initial.generation,command:{kind:'brightness.set',percent:42}};
  const post=(payload:unknown)=>app.inject({method:'POST',url:'/controller/v1/commands',headers,payload:payload as object});
  const response=await post(body);
  expect(response.statusCode,response.body).toBe(200);expect(validate('receipt',response.json())).toBe(true);
  expect(response.json()).toMatchObject({outcome:'sent',priorEffects:'confirmed-transmission'});
  expect((await post({...body,command:{percent:42,kind:'brightness.set'}})).json()).toEqual(response.json());
  expect((await post({...body,command:{kind:'brightness.set',percent:43}})).statusCode).toBe(409);
  const current=(await app.inject({url:'/controller/v1/snapshot',headers})).json();
  expect(current.state.desired.brightness).toEqual({status:'known',value:42});
  expect(current.state.lastSuccessfulSend.status).toBe('known');
  expect(current.configurationRevision).toBeGreaterThan(initial.configurationRevision);
  expect((await app.inject('/api/player')).json().nextRequestId).toBe(`${current.nextRequestId.epoch}:${current.nextRequestId.sequence}`);
  const stale=await post({...body,requestId:current.nextRequestId});
  expect(stale.statusCode).toBe(409);expect(stale.json()).toMatchObject({failure:{code:'revision-conflict'},priorEffects:'none'});
 }finally{await app.close();await rm(dataDir,{recursive:true,force:true});}
});
