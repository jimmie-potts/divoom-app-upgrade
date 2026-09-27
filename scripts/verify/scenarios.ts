// Named, deterministic synthetic scenarios for Pixoo verification runs. Every
// image is generated here from exact 64×64 RGB pixels, so capture steps can
// compare what the page shows against an oracle that does not come from the
// server under test. Nothing reads the owner's media or data.
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import {assertSeedable,type OwnerContext} from './run-environment.ts';

type RGB=readonly [number,number,number];
const SIZE=64;
function picture(color:(x:number,y:number)=>RGB):Buffer {
 const rgb=Buffer.alloc(SIZE*SIZE*3);
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)rgb.set(color(x,y),(y*SIZE+x)*3);
 return rgb;
}
const RED:RGB=[255,0,0],GREEN:RGB=[0,255,0],BLUE:RGB=[0,0,255],WHITE:RGB=[255,255,255],BLACK:RGB=[0,0,0],YELLOW:RGB=[255,255,0],MAGENTA:RGB=[255,0,255],CYAN:RGB=[0,255,255];
const square=(fill:RGB)=>picture((x,y)=>x>=16&&x<48&&y>=16&&y<48?fill:BLACK);

export interface SyntheticMedia {file:string;description:string;frames:readonly Buffer[];delayMs?:number}
/** The synthetic library. Four distinct quadrants expose any flip, rotation or crop. */
export const syntheticMedia={
 quadrants:{file:'verify-quadrants.png',description:'Still: red, green, blue and white quadrants',frames:[picture((x,y)=>y<32?(x<32?RED:GREEN):(x<32?BLUE:WHITE))]},
 blink:{file:'verify-blink.gif',description:'Animation: red then cyan centred square, 500 ms per frame',frames:[square(RED),square(CYAN)],delayMs:500},
 stripes:{file:'verify-stripes.png',description:'Still: eight vertical yellow and magenta stripes',frames:[picture(x=>Math.floor(x/8)%2?MAGENTA:YELLOW)]},
} as const satisfies Record<string,SyntheticMedia>;
export type MediaKey=keyof typeof syntheticMedia;

async function encode(media:SyntheticMedia):Promise<Buffer> {
 const raw={width:SIZE,height:SIZE*media.frames.length,channels:3 as const,pageHeight:SIZE};
 const image=sharp(Buffer.concat(media.frames),{raw});
 return media.frames.length>1?image.gif({delay:media.frames.map(()=>media.delayMs??500),loop:0,dither:0,effort:1}).toBuffer():image.png().toBuffer();
}

/** Long dwell so a capture step never races automatic advancement. */
const STILL={mode:'duration',durationMs:60000} as const,ANIMATION={mode:'plays',totalPlays:60} as const;
export const PLAYLIST='Verification loop';
/** The synthetic agent session shown in the Monitor tab. */
export const SESSION={title:'Synthetic verification task',project:'VERIFY-PIXOO',projectId:'verify-project',sessionId:'verify-session-1'};

export interface ScenarioDefinition {description:string;playlist:readonly MediaKey[]|null;session:boolean}
export const scenarioDefinitions={
 'library-playlist':{description:`Three synthetic media, the playlist "${PLAYLIST}" (quadrants, blink, stripes) and one synthetic agent session`,playlist:['quadrants','blink','stripes'],session:true},
 empty:{description:'No media, no playlists and no agent sessions',playlist:null,session:false},
} as const satisfies Record<string,ScenarioDefinition>;
export type ScenarioName=keyof typeof scenarioDefinitions;
export const defaultScenario:ScenarioName='library-playlist';

export interface SeedInput {runId:string;dataDir:string;scenario:string}
/** Write one scenario into the run's empty data directory, before the server starts. */
export async function seedScenario({dataDir,scenario}:SeedInput,owner:OwnerContext={}):Promise<void> {
 if(!Object.hasOwn(scenarioDefinitions,scenario))throw new Error(`Unknown scenario ${scenario}`);
 const definition:ScenarioDefinition=scenarioDefinitions[scenario as ScenarioName];
 const data=await assertSeedable(dataDir,owner);
 // Built modules load here, not at module load: the core builds the checkout before it seeds.
 const [{Library},{provisionCredential,revokeCredential}]=await Promise.all([import('@pixoo/library'),import('../../apps/server/dist/mcp-config.js')]);
 if(definition.playlist){
  const library=await Library.open({directory:join(data,'library')});
  try{
   const renditions=new Map<MediaKey,string>();
   for(const key of Object.keys(syntheticMedia) as MediaKey[]){
    const bytes=await encode(syntheticMedia[key]);
    const {rendition}=await library.importMedia((async function*(){yield bytes;})(),syntheticMedia[key].file);
    renditions.set(key,rendition.id);
   }
   const playlist=await library.createPlaylist(PLAYLIST);
   await library.replaceItems(playlist.id,playlist.revision,definition.playlist.map(key=>({renditionId:renditions.get(key)!,playback:syntheticMedia[key].frames.length>1?ANIMATION:STILL})));
  }finally{await library.close();}
 }
 const monitor=join(data,'agent-monitor');
 await mkdir(monitor,{mode:0o700});
 await writeFile(join(monitor,'config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'verify-owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]}),{mode:0o600});
 // The monitor requires a credential store to start. The seed credential is revoked and its token never stored.
 const token=await provisionCredential(monitor,'verify-seed',['control']);
 try{if(definition.session)await seedSession(data,token);}
 finally{await revokeCredential(monitor,'verify-seed');}
}

/** Post one synthetic lifecycle event through the actual monitor route of an in-process simulator app with no listener. */
async function seedSession(dataDir:string,token:string):Promise<void> {
 const {createApp}=await import('../../apps/server/dist/app.js');
 const app=createApp({dataDir,mode:'simulator',monitorEnabled:true});
 try{
  const event={apiVersion:'1.1',title:{value:SESSION.title,source:'provider'},project:SESSION.project,projectId:SESSION.projectId,
   identity:{provider:'codex',client:'cli',hostId:'verify-host',sourceId:'verify-source',sessionId:SESSION.sessionId},turn:{status:'known',id:'verify-turn-1'},
   parent:{status:'top-level'},ordering:{status:'known',epoch:'verify',sequence:1},observedAtMs:Date.now(),event:{kind:'turn.ended'}};
  const response=await app.inject({method:'POST',url:'/api/monitor/v1/events',headers:{host:'127.0.0.1',authorization:`Bearer ${token}`,'x-pixoo-request':'1'},payload:event});
  if(response.statusCode!==200)throw new Error(`Synthetic session was not accepted (${response.statusCode})`);
 }finally{await app.close();}
}
