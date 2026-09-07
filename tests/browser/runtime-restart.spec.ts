import {test,expect} from '@playwright/test';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createApp} from '../../apps/server/dist/app.js';

async function runtimeFixture(){
 const dataDir=await mkdtemp(join(tmpdir(),'pixoo-ui-restart-'));
 const lockDir=await mkdtemp(join(tmpdir(),'pixoo-ui-lock-'));
 const writes:unknown[]=[];
 const options={dataDir,webRoot:resolve('apps/web/dist'),deviceLockDirectoryForTests:lockDir,transportForTests:async(body:unknown)=>{writes.push(body);return {error_code:0,SelectIndex:3,PicId:1};}};
 let app=createApp(options);
 const address=await app.listen({host:'127.0.0.1',port:0});
 const port=Number(new URL(address).port);
 return {address,writes,
  async restart(ip:string){
   await app.close();
   await writeFile(join(dataDir,'device.json'),JSON.stringify({version:1,configuration:{ip,profile:'pixoo64-smoke-2026-09-06'}}));
   app=createApp({...options,mode:'device'});
   await app.listen({host:'127.0.0.1',port});
  },
  async close(){await app.close();await rm(dataDir,{recursive:true,force:true});await rm(lockDir,{recursive:true,force:true});},
 };
}

test('backend restart refreshes mode and target without losing drafts or replay identity',async({page})=>{
 const fixture=await runtimeFixture();
 try{
  await page.goto(fixture.address);
  await expect(page.getByText('Live state connected',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Playlists',exact:true}).click();
  await page.getByLabel('New playlist name').fill('Keep this unsaved draft');
  await page.getByRole('button',{name:'Player',exact:true}).click();
  const commands:unknown[]=[];
  await page.route('**/api/player/commands',async route=>{commands.push(route.request().postDataJSON());await route.fetch();await route.abort('failed');});
  await page.getByRole('button',{name:'Stop',exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry command',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Simulated display controls',exact:true})).toBeVisible();
  await fixture.restart('192.168.50.20');
  await expect(page.getByText('Device mode',{exact:true})).toBeVisible({timeout:10000});
  await expect(page.getByText('Active target: 192.168.50.20',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Device IP')).toHaveValue('192.168.50.20');
  await expect(page.getByRole('heading',{name:'Device display controls',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Apply brightness',exact:true})).toBeDisabled();
  expect(commands).toHaveLength(1);expect(fixture.writes).toHaveLength(0);
  await page.unroute('**/api/player/commands');
  await page.route('**/api/player/commands',async route=>{commands.push(route.request().postDataJSON());await route.continue();});
  await page.getByRole('button',{name:'Retry command',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('request-expired');
  expect(commands).toHaveLength(2);expect(commands[1]).toEqual(commands[0]);
  expect(fixture.writes).toHaveLength(0);
  await page.getByRole('button',{name:'Apply brightness',exact:true}).click();
  await expect.poll(()=>fixture.writes.length).toBe(1);
  await fixture.restart('192.168.50.21');
  await expect(page.getByText('Active target: 192.168.50.21',{exact:true})).toBeVisible({timeout:10000});
  await expect(page.getByLabel('Device IP')).toHaveValue('192.168.50.21');
  await page.getByRole('button',{name:'Playlists',exact:true}).click();
  await expect(page.getByLabel('New playlist name')).toHaveValue('Keep this unsaved draft');
  expect(fixture.writes).toHaveLength(1);
 }finally{await page.goto('about:blank');await fixture.close();}
});

test('failed runtime refresh stays disabled when an older restart response arrives late',async({page})=>{
 const fixture=await runtimeFixture();
 let fail=false,failures=0;
 const held:Array<()=>Promise<void>>=[];
 try{
  await page.goto(fixture.address);
  await expect(page.getByText('Live state connected',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByLabel('Device IP').fill('192.168.50.99');
  await page.route('**/api/device',async route=>{
   if(fail){failures++;await route.fulfill({status:503,json:{}});return;}
   const response=await route.fetch();
   await new Promise<void>(resolve=>held.push(async()=>{await route.fulfill({response});resolve();}));
  });
  await fixture.restart('192.168.50.20');
  await expect.poll(()=>held.length).toBeGreaterThan(0);
  await expect(page.getByRole('button',{name:'Apply brightness',exact:true})).toBeDisabled();
  fail=true;
  await fixture.restart('192.168.50.21');
  await expect.poll(()=>failures,{timeout:10000}).toBeGreaterThan(0);
  for(const release of held)await release();
  // The confirming player read observes the new backend even for a held response.
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Live state disconnected. Reconnecting…',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Apply brightness',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Probe simulator',exact:true})).toBeDisabled();
  expect(fixture.writes).toHaveLength(0);
  await expect(page.getByLabel('Device IP')).toHaveValue('192.168.50.99');
  await page.unroute('**/api/device');
  await page.getByRole('button',{name:'Reload settings',exact:true}).click();
  await expect(page.getByText('Active target: 192.168.50.21',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Apply brightness',exact:true})).toBeEnabled();
  await expect(page.getByLabel('Device IP')).toHaveValue('192.168.50.21');
  expect(fixture.writes).toHaveLength(0);
 }finally{for(const release of held)await release().catch(()=>{});await page.goto('about:blank');await fixture.close();}
});

test('a control click discovering a new backend requires fresh intent after its labels update',async({page})=>{
 const fixture=await runtimeFixture();
 let restarted=false;
 try{
  await page.goto(fixture.address);
  await expect(page.getByText('Live state connected',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.route('**/api/player',async route=>{
   if(!restarted){restarted=true;await fixture.restart('192.168.50.20');}
   const response=await route.fetch();await route.fulfill({response});
  });
  await page.getByRole('button',{name:'Apply brightness',exact:true}).click();
  await expect(page.getByText('Active target: 192.168.50.20',{exact:true})).toBeVisible({timeout:10000});
  await expect(page.getByRole('button',{name:'Apply brightness',exact:true})).toBeEnabled();
  expect(fixture.writes).toHaveLength(0);
  await page.getByRole('button',{name:'Apply brightness',exact:true}).click();
  await expect.poll(()=>fixture.writes.length).toBe(1);
 }finally{await page.goto('about:blank');await fixture.close();}
});
