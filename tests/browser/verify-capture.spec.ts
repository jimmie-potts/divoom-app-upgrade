import {expect,test,type TestInfo} from '@playwright/test';
import {mkdir,readFile,rm,stat} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import {runCaptureStep} from '@jimmie-potts/app-verify';
import plugin from '../../scripts/verify/plugin.ts';
import {launchSpec} from '../../scripts/verify/run-environment.ts';
import {seedScenario,syntheticMedia} from '../../scripts/verify/scenarios.ts';
import {launch,makeRun,type LaunchedRun} from '../helpers/verify-run.js';

// The Pixoo capture steps through the shared core's unsupervised
// runCaptureStep: the same assertion, screenshot and video rules as a
// supervised capture, against the actual server launched exactly as a run
// launches it and under an ambient device mode. A step marked `fresh` is
// preceded by the reseed-and-relaunch the supervised capture performs.
test.describe.configure({mode:'serial'});

async function startRun(){
 const run=await makeRun(`pixoo-20260927T000000Z-${Math.random().toString(16).slice(2,8)}`);
 const ambient={...process.env,PIXOO_MODE:'device',NODE_OPTIONS:''};
 const boot=async(port:number)=>{await seedScenario({...run,scenario:'library-playlist'});return launch(launchSpec({...run,port,node:process.execPath}),ambient);};
 let server:LaunchedRun=await boot(0);
 return {...run,get server(){return server;},
  async reseed(){const port=server.port;await server.stop();await rm(run.dataDir,{recursive:true,force:true});await mkdir(run.dataDir,{mode:0o700});server=await boot(port);},
  async close(){await server.stop();await run.remove();}};
}
type Run=Awaited<ReturnType<typeof startRun>>;
async function capture(info:TestInfo,run:Run,step:string){
 if(plugin.captureSteps[step]?.fresh)await run.reseed();
 const outputDir=info.outputPath(step);
 const result=await runCaptureStep(plugin,step,{url:run.server.url,outputDir,scenario:'library-playlist',dataDir:run.dataDir,runtimeDir:run.runtimeDir,runId:run.runId});
 return {...result,outputDir,failed:result.assertions.find(assertion=>assertion.outcome==='failed')};
}
async function nonEmpty(path:string|null){expect(path).not.toBeNull();expect((await stat(path!)).size).toBeGreaterThan(0);}
async function sixtyFour(path:string){
 const {data,info}=await sharp(path).removeAlpha().raw().toBuffer({resolveWithObject:true});
 expect([info.width,info.height]).toEqual([64,64]);return data;
}

test('reference: every capture step passes against the actual server and saves labelled 64×64 results',async({isMobile},info)=>{
 test.skip(isMobile,'capture steps open their own fixed desktop context');
 test.setTimeout(240000);
 const run=await startRun();
 try{
  const steps=Object.keys(plugin.captureSteps).filter(step=>!step.startsWith('control-'));
  expect(steps).toEqual(['library-selection','playlist-progression','playback-controls','monitor-media','lost-response-recovery','device-boundary']);
  const outputs:Record<string,string>={};
  for(const step of steps){
   const result=await capture(info,run,step);outputs[step]=result.outputDir;
   expect(result.outcome,`${step}: ${result.reason} ${JSON.stringify(result.failed)}`).toBe('passed');
   await nonEmpty(result.screenshot);await nonEmpty(result.video);
  }
  expect(await sixtyFour(join(outputs['library-selection']!,'simulator-64x64-library-quadrants.png'))).toEqual(syntheticMedia.quadrants.frames[0]);
  expect(await sixtyFour(join(outputs['playlist-progression']!,'simulator-64x64-player-item-2.png'))).toEqual(syntheticMedia.blink.frames[0]);
  expect((await sharp(join(outputs['playlist-progression']!,'simulator-64x64-player-item-2-x8.png')).metadata()).width).toBe(512);
  await sixtyFour(join(outputs['monitor-media']!,'simulator-64x64-monitor.png'));
  const label=JSON.parse(await readFile(join(outputs['playlist-progression']!,'simulator-64x64-player-item-2.json'),'utf8'));
  expect(label).toMatchObject({label:expect.stringMatching(/^Simulator rendering: .*not evidence of physical display output/),runId:run.runId,scenario:'library-playlist',shows:'verify-blink.gif frame 0'});
  const log=JSON.parse(await readFile(join(outputs['lost-response-recovery']!,'assertions.json'),'utf8'));
  expect(log.notes).toContainEqual(expect.stringMatching(/injected failure: the Next response was lost after the server applied it$/));
 }finally{await run.close();}
});

test('negative controls: each control step fails at the assertion that names its known-wrong behavior',async({isMobile},info)=>{
 test.skip(isMobile,'capture steps open their own fixed desktop context');
 test.setTimeout(240000);
 const run=await startRun();
 try{
  const cases:[string,RegExp,RegExp][]=[
   ['control-wrong-frame',/effective preview of verify-quadrants\.png matches/,/shows verify-stripes\.png frame 0, expected verify-quadrants\.png frame 0/],
   ['control-duplicate-next',/item 2 of 3 shows verify-blink\.gif/,/the page shows Item 3 of 3/],
   ['control-select-media-resumes',/Select Media leaves playback paused/,/intent is active after Select Media/],
   ['control-retry-new-identity',/item 2 of 3 shows verify-blink\.gif|the retry replayed no second effect/,/./],
  ];
  expect(Object.keys(plugin.captureSteps).filter(step=>step.startsWith('control-')).sort()).toEqual(cases.map(([step])=>step).sort());
  for(const [step,assertion,reason] of cases){
   const result=await capture(info,run,step);
   expect(result.outcome,step).toBe('failed');
   expect(result.reason?.startsWith(`assertion failed: ${result.failed?.name}`),`${step}: ${result.reason}`).toBe(true);
   expect(result.failed?.name,step).toMatch(assertion);expect(result.failed?.error,step).toMatch(reason);
   const log=JSON.parse(await readFile(result.log,'utf8'));
   expect(log.notes[0],step).toMatch(/injected known-wrong behavior: /);
   await nonEmpty(result.screenshot);await nonEmpty(result.video);
  }
 }finally{await run.close();}
});
