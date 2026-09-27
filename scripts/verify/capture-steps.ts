// Capture steps for Pixoo verification runs. Each step drives the actual page
// served by the run and records its expected observations as named
// assertions. Media pixel assertions compare the page against the synthetic
// fixtures in scenarios.ts rather than another server response, so a wrong
// transition or rendering fails; the monitor canvas is compared with the
// server's exact picture. Simulator pixels are the desired 64×64 content and
// never evidence of what a physical display shows.
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import type {Locator,Page} from '@playwright/test';
import {checkNoPhysicalTransport,checkSimulatorMode} from './readiness.ts';
import {PLAYLIST,SESSION,syntheticMedia,type MediaKey} from './scenarios.ts';

/** The part of the shared core's capture context these steps use, with Playwright's page type. */
export interface StepContext {
 page:Page;url:string;port:number;runId:string;scenario:string;runtimeDir:string;signal:AbortSignal;
 expect(name:string,check:()=>unknown):Promise<void>;
 note(message:string):void;
 screenshot(name:string):Promise<void>;
 /**
  * Save a file into the capture directory. Optional only until the vendored
  * core provides it: without it the 64×64 assertion fails, never skips.
  */
 attach?(name:string,content:string|Uint8Array):Promise<void>;
}
/** A capture step. `fresh` asks the core to reseed and relaunch the run before a step that changes state. */
export interface Step {description:string;scenario?:string;fresh?:boolean;timeoutMs?:number;run(t:StepContext):Promise<void>}

const WAIT=5000;
const text=(t:StepContext,value:string|RegExp)=>t.page.getByText(value,typeof value==='string'?{exact:true}:{}).first().waitFor({timeout:WAIT});
const tab=(t:StepContext,name:string)=>t.page.getByRole('navigation',{name:'Controller views'}).getByRole('button',{name,exact:true}).click({timeout:WAIT});
async function api<T>(t:StepContext,path:string):Promise<T> {
 const response=await fetch(new URL(path,t.url),{signal:t.signal});
 if(!response.ok)throw new Error(`${path} answered ${response.status}`);
 return response.json() as Promise<T>;
}
interface PlayerSnapshot {player:{state:string;intent:string;itemId:string|null;generation:number};session:{id:string;playlist:{items:{id:string}[]}}|null}
const player=(t:StepContext)=>api<PlayerSnapshot>(t,'/api/player');
async function eventually(check:()=>Promise<string|null>,timeoutMs=WAIT):Promise<void> {
 const deadline=Date.now()+timeoutMs;let problem:string|null='not checked';
 while(Date.now()<deadline){problem=await check();if(problem===null)return;await new Promise(resolve=>setTimeout(resolve,150));}
 throw new Error(problem??'timed out');
}

/** RGB bytes of a 64×64 image or canvas as the browser draws it. */
async function pixels(locator:Locator):Promise<Buffer> {
 const values=await locator.evaluate(async element=>{
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
  const context=canvas.getContext('2d')!;
  if(element instanceof HTMLImageElement){
   if(!element.complete||!element.naturalWidth)await element.decode();
   if(element.naturalWidth!==64||element.naturalHeight!==64)throw new Error(`image is ${element.naturalWidth}×${element.naturalHeight}`);
   context.drawImage(element,0,0);
  }else if(element instanceof HTMLCanvasElement)context.drawImage(element,0,0);
  else throw new Error('not an image or canvas');
  return Array.from(context.getImageData(0,0,64,64).data).filter((_,index)=>index%4!==3);
 });
 return Buffer.from(values);
}
/** Name the fixture frame some pixels show, for a readable failure. */
function identify(rgb:Buffer):string {
 for(const media of Object.values(syntheticMedia))for(const [index,frame] of media.frames.entries())if(frame.equals(rgb))return `${media.file} frame ${index}`;
 return 'no synthetic fixture frame';
}
/** Wait until `locator` shows exactly frame `frame` of `key`; return the pixels shown. */
async function shows(locator:Locator,key:MediaKey,frame=0):Promise<Buffer> {
 const expected=syntheticMedia[key].frames[frame]!;let actual:Buffer=Buffer.alloc(0);
 await eventually(async()=>{
  try{actual=await pixels(locator);}catch(error){return error instanceof Error?error.message:String(error);}
  return actual.equals(expected)?null:`shows ${identify(actual)}, expected ${syntheticMedia[key].file} frame ${frame}`;
 });
 return actual;
}

