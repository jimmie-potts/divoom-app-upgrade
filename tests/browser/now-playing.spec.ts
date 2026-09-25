import {expect,test} from '@playwright/test';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createApp} from '../../apps/server/dist/app.js';
import {provisionCredential} from '../../apps/server/dist/mcp-config.js';
test('now-playing group shows hub playback, an exact card preview and a persisted Media setting',async({page},testInfo)=>{
 const hub=createServer((_request,response)=>response.end(JSON.stringify({apiVersion:'1.0',sourceId:'ht-a9',availability:'available',observedAtMs:Date.now(),ageMs:300,
  playback:{status:'paused',title:'Harvest Moon',artist:'Neil Young',controls:['next','previous']}})));
 hub.listen(0,'127.0.0.1');await once(hub,'listening');const port=(hub.address() as {port:number}).port;
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-now-playing-ui-'));await mkdir(join(dataDir,'agent-monitor'));
 await writeFile(join(dataDir,'agent-monitor','config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]}));
 await writeFile(join(dataDir,'agent-monitor','playback.json'),JSON.stringify({version:1,endpoint:`http://127.0.0.1:${port}/api/playback/v1/snapshot`,token:'p'.repeat(43),sourceId:'ht-a9'}));
 await provisionCredential(join(dataDir,'agent-monitor'),'fixture',['read','control']);
 const app=createApp({dataDir,monitorEnabled:true,monitorRenderCadenceMs:1,webRoot:resolve('apps/web/dist')});
 const address=await app.listen({host:'127.0.0.1',port:0});
 try{
  await page.goto(address);await page.getByRole('button',{name:'Monitor',exact:true}).click();
  const group=page.getByRole('region',{name:'Now playing'});
  await expect(group.getByText('Hub playback: connected. Paused: HARVEST MOON · NEIL YOUNG',{exact:true})).toBeVisible();
  await expect(group.getByText('Display: not showing a now-playing card.',{exact:true})).toBeVisible();
  const preview=group.locator('canvas[aria-label="Exact now-playing preview"]');await expect(preview).toBeVisible();
  const actual=await preview.evaluate(el=>Array.from((el as HTMLCanvasElement).getContext('2d')!.getImageData(0,0,64,64).data).filter((_,i)=>i%4!==3));
  const view=await (await fetch(address+'/api/integration/v1/view')).json();expect(actual).toEqual(view.nowPlaying.card);
  await expect(group.getByRole('radio',{name:'Off'})).toBeChecked();
  await group.getByRole('radio',{name:'Whole song'}).check();await expect(group.getByRole('radio',{name:'Whole song'})).toBeChecked();
  await expect.poll(async()=>readFile(join(dataDir,'agent-monitor','now-playing.json'),'utf8').then(JSON.parse,()=>null)).toEqual({version:1,media:'whole'});
  await page.reload();await page.getByRole('button',{name:'Monitor',exact:true}).click();
  await expect(page.getByRole('region',{name:'Now playing'}).getByRole('radio',{name:'Whole song'})).toBeChecked();
  await page.getByRole('region',{name:'Now playing'}).screenshot({path:`/tmp/pixoo89-now-playing-${testInfo.project.name}.png`});
  expect(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth)).toBe(true);
 }finally{await page.context().close();await app.close();hub.closeAllConnections();hub.close();await rm(dataDir,{recursive:true,force:true});}
});
test('now-playing group explains an unconfigured reader and still offers the setting',async({page})=>{
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-now-playing-off-'));await mkdir(join(dataDir,'agent-monitor'));
 await writeFile(join(dataDir,'agent-monitor','config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]}));
 await provisionCredential(join(dataDir,'agent-monitor'),'fixture',['read','control']);
 const app=createApp({dataDir,monitorEnabled:true,webRoot:resolve('apps/web/dist')});const address=await app.listen({host:'127.0.0.1',port:0});
 try{
  await page.goto(address);await page.getByRole('button',{name:'Monitor',exact:true}).click();
  const group=page.getByRole('region',{name:'Now playing'});
  await expect(group.getByText('Hub playback is not configured for this backend.',{exact:true})).toBeVisible();
  await expect(group.locator('canvas')).toHaveCount(0);await expect(group.getByRole('radio',{name:'Pop-up for 10 seconds'})).toBeEnabled();
 }finally{await page.context().close();await app.close();await rm(dataDir,{recursive:true,force:true});}
});
