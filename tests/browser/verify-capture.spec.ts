import {expect,test,type Browser,type TestInfo} from '@playwright/test';
import {stat,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {captureSteps,type StepContext} from '../../scripts/verify/capture-steps.ts';
import {controlSteps} from '../../scripts/verify/controls.ts';
import {launchSpec} from '../../scripts/verify/run-environment.ts';
import {seedScenario,syntheticMedia} from '../../scripts/verify/scenarios.ts';
import {launch,makeRun} from '../helpers/verify-run.js';

// Source tests of the Pixoo verification capture steps against the actual
// server, launched exactly as a run launches it and under an ambient device
// mode. The harness mirrors the shared core's capture rule: a step passes only
// with at least one assertion, all passing, no crash and a finalized video.
test.describe.configure({mode:'serial'});
test.skip(({isMobile})=>isMobile,'capture steps open their own fixed desktop context');

async function startRun(scenario:string){
 const run=await makeRun();
 await seedScenario({...run,scenario});
 const server=await launch(launchSpec({...run,port:0,node:process.execPath}),{...process.env,PIXOO_MODE:'device',NODE_OPTIONS:''});
 return {...run,scenario,server,async close(){await server.stop();await run.remove();}};
}
type Run=Awaited<ReturnType<typeof startRun>>;
interface Entry {assertion?:string;outcome?:'passed'|'failed';reason?:string;note?:string}

const steps={...captureSteps,...controlSteps};
async function capture(browser:Browser,info:TestInfo,run:Run,step:string){
 const label=step,videoDir=info.outputPath(`${label}-video`);
 const context=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:videoDir,size:{width:1280,height:800}}});
 const page=await context.newPage();
 const log:Entry[]=[],files=new Map<string,Uint8Array|string>();
 const t:StepContext={page,url:run.server.url,port:run.server.port,runId:run.runId,scenario:run.scenario,runtimeDir:run.runtimeDir,signal:AbortSignal.timeout(60000),
  async expect(name,check){try{await check();log.push({assertion:name,outcome:'passed'});}catch(error){log.push({assertion:name,outcome:'failed',reason:error instanceof Error?error.message:String(error)});throw error;}},
  note(message){log.push({note:message});},
  async screenshot(name){await page.screenshot({path:info.outputPath(`${label}-${name}.png`)});},
  async attach(name,body){files.set(name,body);await writeFile(info.outputPath(`${label}-${name}`),body);},
 };
 let crash:unknown;
 try{await steps[step]!.run(t);}catch(error){crash=error;if(!log.some(entry=>entry.outcome==='failed'))log.push({note:`step error: ${error instanceof Error?error.message:String(error)}`});}
 const screenshot=info.outputPath(`${label}-after.png`);await page.screenshot({path:screenshot});
 const video=page.video()!;await context.close();const videoPath=await video.path();
 const assertions=log.filter(entry=>entry.assertion);
 const passed=!crash&&assertions.length>0&&assertions.every(entry=>entry.outcome==='passed');
 await writeFile(info.outputPath(`${label}-assertions.json`),JSON.stringify(log,null,1));
 return {outcome:passed?'passed':'failed',failed:assertions.find(entry=>entry.outcome==='failed'),log,files,screenshot,video:videoPath};
}
async function nonEmpty(path:string){expect((await stat(path)).size).toBeGreaterThan(0);}
async function sixtyFour(body:Uint8Array|string|undefined){
 const {data,info}=await sharp(Buffer.from(body as Uint8Array)).removeAlpha().raw().toBuffer({resolveWithObject:true});
 expect([info.width,info.height]).toEqual([64,64]);return data;
}

test('reference: every capture step passes against the actual server and saves labelled 64×64 results',async({browser},info)=>{
 test.setTimeout(180000);
 const run=await startRun('library-playlist');
 try{
  const results:Record<string,Awaited<ReturnType<typeof capture>>>={};
  for(const step of ['library-selection','playlist-progression','playback-controls','monitor-media','lost-response-recovery','device-boundary']){
   const result=results[step]=await capture(browser,info,run,step);
   expect(result.outcome,`${step}: ${JSON.stringify(result.log.slice(-2))}`).toBe('passed');
   await nonEmpty(result.screenshot);await nonEmpty(result.video);
  }
  expect(await sixtyFour(results['library-selection']!.files.get('simulator-64x64-library-quadrants.png'))).toEqual(syntheticMedia.quadrants.frames[0]);
  expect(await sixtyFour(results['playlist-progression']!.files.get('simulator-64x64-player-item-2.png'))).toEqual(syntheticMedia.blink.frames[0]);
  expect((await sharp(Buffer.from(results['playlist-progression']!.files.get('simulator-64x64-player-item-2-x8.png') as Uint8Array)).metadata()).width).toBe(512);
  await sixtyFour(results['monitor-media']!.files.get('simulator-64x64-monitor.png'));
  const label=JSON.parse(String(results['playlist-progression']!.files.get('simulator-64x64-player-item-2.json')));
  expect(label).toMatchObject({label:expect.stringMatching(/^Simulator rendering: .*not evidence of physical display output/),runId:run.runId,scenario:'library-playlist',shows:'verify-blink.gif frame 0'});
  expect(results['lost-response-recovery']!.log).toContainEqual({note:'injected failure: the Next response was lost after the server applied it'});
 }finally{await run.close();}
});

test('negative controls: each control step fails at the assertion that names its known-wrong behavior',async({browser},info)=>{
 test.setTimeout(180000);
 const run=await startRun('library-playlist');
 try{
  const cases:[string,RegExp,RegExp][]=[
   ['control-wrong-frame',/effective preview of verify-quadrants\.png matches/,/shows verify-stripes\.png frame 0, expected verify-quadrants\.png frame 0/],
   ['control-duplicate-next',/item 2 of 3 shows verify-blink\.gif/,/the page shows Item 3 of 3/],
   ['control-select-media-resumes',/Select Media leaves playback paused/,/intent is active after Select Media/],
   ['control-retry-new-identity',/item 2 of 3 shows verify-blink\.gif|the retry replayed no second effect/,/./],
  ];
  expect(Object.keys(controlSteps).sort()).toEqual(cases.map(([step])=>step).sort());
  for(const [step,assertion,reason] of cases){
   const result=await capture(browser,info,run,step);
   expect(result.outcome,step).toBe('failed');
   expect(result.failed?.assertion,step).toMatch(assertion);expect(result.failed?.reason,step).toMatch(reason);
   expect(result.log[0]?.note,step).toMatch(/^injected known-wrong behavior: /);
   await nonEmpty(result.screenshot);await nonEmpty(result.video);
  }
  // A run that served the controls still passes the reference step from a fresh session.
  expect((await capture(browser,info,run,'playlist-progression')).outcome).toBe('passed');
 }finally{await run.close();}
});
