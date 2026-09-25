import {afterEach,expect,it,vi} from 'vitest';
import {mkdtemp,mkdir,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../../apps/server/src/app.js';
import {provisionCredential} from '../../apps/server/src/mcp-config.js';
import {multipart} from '../helpers/http-api.js';
import {gifFixture} from '../helpers/media-fixtures.js';
const prefix='/api/integration/v1',headers={'x-pixoo-request':'1'};
const configuration={ip:'192.168.50.20',profile:'pixoo64-smoke-2026-09-06'} as const;
const cleanup:(()=>Promise<unknown>)[]=[];
afterEach(async()=>{for(const close of cleanup.splice(0).reverse())await close();});
async function directory(){const path=await mkdtemp(join(tmpdir(),'pixoo-monitor-startup-'));cleanup.push(()=>rm(path,{recursive:true,force:true}));return path;}
async function dataDirectory(mode:'monitor'|'media'){
 const dataDir=await directory(),monitor=join(dataDir,'agent-monitor');await mkdir(monitor);
 await writeFile(join(dataDir,'device.json'),JSON.stringify({version:1,configuration}));
 await writeFile(join(monitor,'config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]}));
 await provisionCredential(monitor,'writer',['read','control']);
 await writeFile(join(monitor,'presentation.json'),JSON.stringify({version:1,mode,filter:{},cadenceMs:1000}));
 return dataDir;
}
type Transport=(body:Record<string,unknown>)=>Promise<Record<string,unknown>>;
async function start(dataDir:string,mode:'device'|'simulator',transport:Transport){
 const deviceLockDirectoryForTests=await directory();
 const app=createApp({dataDir,mode,monitorEnabled:true,deviceLockDirectoryForTests,transportForTests:body=>transport(body)});cleanup.push(()=>app.close());
 await app.ready();return app;
}
const recorder=(fail=false)=>{
 const commands:string[]=[];
 const transport:Transport=async body=>{commands.push(String(body.Command));if(fail&&body.Command==='Draw/SendHttpGif')throw new Error('uncertain send');return {error_code:0,PicId:1};};
 return {commands,transport};
};

it('restores saved Monitor presentation at device startup through the serialized adapter',async()=>{
 const dataDir=await dataDirectory('monitor'),device=recorder();
 const app=await start(dataDir,'device',device.transport);
 await vi.waitFor(()=>expect(device.commands).toContain('Draw/SendHttpGif'),{timeout:3000});
 const snapshot=(await app.inject(prefix+'/snapshot')).json();
 expect(snapshot).toMatchObject({configuration:{mode:'monitor'},participating:true,lastOutcome:{status:'sent'}});
 expect(device.commands).toEqual(['Draw/GetHttpGifId','Draw/SendHttpGif']);
 expect((await app.inject('/api/player')).json().player.intent).toBe('paused');
 expect(JSON.parse(await readFile(join(dataDir,'agent-monitor','presentation.json'),'utf8'))).toMatchObject({mode:'monitor'});
});

it('suspends monitoring after a failed startup transmission without retrying',async()=>{
 const dataDir=await dataDirectory('monitor'),device=recorder(true);
 const app=await start(dataDir,'device',device.transport);
 await vi.waitFor(async()=>expect((await app.inject(prefix+'/snapshot')).json()).toMatchObject({participating:false,lastOutcome:{status:'uncertain'}}),{timeout:3000});
 await new Promise(resolve=>setTimeout(resolve,1500));
 expect(device.commands).toEqual(['Draw/GetHttpGifId','Draw/SendHttpGif']);
 expect((await app.inject(prefix+'/snapshot')).json()).toMatchObject({configuration:{mode:'monitor'},participating:false});
 const snapshot=(await app.inject(prefix+'/snapshot')).json();
 const activation=await app.inject({method:'POST',url:prefix+'/commands',headers,payload:{apiVersion:'pixoo-integration/1.0',requestId:snapshot.nextRequestId,expectedConfigurationRevision:snapshot.configurationRevision,expectedGeneration:snapshot.generation,action:{operation:'mode',mode:'monitor'}}});
 expect(activation.json()).toMatchObject({participating:true});
});

it('keeps Media, simulator and screen-off startup passive',async()=>{
 const media=recorder(),mediaApp=await start(await dataDirectory('media'),'device',media.transport);
 const simulatorApp=await start(await dataDirectory('monitor'),'simulator',async()=>{throw new Error('Simulator must not use the device transport');});
 // The player retains a requested screen-off state with saved playback context.
 const screenDir=await dataDirectory('media'),screenApp=await start(screenDir,'device',recorder().transport);
 const asset=(await screenApp.inject({method:'POST',url:'/api/assets',...multipart(gifFixture(1,1,[{width:1,height:1,pixels:[1],delay:50},{width:1,height:1,pixels:[2],delay:50}]))})).json();
 const playlist=(await screenApp.inject({method:'POST',url:'/api/playlists',headers,payload:{name:'Screen'}})).json();
 await screenApp.inject({method:'PUT',url:`/api/playlists/${playlist.id}/items`,headers,payload:{revision:1,items:[{renditionId:asset.rendition.id}]}});
 const player=(await screenApp.inject('/api/player')).json();
 expect((await screenApp.inject({method:'POST',url:'/api/player/commands',headers,payload:{requestId:player.nextRequestId,command:'start',playlistId:playlist.id}})).statusCode).toBe(200);
 const initial=(await screenApp.inject(prefix+'/snapshot')).json();
 expect((await screenApp.inject({method:'POST',url:prefix+'/commands',headers,payload:{apiVersion:'pixoo-integration/1.0',requestId:initial.nextRequestId,expectedConfigurationRevision:initial.configurationRevision,expectedGeneration:initial.generation,action:{operation:'mode',mode:'monitor'}}})).json()).toMatchObject({participating:true});
 const requestId=(await screenApp.inject('/api/player')).json().nextRequestId;
 expect((await screenApp.inject({method:'PATCH',url:'/api/device/display',headers,payload:{requestId,screenOn:false}})).statusCode).toBe(200);
 await screenApp.close();
 const off=recorder(),offApp=await start(screenDir,'device',off.transport);
 await new Promise(resolve=>setTimeout(resolve,1500));
 expect(media.commands).toEqual([]);expect(off.commands).toEqual([]);
 for(const app of [mediaApp,simulatorApp,offApp])expect((await app.inject(prefix+'/snapshot')).json()).toMatchObject({participating:false});
 expect((await mediaApp.inject(prefix+'/snapshot')).json().configuration.mode).toBe('media');
});
