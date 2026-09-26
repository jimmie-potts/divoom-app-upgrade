import {expect,test} from '@playwright/test';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createApp} from '../../apps/server/dist/app.js';
import {provisionCredential} from '../../apps/server/dist/mcp-config.js';
test('monitor panel uses explicit mode, shared labels, project filters and exact pixels',async({page},testInfo)=>{
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-monitor-ui-'));await mkdir(join(dataDir,'agent-monitor'));
 await writeFile(join(dataDir,'agent-monitor','config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]}));
 const token=await provisionCredential(join(dataDir,'agent-monitor'),'fixture',['read','control']);
 const app=createApp({dataDir,monitorEnabled:true,monitorRenderCadenceMs:1,webRoot:resolve('apps/web/dist')});
 const address=await app.listen({host:'127.0.0.1',port:0});
 try{
  const event={apiVersion:'1.0',identity:{provider:'codex',client:'cli',hostId:'fixture',sourceId:'fixture',sessionId:'session-one'},projectId:'project-one',turn:{status:'known',id:'turn'},parent:{status:'top-level'},ordering:{status:'known',epoch:'e',sequence:1},observedAtMs:Date.now(),event:{kind:'turn.ended'}};
  const response=await fetch(address+'/api/monitor/v1/events',{method:'POST',headers:{authorization:`Bearer ${token}`,'x-pixoo-request':'1','content-type':'application/json'},body:JSON.stringify(event)});expect(response.ok).toBe(true);
  await page.goto(address);await page.getByRole('button',{name:'Monitor',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Agent monitor',exact:true})).toBeVisible();
  await expect(page.getByText('Selected mode: Media',{exact:true})).toBeVisible();
  await page.getByRole('textbox',{name:'Label for session-one',exact:true}).fill('Build project');await page.getByRole('button',{name:'Save label for session-one'}).click();
  await expect(page.getByText('Build project',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Show monitor',exact:true}).click();await expect(page.getByText('Monitor presentation active',{exact:true})).toBeVisible();
  await page.getByLabel('Session search').fill('no matching session');await page.getByRole('button',{name:'Apply monitor view'}).click();
  await expect(page.getByText('No sessions match this view.',{exact:true})).toBeVisible();
  await page.getByLabel('Session search').fill('');await page.getByLabel('Project filter').selectOption('project-one');await page.getByRole('button',{name:'Apply monitor view'}).click();
  await expect(page.getByText('Build project',{exact:true})).toBeVisible();
  await expect(page.locator('canvas[aria-label="Exact monitor preview"]')).toBeVisible();
  const actual=await page.locator('canvas[aria-label="Exact monitor preview"]').evaluate(el=>Array.from((el as HTMLCanvasElement).getContext('2d')!.getImageData(0,0,64,64).data).filter((_,i)=>i%4!==3));
  const view=await (await fetch(address+'/api/integration/v1/view')).json();expect(actual).toEqual(view.dashboard.rendition.rgb);
  await expect(page.locator('canvas[aria-label="Exact monitor preview"]')).toHaveAttribute('data-frames','1');
  // Approval makes the preview pulse through both exact frames, as the device plays them.
  const approval={...event,ordering:{status:'known',epoch:'e',sequence:2},observedAtMs:Date.now(),event:{kind:'attention.approval',attention:{status:'unknown'}}};
  expect((await fetch(address+'/api/monitor/v1/events',{method:'POST',headers:{authorization:`Bearer ${token}`,'x-pixoo-request':'1','content-type':'application/json'},body:JSON.stringify(approval)})).ok).toBe(true);
  const preview=page.locator('canvas[aria-label="Exact monitor preview"]');
  await expect(preview).toHaveAttribute('data-frames','2');await expect(page.getByText('Pulsing for attention',{exact:false})).toBeVisible();
  const pulsing=(await (await fetch(address+'/api/integration/v1/view')).json()).dashboard.rendition;expect(pulsing.frames).toHaveLength(2);
  const seen=new Set<string>();
  await expect.poll(async()=>{
   const sample=await preview.evaluate(el=>({frame:(el as HTMLCanvasElement).dataset.frame!,rgb:Array.from((el as HTMLCanvasElement).getContext('2d')!.getImageData(0,0,64,64).data).filter((_,i)=>i%4!==3)}));
   expect(sample.rgb).toEqual(pulsing.frames[Number(sample.frame)]);seen.add(sample.frame);return seen.size;
  },{timeout:5000,intervals:[150]}).toBe(2);
  await page.getByRole('button',{name:'Dismiss notice for session-one'}).click();await expect(page.getByRole('button',{name:'Dismiss notice for session-one'})).toHaveCount(0);
  await page.screenshot({path:`/tmp/pixoo33-monitor-${testInfo.project.name}.png`,fullPage:true});
  await page.getByRole('button',{name:'Select Media',exact:true}).click();await expect(page.getByText('Selected mode: Media',{exact:true})).toBeVisible();
  expect((await (await fetch(address+'/api/player')).json()).player.intent).toBe('paused');
  expect(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth)).toBe(true);
 }finally{await page.context().close();await app.close();await rm(dataDir,{recursive:true,force:true});}
});