/** Save the inspectable 64×64 result: exact PNG, an 8× nearest-neighbour copy and a label. */
async function saveSimulatorResult(t:StepContext,name:string,rgb:Buffer,source:string):Promise<void> {
 await t.expect(`the 64×64 simulator result "${name}" is saved and labelled`,async()=>{
  if(!t.attach)throw new Error('this harness cannot save capture files');
  const raw={raw:{width:64,height:64,channels:3 as const}};
  await t.attach(`simulator-64x64-${name}.png`,await sharp(rgb,raw).png().toBuffer());
  await t.attach(`simulator-64x64-${name}-x8.png`,await sharp(rgb,raw).resize(512,512,{kernel:'nearest'}).png().toBuffer());
  await t.attach(`simulator-64x64-${name}.json`,JSON.stringify({
   label:'Simulator rendering: the desired 64x64 content in a verification run. It is not evidence of physical display output.',
   runId:t.runId,scenario:t.scenario,source,shows:identify(rgb),rgbSha256:createHash('sha256').update(rgb).digest('hex'),
  },null,1)+'\n');
 });
}
async function noPhysicalTransport(t:StepContext):Promise<void> {
 await t.expect('no physical transport request so far in this run',async()=>{
  const result=await checkNoPhysicalTransport(t);if(result.outcome!=='passed')throw new Error(result.reason);
 });
}
async function openPage(t:StepContext):Promise<void> {
 await t.page.goto(t.url,{timeout:WAIT*2});
 await t.expect('the page is ready in simulator mode',async()=>{await text(t,'Simulator mode');await text(t,'Server ready');await text(t,'Live state connected');});
}
async function playFromStart(t:StepContext):Promise<void> {
 await tab(t,'Playlists');
 await t.page.getByLabel('Open playlist',{exact:true}).selectOption({label:PLAYLIST},{timeout:WAIT});
 await t.expect(`the playlist "${PLAYLIST}" opens with three items`,async()=>{
  const name=t.page.getByLabel('Playlist name',{exact:true});
  await eventually(async()=>{const value=await name.inputValue();return value===PLAYLIST?null:`the editor shows "${value}"`;});
  await t.page.getByRole('listitem',{name:'Item 3',exact:true}).waitFor({timeout:WAIT});
 });
 await tab(t,'Player');
 // A previous step can leave item 1 playing, so wait for a new session rather than for the text.
 const previous=(await player(t)).session?.id;
 await t.page.getByRole('button',{name:'Play playlist',exact:true}).click({timeout:WAIT});
 await t.expect('Play starts a new session at item 1',async()=>{
  await eventually(async()=>{const {player:p,session}=await player(t);return session&&session.id!==previous&&p.itemId===session.playlist.items[0]?.id&&p.state==='playing'?null:'no new playing session';});
  await text(t,'Item 1 of 3');await text(t,/Playback: playing/);
 });
 await settled(t);
}
/** Controls are enabled again once the page has the command's result. */
async function settled(t:StepContext):Promise<void> {
 await eventually(async()=>await t.page.getByRole('button',{name:'Next',exact:true}).isEnabled()?null:'player controls are still busy');
}
const playerPreview=(t:StepContext)=>t.page.getByRole('region',{name:'Player controls'}).getByAltText('Effective preview');
async function playerShows(t:StepContext,item:number,key:MediaKey):Promise<Buffer> {
 let rgb:Buffer=Buffer.alloc(0);
 await t.expect(`item ${item} of 3 shows ${syntheticMedia[key].file}`,async()=>{
  const position=t.page.getByRole('region',{name:'Player controls'}).getByText(/^Item \d+ of \d+$/);
  await eventually(async()=>{const shown=await position.textContent({timeout:WAIT});return shown===`Item ${item} of 3`?null:`the page shows ${shown}`;});
  rgb=await shows(playerPreview(t),key);
 });
 return rgb;
}
async function click(t:StepContext,name:string):Promise<void> {await t.page.getByRole('button',{name,exact:true}).click({timeout:WAIT});}

