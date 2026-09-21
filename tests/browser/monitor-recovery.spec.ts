import {expect,test,type Route} from '@playwright/test';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {createApp} from '../../apps/server/dist/app.js';
import {provisionCredential} from '../../apps/server/dist/mcp-config.js';
async function fixture(){
 const dataDir=await mkdtemp(join(tmpdir(),'monitor-recovery-'));await mkdir(join(dataDir,'agent-monitor'));await writeFile(join(dataDir,'agent-monitor','config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]}));
 const token=await provisionCredential(join(dataDir,'agent-monitor'),'fixture',['read','control']);const app=createApp({dataDir,monitorEnabled:true,webRoot:resolve('apps/web/dist')});const address=await app.listen({host:'127.0.0.1',port:0});
 return {app,address,token,close:async()=>{await app.close();await rm(dataDir,{recursive:true,force:true});}};
}
test('a failed read from a retired Monitor tab cannot disable the current connection',async({page})=>{
 const f=await fixture(),held:Route[]=[];let hold=true;
 try{
  await page.route('**/api/integration/v1/view',route=>{if(hold)held.push(route);else return route.continue();});
  await page.goto(f.address);await page.getByRole('button',{name:'Monitor',exact:true}).click();await expect.poll(()=>held.length).toBeGreaterThan(1);
  await page.getByRole('button',{name:'Library',exact:true}).click();hold=false;await page.getByRole('button',{name:'Monitor',exact:true}).click();await expect(page.getByText('Monitor state connected',{exact:true})).toBeVisible();
  for(const route of held)await route.fulfill({status:503,json:{error:{code:'busy',message:'busy'}}});held.length=0;
  await expect(page.getByRole('button',{name:'Show monitor',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Show monitor',exact:true}).click();await expect(page.getByText('Monitor presentation active',{exact:true})).toBeVisible();
 }finally{for(const route of held)await route.abort().catch(()=>{});await page.context().close();await f.close();}
});
test('retains the original shared request after an ambiguous owner failure and retries exactly',async({page})=>{
 const f=await fixture();const bodies:Array<Record<string,unknown>>=[];let interrupt=true;
 try{
  await fetch(f.address+'/api/monitor/v1/events',{method:'POST',headers:{authorization:`Bearer ${f.token}`,'x-pixoo-request':'1','content-type':'application/json'},body:JSON.stringify({apiVersion:'1.0',identity:{provider:'codex',client:'cli',hostId:'host',sourceId:'source',sessionId:'chosen'},turn:{status:'unknown'},parent:{status:'top-level'},event:{kind:'session.started'},ordering:{status:'unknown'},observedAtMs:Date.now()})});
  await page.route('**/api/integration/v1/shared-actions',async route=>{bodies.push(route.request().postDataJSON());const response=await route.fetch();if(interrupt){interrupt=false;await route.fulfill({status:503,json:{error:{code:'monitor-unavailable',message:'Unavailable'}}});}else await route.fulfill({response});});
  await page.goto(f.address);await page.getByRole('button',{name:'Monitor',exact:true}).click();await expect(page.getByText('Monitor state connected',{exact:true})).toBeVisible();
  await page.getByRole('textbox',{name:'Label for chosen',exact:true}).fill('Chosen label');await page.getByRole('button',{name:'Save label for chosen'}).click();
  await expect(page.getByRole('button',{name:'Retry monitor command'})).toBeVisible();await expect(page.getByText('Chosen label',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Retry monitor command'}).click();await expect(page.getByRole('button',{name:'Retry monitor command'})).toHaveCount(0);expect(bodies).toHaveLength(2);expect(bodies[1]).toEqual(bodies[0]);
 }finally{await page.context().close();await f.close();}
});
test('a competing integration command refreshes guards and requires fresh user intent',async({page})=>{
 const f=await fixture();let compete=true;const bodies:Array<Record<string,unknown>>=[];
 try{
  await page.route('**/api/integration/v1/commands',async route=>{
   const body=route.request().postDataJSON();bodies.push(body);
   if(compete){compete=false;const result=await f.app.inject({method:'POST',url:'/api/integration/v1/commands',headers:{host:new URL(f.address).host,'x-pixoo-request':'1'},payload:{...body,action:{operation:'view',filter:{q:'another client'},cadenceMs:1000}}});expect(result.statusCode).toBe(200);}
   await route.fulfill({response:await route.fetch()});
  });
  await page.goto(f.address);await page.getByRole('button',{name:'Monitor',exact:true}).click();await expect(page.getByText('Monitor state connected',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Show monitor',exact:true}).click();await expect(page.getByRole('alert')).toContainText('request-conflict');
  await expect(page.getByLabel('Session search')).toHaveValue('another client');await expect(page.getByText('Selected mode: Media',{exact:true})).toBeVisible();expect(bodies).toHaveLength(1);
  await page.getByRole('button',{name:'Show monitor',exact:true}).click();await expect(page.getByText('Monitor presentation active',{exact:true})).toBeVisible();expect(bodies).toHaveLength(2);expect(bodies[1]!.requestId).not.toBe(bodies[0]!.requestId);
 }finally{await page.context().close();await f.close();}
});
