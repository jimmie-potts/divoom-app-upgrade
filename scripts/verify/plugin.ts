// The Pixoo plug-in for the shared app verification core (Hub #494,
// @jimmie-potts/app-verify). The core owns the run lifecycle; this file
// supplies only what is specific to Pixoo. Node runs it directly with type
// stripping.
import type {AppPlugin} from '@jimmie-potts/app-verify';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {runBuild} from './build.ts';
import {captureSteps} from './capture-steps.ts';
import {controlSteps} from './controls.ts';
import {checkNoPhysicalTransport,checkSimulatorMode,failureCause,probeHealth,readyLine} from './readiness.ts';
import {assertPrivateDataDir,checkoutRoot,launchSpec} from './run-environment.ts';
import {defaultScenario,scenarioDefinitions,seedScenario} from './scenarios.ts';

const {version}=JSON.parse(await readFile(join(checkoutRoot,'package.json'),'utf8')) as {version:string};

const plugin:AppPlugin={
 app:'pixoo',
 repository:'jimmie-potts/divoom-app-upgrade',
 command:'npm run verify --',
 root:checkoutRoot,
 defaultScenario,
 scenarios:Object.fromEntries(Object.entries(scenarioDefinitions).map(([name,definition])=>[name,{
  description:definition.description,
  seed:(context:{runId:string;dataDir:string;scenario:string})=>seedScenario(context),
 }])),
 // The served page names its content-hashed bundle, so its digest changes with the web build.
 // Runs from one checkout share its build: rebuilding it changes what a live preview serves.
 // doctor reports the changed digest; capture does not check it.
 build:{version,artifact:{route:'/'},prepare:({root,signal})=>runBuild(root,signal)},
 launch:async(context:{runtimeDir:string;dataDir:string;port:number;node:string})=>{
  await assertPrivateDataDir(context.dataDir);
  return launchSpec(context);
 },
 readiness:{line:readyLine,probe:probeHealth,failureCause},
 components:[
  {id:'pixoo-server',kind:'actual',note:'Fastify server from apps/server/dist/main.js with the library, player and embedded monitor'},
  {id:'web-ui',kind:'actual',note:'apps/web/dist served by the same process'},
  {id:'device-transport',kind:'simulated',note:'PIXOO_MODE=simulator selects the fake adapter; scripts/verify/transport-guard.ts blocks and records any physical request or connection to installed local services'},
  {id:'media',kind:'simulated',note:'synthetic 64x64 PNG and GIF fixtures from scripts/verify/scenarios.ts'},
  {id:'agent-sessions',kind:'simulated',note:'one synthetic lifecycle event posted at seed with a revoked run-generated credential'},
 ],
 // Both checks only read the run, so doctor repeats them.
 checks:[
  {id:'simulator-mode',doctor:true,run:checkSimulatorMode},
  {id:'no-physical-transport',doctor:true,run:checkNoPhysicalTransport},
 ],
 captureSteps:{...captureSteps,...controlSteps},
};
export default plugin;
