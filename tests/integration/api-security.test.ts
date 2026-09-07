import {expect,it,vi} from 'vitest';
import {createApp} from '../../apps/server/src/app.js';
it('rejects foreign hosts and origins before exposing API data',async()=>{
 const app=createApp();try{
  expect((await app.inject({url:'/api/health',headers:{host:'attacker.example'}})).statusCode).toBe(403);
  expect((await app.inject({url:'/api/health',headers:{origin:'https://attacker.example'}})).statusCode).toBe(403);
  expect((await app.inject({url:'/api/health',headers:{host:'localhost:9999'}})).statusCode).toBe(403);
  expect((await app.inject('/api/health')).statusCode).toBe(200);
 }finally{await app.close();}
});
it('blocks simple cross-site mutations and invokes authentication for API access',async()=>{
 const app=createApp({authenticate:request=>request.headers.authorization==='Bearer test-only'});try{
  expect((await app.inject('/api/health')).statusCode).toBe(401);
  expect((await app.inject({url:'/api/health',headers:{authorization:'Bearer test-only'}})).statusCode).toBe(200);
  expect((await app.inject({method:'POST',url:'/api/missing'})).statusCode).toBe(403);
  expect((await app.inject({method:'POST',url:'/api/missing',headers:{origin:'http://localhost',authorization:'Bearer test-only'}})).statusCode).toBe(404);
  expect((await app.inject({method:'POST',url:'/api/missing',headers:{'x-pixoo-request':'1','sec-fetch-site':'cross-site'}})).statusCode).toBe(403);
  expect((await app.inject({url:'/api/health',headers:{host:'bad.example','x-forwarded-host':'localhost',authorization:'Bearer test-only'}})).statusCode).toBe(403);
 }finally{await app.close();}
});
it('sanitizes authentication failures',async()=>{
 const app=createApp({authenticate:()=>{throw Object.assign(new Error('/private/secret'),{code:'storage-error',details:{path:'/private/secret'}});}});try{
  const response=await app.inject('/api/health');expect(response.statusCode).toBe(500);expect(response.body).not.toContain('private');
 }finally{await app.close();}
});
it('bounds requests even while an authentication hook is waiting',async()=>{
 let release!:()=>void,calls=0;const gate=new Promise<void>(resolve=>{release=resolve;});
 const app=createApp({authenticate:async()=>{calls++;if(calls<=32)await gate;return true;}});
 await app.ready();const pending=Array.from({length:32},()=>app.inject('/api/health'));
 try{
  await vi.waitFor(()=>expect(calls).toBe(32));
  expect((await app.inject('/api/health')).statusCode).toBe(503);
 }finally{release();await Promise.all(pending);await app.close();}
});
