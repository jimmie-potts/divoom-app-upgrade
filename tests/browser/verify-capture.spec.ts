import {expect,test,type TestInfo} from '@playwright/test';
import {mkdir,readFile,rm,stat} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import {runCaptureStep} from '@jimmie-potts/app-verify';
import plugin from '../../scripts/verify/plugin.ts';
import {launchSpec} from '../../scripts/verify/run-environment.ts';
import {seedScenario,syntheticMedia} from '../../scripts/verify/scenarios.ts';
import {pairingToken,standInHub,writePairingTokens} from '../helpers/stand-in-hub.js';
import {launch,makeRun,type LaunchedRun} from '../helpers/verify-run.js';

// The Pixoo capture steps through the shared core's unsupervised
// runCaptureStep: the same assertion, screenshot and video rules as a
// supervised capture, against the actual server launched exactly as a run
// launches it and under an ambient device mode. A step marked `fresh` is
// preceded by the reseed-and-relaunch the supervised capture performs.
test.describe.configure({mode:'serial'});

/** A run seeded with `scenario`; `setup` runs after the run directory exists and before the first seed, as the orchestrator writes its tokens. */
async function startRun(scenario='library-playlist',inputs:Record<string,string>={},setup?:(runtimeDir:string)=>Promise<void>){
 const run=await makeRun(`pixoo-20260927T000000Z-${Math.random().toString(16).slice(2,8)}`);
 await setup?.(run.runtimeDir);
 const ambient={...process.env,PIXOO_MODE:'device',NODE_OPTIONS:''};
 const boot=async(port:number)=>{await seedScenario({...run,scenario,inputs});return launch(launchSpec({...run,port,node:process.execPath,scenario,inputs}),ambient);};
 let server:LaunchedRun=await boot(0);
 return {...run,scenario,inputs,get server(){return server;},
  async reseed(){const port=server.port;await server.stop();await rm(run.dataDir,{recursive:true,force:true});await mkdir(run.dataDir,{mode:0o700});server=await boot(port);},
  async close(){await server.stop();await run.remove();}};
}
type Run=Awaited<ReturnType<typeof startRun>>;
async function capture(info:TestInfo,run:Run,step:string,output=step){
 if(plugin.captureSteps[step]?.fresh)await run.reseed();
 const outputDir=info.outputPath(output);
 // A paired run announces its controller endpoint on its own origin, as the ready line does.
 const endpoints=run.scenario==='hub-paired'?{controller:run.server.url}:{};
 const result=await runCaptureStep(plugin,step,{url:run.server.url,outputDir,scenario:run.scenario,inputs:run.inputs,endpoints,dataDir:run.dataDir,runtimeDir:run.runtimeDir,runId:run.runId});
 return {...result,outputDir,failed:result.assertions.find(assertion=>assertion.outcome==='failed')};
}
const standalone=(step:string)=>plugin.captureSteps[step]!.scenario!=='hub-paired';
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
  const steps=Object.keys(plugin.captureSteps).filter(step=>!step.startsWith('control-')&&standalone(step));
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
   ['control-retry-new-identity',/^the retry replayed no second effect$/,/^the retry changed playback$/],
  ];
  expect(Object.keys(plugin.captureSteps).filter(step=>step.startsWith('control-')&&standalone(step)).sort()).toEqual(cases.map(([step])=>step).sort());
  for(const [step,assertion,reason] of cases){
   const result=await capture(info,run,step);
   expect(result.outcome,step).toBe('failed');
   expect(result.reason?.startsWith(`assertion failed: ${result.failed?.name}`),`${step}: ${result.reason}`).toBe(true);
   expect(result.failed?.name,step).toMatch(assertion);expect(result.failed?.error,step).toMatch(reason);
   const log=JSON.parse(await readFile(result.log,'utf8'));
   expect(log.notes[0],step).toMatch(/injected known-wrong behavior: /);
   await nonEmpty(result.screenshot);await nonEmpty(result.video);
  }
  // The same run still passes reference steps after the controls: a fresh one, and one on the state they left.
  for(const step of ['playlist-progression','device-boundary']){
   const result=await capture(info,run,step);
   expect(result.outcome,`${step} after the controls: ${result.reason}`).toBe('passed');
  }
 }finally{await run.close();}
});

test('hub-paired: the Monitor shows a stand-in Hub\'s sessions and its control fails when the page reports the feed stale',async({isMobile},info)=>{
 test.skip(isMobile,'capture steps open their own fixed desktop context');
 test.setTimeout(240000);
 const tokens={feed:pairingToken(),controller:pairingToken()},hub=await standInHub(tokens.feed);
 try{
  await hub.event('session.started');hub.setFeed('accept');
  const run=await startRun('hub-paired',{'hub-feed':hub.origin},runtimeDir=>writePairingTokens(runtimeDir,tokens));
  try{
   const reference=await capture(info,run,'hub-sessions');
   expect(reference.outcome,`hub-sessions: ${reference.reason} ${JSON.stringify(reference.failed)}`).toBe('passed');
   await nonEmpty(reference.screenshot);await nonEmpty(reference.video);
   await sixtyFour(join(reference.outputDir,'simulator-64x64-hub-monitor.png'));
   expect(JSON.parse(await readFile(join(reference.outputDir,'transport-allowed.json'),'utf8'))).toMatchObject({runPort:run.server.port,hubPort:hub.port,allowed:{hub:expect.any(Number)},blocked:0});
   expect(reference.assertions.map(assertion=>assertion.name)).toEqual(expect.arrayContaining(['the Monitor lists every Hub session and its project from a current source',
    'one brightness.set with the Hub\'s token reaches the writer once, and its replay returns the same receipt','another token reads nothing and sends nothing to the writer']));
   const command=JSON.parse(await readFile(join(reference.outputDir,'controller-command.json'),'utf8'));
   expect(command).toMatchObject({command:'brightness.set',status:200,replayIdentical:true});
   expect(command.writer.after.setBrightness.admitted-command.writer.before.setBrightness.admitted).toBe(1);
   expect(command.writer.afterReplay).toEqual(command.writer.after);
   const log=await readFile(reference.log,'utf8');
   for(const token of Object.values(tokens))expect(log).not.toContain(token);
   const control=await capture(info,run,'control-hub-feed-stale');
   expect(control.outcome).toBe('failed');
   expect(control.failed?.name).toBe('the Monitor lists every Hub session and its project from a current source');
   expect(JSON.parse(await readFile(control.log,'utf8')).notes[0]).toMatch(/injected known-wrong behavior: the page's monitor view reports the Hub feed stale/);
   // The reference step passes again on the same run after the control's fresh reseed.
   const again=await capture(info,run,'hub-sessions','hub-sessions-after-control');
   expect(again.outcome,`hub-sessions after the control: ${again.reason}`).toBe('passed');
  }finally{await run.close();}
 }finally{await hub.close();}
});
