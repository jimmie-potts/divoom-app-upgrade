import {expect,it} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../../apps/server/src/app.js';
it('reports private-safe simulator diagnostics under the API security boundary',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-diagnostics-')),app=createApp({dataDir});
 try{
  const response=await app.inject('/api/diagnostics');expect(response.statusCode).toBe(200);
  const body=response.json();
  expect(body).toMatchObject({status:'ready',mode:'simulator',library:'ready',device:{connected:false},player:{state:'idle'},logging:{persistent:false},limits:{requests:32,eventClients:16,eventHistory:32,commandReceipts:256,playbackRenditions:2}});
  expect(body.uptimeMs).toBeGreaterThanOrEqual(0);
  expect(response.body).not.toMatch(/dataDir|deviceIp|\.sqlite|pixoo-diagnostics-|\/home\/|sourceHash|playlist/);
  expect(response.body.length).toBeLessThan(2048);
  expect((await app.inject({url:'/api/diagnostics',headers:{origin:'https://foreign.invalid'}})).statusCode).toBe(403);
 }finally{await app.close();await rm(dataDir,{recursive:true,force:true});}
});
