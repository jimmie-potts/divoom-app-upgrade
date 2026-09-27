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
import {HUB_FEED_INPUT,HUB_PAIRED,announcesController} from './pairing.ts';
import {checkHubFeed,checkNoPhysicalTransport,checkSimulatorMode,failureCause,probeHealth,readyLine} from './readiness.ts';
import {assertPrivateDataDir,checkoutRoot,launchSpec} from './run-environment.ts';
import {defaultScenario,scenarioDefinitions,seedScenario} from './scenarios.ts';

const {version}=JSON.parse(await readFile(join(checkoutRoot,'package.json'),'utf8')) as {version:string};
/**
 * Whether the latest launch announces the `controller` endpoint. The core
 * reads the ready line in the process that just called `launch`, and the line
 * itself cannot tell a paired launch apart, so `launch` records it here.
 */
let controllerEndpoint=false;

const plugin:AppPlugin={
 app:'pixoo',
 repository:'jimmie-potts/divoom-app-upgrade',
 command:'npm run verify --',
 root:checkoutRoot,
 defaultScenario,
 scenarios:Object.fromEntries(Object.entries(scenarioDefinitions).map(([name,definition])=>[name,{
  description:definition.description,
  ...(name===HUB_PAIRED?{requiredInputs:[HUB_FEED_INPUT]}:{}),
  seed:(context:{runId:string;runtimeDir:string;dataDir:string;scenario:string;inputs:Readonly<Record<string,string>>})=>seedScenario(context),
 }])),
 // Optional for the plug-in, required by hub-paired. Tokens never travel as inputs; see scripts/verify/pairing.ts.
 inputs:{[HUB_FEED_INPUT]:{description:'The paired Hub run\'s origin, http://127.0.0.1:<port>/, for hub-paired: Pixoo reads its session feed and serves it the controller API'}},
 // The served page names its content-hashed bundle, so its digest changes with the web build.
 // Runs from one checkout share its build: rebuilding it changes what a live preview serves.
 // doctor reports the changed digest; capture does not check it.
 build:{version,artifact:{route:'/'},prepare:({root,signal})=>runBuild(root,signal)},
 launch:async(context:{runtimeDir:string;dataDir:string;port:number;node:string;scenario:string;inputs:Readonly<Record<string,string>>;endpointPorts:Readonly<Record<string,number>>})=>{
  await assertPrivateDataDir(context.dataDir);
  const spec=launchSpec(context);
  controllerEndpoint=announcesController(context);
  return spec;
 },
 // In hub-paired, and in every later scenario of that run, the ready line announces the controller endpoint: the
 // main origin, where a paired launch serves /controller/v1 and /controller/pixoo-integration/v1. The core holds a
 // recorded endpoint to its port, so it stays announced after a reseed; only a paired launch serves those routes.
 readiness:{line:(line:string)=>readyLine(line,controllerEndpoint),probe:probeHealth,failureCause},
 components:[
  {id:'pixoo-server',kind:'actual',note:'Fastify server from apps/server/dist/main.js with the library, player and monitor; embedded owner standalone, remote Hub feed in hub-paired'},
  {id:'web-ui',kind:'actual',note:'apps/web/dist served by the same process'},
  {id:'controller-api',kind:'actual',note:'the native controller API and Pixoo integration extension, enabled only in hub-paired for the paired Hub run'},
  {id:'device-transport',kind:'simulated',note:'PIXOO_MODE=simulator selects the fake adapter; scripts/verify/transport-guard.ts blocks and records any physical request or connection to installed local services, and allows only the declared Hub port in hub-paired'},
  {id:'media',kind:'simulated',note:'synthetic 64x64 PNG and GIF fixtures from scripts/verify/scenarios.ts'},
  {id:'agent-sessions',kind:'simulated',note:'standalone: one synthetic lifecycle event posted at seed with a revoked run-generated credential; hub-paired: the paired Hub run\'s synthetic sessions'},
 ],
 // Every check only reads the run, so doctor repeats them.
 checks:[
  {id:'simulator-mode',doctor:true,run:checkSimulatorMode},
  {id:'no-physical-transport',doctor:true,run:checkNoPhysicalTransport},
  {id:'hub-feed',doctor:true,run:checkHubFeed},
 ],
 captureSteps:{...captureSteps,...controlSteps},
};
export default plugin;
