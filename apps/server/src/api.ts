import type {FastifyInstance} from 'fastify';
import {Library} from '@pixoo/library';
import {Player,LibraryPlaybackStore} from '@pixoo/playback';
import {FakeDeviceAdapter} from '@pixoo/device';
import {deviceRoutes} from './device-routes.js';
import {Events} from './events.js';
import {Commands} from './commands.js';
import {playerRoutes} from './player-routes.js';
import {join} from 'node:path';
import {catalogRoutes} from './catalog-routes.js';
import {assertRuntimeDirectory} from './operations.js';
import {diagnosticsSchema} from '@pixoo/core';
export async function registerApi(app:FastifyInstance,dataDir:string):Promise<void> {
 await assertRuntimeDirectory(dataDir);
 const library=await Library.open({directory:join(dataDir,'library')});
 const device=new FakeDeviceAdapter({recordHistory:false});let player:Player;
 try{await assertRuntimeDirectory(dataDir);player=await Player.open({store:new LibraryPlaybackStore(library),device});}catch(error){await library.close();throw error;}
 app.addHook('onClose',async()=>{try{await player.close();}finally{await library.close();}});
 const started=performance.now();
 app.get('/api/diagnostics',()=>{
  const state=player.getState();
  return diagnosticsSchema.parse({status:'ready',mode:'simulator',uptimeMs:Math.floor(performance.now()-started),library:'ready',
   device:{connected:false,availability:state.availability},player:{state:state.state,intent:state.intent},
   logging:{persistent:false},limits:{requests:32,eventClients:16,eventHistory:32,commandReceipts:256,playbackRenditions:2}});
 });
 let changed=()=>{};
 const commands=new Commands(),snapshot=playerRoutes(app,player,commands,()=>changed());
 const events=new Events(snapshot);changed=()=>events.publish();const unsubscribe=player.subscribe(changed);events.register(app);
 app.addHook('preClose',async()=>{unsubscribe();events.close();});
 await deviceRoutes(app,dataDir,player,commands,snapshot,changed);
 await catalogRoutes(app,library);
}
