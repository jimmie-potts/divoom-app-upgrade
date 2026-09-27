// Negative controls: the reference capture steps run against a known-wrong
// behavior injected between the page and the actual server. Each must report
// failed at the assertion that names the wrong behavior; a control that
// passes means the step can no longer detect that failure class.
import sharp from 'sharp';
import type {Page} from '@playwright/test';
import {captureSteps,type Step} from './capture-steps.ts';
import {syntheticMedia} from './scenarios.ts';

async function freshCommand(url:string,body:Record<string,unknown>):Promise<void> {
 const {nextRequestId}=await (await fetch(new URL('/api/player',url))).json() as {nextRequestId:string};
 await fetch(new URL('/api/player/commands',url),{method:'POST',headers:{'x-pixoo-request':'1','content-type':'application/json'},body:JSON.stringify({...body,requestId:nextRequestId})});
}
type Fault=(page:Page,url:string)=>Promise<void>;
/** Route handlers are installed before the step's own, so the step's handlers run first and fall back to these. */
const faults:Record<string,{step:string;description:string;inject:Fault}>={
 'control-wrong-frame':{step:'library-selection',description:'every rendition frame is served as the stripes fixture',
  inject:async page=>{
   const stripes=await sharp(syntheticMedia.stripes.frames[0],{raw:{width:64,height:64,channels:3}}).png().toBuffer();
   await page.route('**/api/renditions/*/frames/*.png',route=>route.fulfill({contentType:'image/png',body:stripes}));
  }},
 'control-duplicate-next':{step:'playlist-progression',description:'every Next is applied twice, the second time under a fresh identity',
  inject:async(page,url)=>{
   await page.route('**/api/player/commands',async route=>{
    const body=route.request().postDataJSON() as {command?:string};
    const response=await route.fetch();
    if(body.command==='next')await freshCommand(url,{command:'next'});
    await route.fulfill({response});
   });
  }},
 'control-select-media-resumes':{step:'monitor-media',description:'Select Media also resumes playback',
  inject:async(page,url)=>{
   await page.route('**/api/integration/v1/commands',async route=>{
    const body=route.request().postDataJSON() as {action?:{operation?:string;mode?:string}};
    const response=await route.fetch();
    if(body.action?.operation==='mode'&&body.action.mode==='media')await freshCommand(url,{command:'resume'});
    await route.fulfill({response});
   });
  }},
 'control-retry-new-identity':{step:'lost-response-recovery',description:'a retried Next is resent under a fresh identity',
  inject:async(page,url)=>{
   await page.route('**/api/player/commands',async route=>{
    const body=route.request().postDataJSON() as Record<string,unknown>;
    if(body.command!=='next')return route.fallback();
    const {nextRequestId}=await (await fetch(new URL('/api/player',url))).json() as {nextRequestId:string};
    await route.fallback({postData:JSON.stringify({...body,requestId:nextRequestId})});
   });
  }},
};

export const controlSteps:Record<string,Step>=Object.fromEntries(Object.entries(faults).map(([name,fault])=>{
 const base=captureSteps[fault.step]!;
 return [name,{...base,description:`Negative control, must fail: ${fault.step} while ${fault.description}`,
  run:async t=>{t.note(`injected known-wrong behavior: ${fault.description}`);await fault.inject(t.page,t.url);await base.run(t);}} satisfies Step];
}));
