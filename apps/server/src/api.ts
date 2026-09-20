import type {FastifyInstance} from 'fastify';
import {Library} from '@pixoo/library';
import {Player,LibraryPlaybackStore} from '@pixoo/playback';
import {FakeDeviceAdapter,HttpDeviceAdapter,type DeviceTransport} from '@pixoo/device';
import {PIXOO64_SMOKE_PROFILE,SIMULATOR_PROFILE} from '@pixoo/media';
import {deviceRoutes} from './device-routes.js';
import {Events} from './events.js';
import {Commands} from './commands.js';
import {ControlService} from './control-service.js';
import {registerMcp} from './mcp.js';
import {playerRoutes} from './player-routes.js';
import {join} from 'node:path';
import {catalogRoutes} from './catalog-routes.js';
import {assertRuntimeDirectory} from './operations.js';
import {diagnosticsSchema} from '@pixoo/core';
import {loadRuntimeSelection,selectRuntime,type RuntimeSelection,type RuntimeMode} from './device-settings.js';
import {registerMonitor} from './monitor.js';
import {acquireDeviceOwner} from './device-owner.js';
export interface ApiRuntimeOptions {
 mcpEnabled?:boolean;
 monitorEnabled?:boolean;
 mode?:RuntimeMode;
 runtime?:RuntimeSelection;
 transportForTests?:DeviceTransport;
 deviceLockDirectoryForTests?:string;
}
export interface RuntimeStatus {mode:RuntimeMode;connected:boolean|null}
export async function registerApi(app:FastifyInstance,dataDir:string,options:ApiRuntimeOptions={}):Promise<()=>RuntimeStatus> {
 await assertRuntimeDirectory(dataDir);
 const runtime=options.runtime?selectRuntime(options.runtime.mode,options.runtime.savedConfiguration):await loadRuntimeSelection(dataDir,options.mode??'simulator');
 const profile=runtime.mode==='device'?PIXOO64_SMOKE_PROFILE:SIMULATOR_PROFILE;
 let closeMonitor:(()=>Promise<void>)|undefined;
 let releaseOwner:(()=>void)|undefined,library:Library|undefined,physical:HttpDeviceAdapter|undefined,player:Player|undefined;
 const close=async()=>{try{await closeMonitor?.();await player?.close();}finally{try{await physical?.close();}finally{try{await library?.close();}finally{releaseOwner?.();}}}};
 try{
  if(runtime.activeConfiguration)releaseOwner=await acquireDeviceOwner(runtime.activeConfiguration.ip,options.deviceLockDirectoryForTests);
  library=await Library.open({directory:join(dataDir,'library')});
  const device=runtime.activeConfiguration?(physical=new HttpDeviceAdapter({ip:runtime.activeConfiguration.ip,
   profile:{...PIXOO64_SMOKE_PROFILE,evidence:'observed',readyDelayMs:0}},options.transportForTests)):new FakeDeviceAdapter({recordHistory:false});
  await assertRuntimeDirectory(dataDir);
  player=await Player.open({store:new LibraryPlaybackStore(library,{profile,stillDelayMs:runtime.mode==='device'?500:100}),device,pauseOnUncertain:runtime.mode==='device'});
  const active=player;
  const observed=():RuntimeStatus=>({mode:runtime.mode,connected:runtime.mode==='simulator'?false:active.getState().availability==='unknown'?null:active.getState().availability==='available'});
  const started=performance.now();
  app.get('/api/diagnostics',()=>{
   const state=active.getState();
   return diagnosticsSchema.parse({status:'ready',mode:runtime.mode,uptimeMs:Math.floor(performance.now()-started),library:'ready',
    device:{connected:observed().connected,availability:state.availability},player:{state:state.state,intent:state.intent},
    logging:{persistent:false},limits:{requests:32,eventClients:16,eventHistory:32,commandReceipts:256,playbackRenditions:2}});
  });
  let changed=()=>{};
  const commands=new Commands(),service=new ControlService(active,commands,runtime.mode,library,profile,runtime.mode==='device'?500:100),snapshot=playerRoutes(app,active,commands,()=>changed(),service);
  const events=new Events(snapshot);changed=()=>events.publish();const unsubscribe=active.subscribe(changed);events.register(app);
  if(options.monitorEnabled)closeMonitor=await registerMonitor(app,dataDir);
  if(options.mcpEnabled)await registerMcp(app,dataDir,service,changed);
  app.addHook('preClose',async()=>{
   unsubscribe();events.close();
   try{await active.close();}finally{await physical?.close();}
  });
  await deviceRoutes(app,dataDir,active,changed,runtime,service);
  await catalogRoutes(app,library,profile);
  app.addHook('onClose',close);
  return observed;
 }catch(error){await close();throw error;}
}
