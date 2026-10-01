import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MediaStore } from '@pixoo/media';
import { gifFixture } from '../helpers/media-fixtures.js';

test('browser preview decodes every effective pixel and retains variable ordered delays', async ({page}) => {
  const directory=await mkdtemp(join(tmpdir(),'pixoo-preview-'));
  try {
    const store=new MediaStore({directory});
    const bytes=gifFixture(2,2,[{width:2,height:2,pixels:[1,2,3,0],delay:4,transparent:true},{width:1,height:1,pixels:[3],delay:20,disposal:3}]);
    async function* upload() { yield bytes; }
    const rendition=await store.render(upload(),{transform:{fit:'fit',scaling:'nearest',background:[40,50,60]}});
    expect(rendition.frames.map(f=>f.delayMs)).toEqual([40,200]);
    await page.goto('/');
    for(const frame of rendition.frames) {
      const png=(await store.readFrame(rendition.id,frame.index,'png')).toString('base64');
      const actual=await page.evaluate(async (base64) => {
        const img=new Image(); img.src=`data:image/png;base64,${base64}`; await img.decode();
        const canvas=document.createElement('canvas'); canvas.width=64; canvas.height=64;
        const context=canvas.getContext('2d')!; context.drawImage(img,0,0);
        return Array.from(context.getImageData(0,0,64,64).data).filter((_,i)=>i%4!==3);
      },png);
      expect(Buffer.from(actual)).toEqual(await store.readFrame(rendition.id,frame.index,'rgb'));
    }
  } finally { await rm(directory,{recursive:true,force:true}); }
});

test('full varied GIF preview stays available when physical playback is unqualified',async({page},info)=>{
 const delays=Array.from({length:20},(_,i)=>10+i);
 const buffer=gifFixture(1,1,delays.map((delay,i)=>({width:1,height:1,pixels:[i%4],delay})));
 let compatible=false;
 await page.route('**/api/renditions/*/compatibility',route=>route.fulfill({json:{compatible,profile:'pixoo64-smoke-2026-09-06',physical:true}}));
 await page.goto('/');await page.getByRole('button',{name:'Library',exact:true}).click();
 const before=await(await page.request.get('/api/device/simulator')).json();
 await page.getByLabel('Upload media').setInputFiles({name:'full-20-frames.gif',mimeType:'image/gif',buffer});
 await expect(page.getByText('64 × 64 · 20 frames',{exact:true})).toBeVisible();
 await expect(page.getByText('Not qualified for device playback. The full preview is available.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Use in playlist',exact:true})).toBeEnabled();
 const image=page.getByRole('region',{name:'Media library',exact:true}).getByAltText('Effective preview');
 const src=await image.getAttribute('src');const id=src!.split('/')[3]!;
 const manifest=await(await page.request.get(`/api/renditions/${id}`)).json();
 expect(manifest.frames.map((f:{delayMs:number})=>f.delayMs)).toEqual(delays.map(d=>d*10));
 const seen=new Set<number>();page.on('request',request=>{const match=request.url().match(new RegExp('/api/renditions/'+id+'/frames/([0-9]+)\\.png'));if(match)seen.add(Number(match[1]));});
 await page.getByRole('button',{name:'Animate preview',exact:true}).click();
 await expect.poll(()=>seen.size,{timeout:15000}).toBe(20);
 await page.getByRole('button',{name:'Pause preview',exact:true}).click();
 await page.screenshot({path:info.outputPath('gif-compatibility.png'),fullPage:true});
 await page.getByRole('button',{name:'Use in playlist',exact:true}).click();
 await page.getByLabel('New playlist name').fill(`Unqualified authoring ${info.project.name}`);
 await page.getByRole('button',{name:'Create playlist',exact:true}).click();
 await page.getByRole('button',{name:'Add selected media',exact:true}).click();
 await page.getByRole('button',{name:'Save items',exact:true}).click();
 await expect(page.getByText('Playlist items saved.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Library',exact:true}).click();
 expect(await(await page.request.get('/api/device/simulator')).json()).toEqual(before);
 compatible=true;await page.getByRole('button',{name:'Refresh status',exact:true}).click();
 await expect(page.getByText('Within the active device playback profile.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Use in playlist',exact:true})).toBeEnabled();
});

test('settings distinguish playback qualification from GIF imports',async({page},info)=>{
 await page.route('**/api/health',async route=>{const response=await route.fetch();await route.fulfill({json:{...await response.json(),mode:'device',device:{connected:null}}});});
 await page.route('**/api/device',async route=>{const response=await route.fetch();const value=await response.json();await route.fulfill({json:{...value,mode:'device',activeConfiguration:null,activeProfile:value.profiles.find((profile:{name:string})=>profile.name==='pixoo64-smoke-2026-09-06')}});});
 await page.goto('/');await page.getByRole('button',{name:'Settings',exact:true}).click();
 await expect(page.getByText('Active playback profile:',{exact:false})).toBeVisible();
 await expect(page.getByText('Physical playback limits:',{exact:false})).toContainText('GIFs with more frames or mixed delays can still be imported and previewed');
 await page.screenshot({path:info.outputPath('gif-settings.png'),fullPage:true});
});
