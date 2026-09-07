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
export async function registerApi(app:FastifyInstance,dataDir:string):Promise<void> {
 const library=await Library.open({directory:join(dataDir,'library')});
 const device=new FakeDeviceAdapter();let player:Player;
 try{player=await Player.open({store:new LibraryPlaybackStore(library),device});}catch(error){await library.close();throw error;}
 app.addHook('onClose',async()=>{try{await player.close();}finally{await library.close();}});
 let changed=()=>{};
 const commands=new Commands(),snapshot=playerRoutes(app,player,commands,()=>changed());
 const events=new Events(snapshot);changed=()=>events.publish();const unsubscribe=player.subscribe(changed);events.register(app);
 app.addHook('preClose',async()=>{unsubscribe();events.close();});
 await deviceRoutes(app,dataDir,player,commands,snapshot,changed);
 await catalogRoutes(app,library);
}
