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