export const captureSteps:Record<string,Step>={
 'library-selection':{
  description:'Selecting each synthetic medium shows its exact 64×64 effective preview and frame count',
  run:async t=>{
   await openPage(t);await tab(t,'Library');
   const library=t.page.getByRole('region',{name:'Media library',exact:true});
   let quadrants:Buffer=Buffer.alloc(0);
   for(const key of Object.keys(syntheticMedia) as MediaKey[]){
    const media=syntheticMedia[key];
    await library.getByRole('button',{name:new RegExp(media.file.replace('.','\\.'))}).click({timeout:WAIT});
    await t.expect(`${media.file} is selected with ${media.frames.length} frame${media.frames.length>1?'s':''} at 64 × 64`,async()=>{
     await library.getByRole('heading',{name:media.file,exact:true}).waitFor({timeout:WAIT});
     await library.getByText(`64 × 64 · ${media.frames.length} frame${media.frames.length>1?'s':''}`,{exact:true}).waitFor({timeout:WAIT});
    });
    await t.expect(`the effective preview of ${media.file} matches the fixture pixels`,async()=>{
     const rgb=await shows(library.getByAltText('Effective preview'),key);if(key==='quadrants')quadrants=rgb;
    });
   }
   await library.getByRole('button',{name:/verify-quadrants\.png/}).click({timeout:WAIT});
   await saveSimulatorResult(t,'library-quadrants',quadrants,'Library effective preview of verify-quadrants.png');
   await noPhysicalTransport(t);
  },
 },
 'playlist-progression':{
  fresh:true,
  description:`Play "${PLAYLIST}", then Next, Next and Previous show items 1, 2, 3 and 2 with their exact first frames`,
  run:async t=>{
   await openPage(t);await playFromStart(t);
   await playerShows(t,1,'quadrants');
   await click(t,'Next');await playerShows(t,2,'blink');
   await click(t,'Next');await playerShows(t,3,'stripes');
   await click(t,'Previous');const rgb=await playerShows(t,2,'blink');
   await t.expect('the server agrees: item 2 is current and playing',async()=>{
    await eventually(async()=>{const {player:p,session}=await player(t);return p.itemId===session?.playlist.items[1]?.id&&p.state==='playing'?null:`server is on ${p.itemId} (${p.state})`;});
   });
   await saveSimulatorResult(t,'player-item-2',rgb,'Player effective preview after Next, Next, Previous');
   await noPhysicalTransport(t);
  },
 },
 'playback-controls':{
  fresh:true,
  description:'Pause, Resume and Stop change intent without moving the item, and a reload keeps the stopped session',
  run:async t=>{
   await openPage(t);await playFromStart(t);
   await click(t,'Pause playlist');
   await t.expect('Pause keeps item 1 with paused intent',async()=>{await text(t,/Intent: paused/);await text(t,'Item 1 of 3');});
   await click(t,'Resume');
   await t.expect('Resume restarts item 1 with active intent',async()=>{await text(t,/Intent: active/);await text(t,/Playback: playing/);await text(t,'Item 1 of 3');});
   await click(t,'Stop');
   await t.expect('Stop keeps the session and item with stopped intent',async()=>{await text(t,/Intent: stopped/);await text(t,'Item 1 of 3');});
   await t.page.reload({timeout:WAIT*2});await tab(t,'Player');
   await t.expect('after a reload the backend still reports the stopped session',async()=>{await text(t,/Intent: stopped/);await text(t,'Item 1 of 3');await shows(playerPreview(t),'quadrants');});
   await noPhysicalTransport(t);
  },
 },
 'monitor-media':{
  fresh:true,
  description:'Show monitor pauses playback and shows the exact monitor picture; Select Media leaves playback paused until Resume',
  run:async t=>{
   await openPage(t);await playFromStart(t);
   await tab(t,'Monitor');
   await t.expect('the synthetic session is listed in Media mode',async()=>{
    await text(t,'Monitor state connected');await text(t,'Selected mode: Media');
    await t.page.getByRole('heading',{name:SESSION.title,exact:true}).waitFor({timeout:WAIT});await text(t,`Project: ${SESSION.project}`);
   });
   await click(t,'Show monitor');
   await t.expect('Show monitor selects Monitor and activates presentation',async()=>{await text(t,'Selected mode: Monitor');await text(t,'Monitor presentation active');});
   await t.expect('Show monitor paused playback on the backend',async()=>{await eventually(async()=>{const {player:p}=await player(t);return p.intent==='paused'?null:`intent is ${p.intent}`;});});
   const canvas=t.page.locator('canvas[aria-label="Exact monitor preview"]');let monitor:Buffer=Buffer.alloc(0);
   await t.expect('the monitor preview shows the exact server picture',async()=>{
    await eventually(async()=>{
     const view=await api<{dashboard:{rendition:{frames:number[][]}|null}}>(t,'/api/integration/v1/view');
     const frame=Number(await canvas.getAttribute('data-frame')??0),expected=view.dashboard.rendition?.frames[frame];
     monitor=await pixels(canvas);
     return expected&&monitor.equals(Buffer.from(expected))?null:'canvas differs from the server rendition';
    });
   });
   await saveSimulatorResult(t,'monitor',monitor,'Monitor tab exact preview canvas');
   await click(t,'Select Media');
   await t.expect('Select Media deactivates presentation',async()=>{await text(t,'Selected mode: Media');await text(t,'Monitor presentation inactive');});
   await t.expect('Select Media leaves playback paused',async()=>{
    await new Promise(resolve=>setTimeout(resolve,1000));
    const {player:p}=await player(t);if(p.intent!=='paused')throw new Error(`intent is ${p.intent} after Select Media`);
   });
   await tab(t,'Player');await click(t,'Resume');
   await t.expect('Resume continues item 1 in Media mode',async()=>{await text(t,/Intent: active/);await text(t,'Item 1 of 3');});
   await tab(t,'Monitor');
   await t.expect('the Monitor tab still reports Media',async()=>{await text(t,'Selected mode: Media');await text(t,'Monitor presentation inactive');});
   await noPhysicalTransport(t);
  },
 },
 'lost-response-recovery':{
  fresh:true,
  description:'A Next whose response is lost is retried with the same identity and advances exactly once',
  run:async t=>{
   await openPage(t);await playFromStart(t);
   const bodies:unknown[]=[];let lose=true;
   await t.page.route('**/api/player/commands',async route=>{
    const body=route.request().postDataJSON() as {command?:string};
    if(body.command!=='next')return route.fallback();
    bodies.push(body);
    if(lose){lose=false;await route.fetch();t.note('injected failure: the Next response was lost after the server applied it');await route.abort('failed');}
    else await route.fallback();
   });
   await click(t,'Next');
   await t.expect('the lost response is shown as uncertain, not as success or failure',async()=>{await text(t,/Command outcome uncertain/);});
   const before=await player(t);
   await click(t,'Retry command');
   await t.expect('the retry resolves the uncertainty',async()=>{await t.page.getByText(/Command outcome uncertain/).waitFor({state:'detached',timeout:WAIT});});
   await t.expect('the retry reused the original request identity',()=>{
    if(bodies.length!==2)throw new Error(`${bodies.length} command requests were sent`);
    if(JSON.stringify(bodies[0])!==JSON.stringify(bodies[1]))throw new Error('the retry changed the request');
   });
   await playerShows(t,2,'blink');
   await t.expect('the retry replayed no second effect',async()=>{
    const after=await player(t);
    if(after.player.generation!==before.player.generation||after.player.itemId!==before.player.itemId)throw new Error('the retry changed playback');
   });
   await t.page.unroute('**/api/player/commands');
   await noPhysicalTransport(t);
  },
 },
 'device-boundary':{
  description:'Settings and a simulator probe show simulator transport; the run has sent no physical request',
  run:async t=>{
   await openPage(t);await tab(t,'Settings');
   await t.expect('Settings reports the simulator',async()=>{
    await text(t,'Simulator remains active. Saving a device address does not connect to hardware.');
    await t.page.getByRole('heading',{name:'Simulated display controls',exact:true}).waitFor({timeout:WAIT});
   });
   await click(t,'Probe simulator');
   await t.expect('the probe reaches only the simulator',async()=>{await text(t,'Simulator probe completed. Physical connectivity is unverified.');});
   await t.expect('health and device settings report simulator mode',async()=>{const result=await checkSimulatorMode(t);if(result.outcome!=='passed')throw new Error(result.reason);});
   await noPhysicalTransport(t);
  },
 },
};
