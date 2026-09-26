import {expect,it} from 'vitest';
import {invokeDeviceTool,type MachinePrincipal} from '@jimmie-potts/device-mcp';
import {Player} from '@pixoo/playback';
import {FakeDeviceAdapter} from '../../packages/device/src/index.js';
import {ControlService} from '../../apps/server/src/control-service.js';
import {Commands} from '../../apps/server/src/commands.js';
import {createLocalTools} from '../../apps/server/src/mcp-tools.js';
import {MCP_DEVICE_ID} from '../../apps/server/src/mcp-config.js';
import {ManualClock} from '../helpers/manual-clock.js';
import {MemoryPlaybackStore} from '../helpers/playback-store.js';
async function flush(clock:ManualClock){for(let i=0;i<100;i++){await Promise.resolve();clock.advance(0);}}
const principal:MachinePrincipal={id:'reader',credential:{kind:'machine',status:'active',declared:true,devices:[MCP_DEVICE_ID],scopes:['read']}};
it('projects every Player evidence source to a schema-valid public source without refreshing evidence',async()=>{
 const clock=new ManualClock(),store=new MemoryPlaybackStore(),device=new FakeDeviceAdapter({clock});
 const player=await Player.open({store,device,clock}),service=new ControlService(player,new Commands(),'simulator');
 const {registry,tools}=createLocalTools(service,()=>{}),tool=tools.find(t=>t.name==='get_status')!;
 const status=async()=>{const result=await invokeDeviceTool(registry,tool,{},principal);expect(result.isError,JSON.stringify(result.content)).toBeFalsy();return (result.structuredContent as {data:{display:Record<string,unknown>&{transport:{source:string;atMs:number}|null},player:{generation:number}}}).data;};
 const settle=async(work:Promise<unknown>)=>{await flush(clock);await work;clock.advance(10);};
 try{
  expect((await status()).display.transport).toBeNull();
  const steps:[string,string,()=>Promise<unknown>][]=[
   ['probe','probe',()=>player.probe()],
   ['brightness','brightness',()=>player.setBrightness(40)],
   ['upload','upload',()=>player.start(store.playlist.id)],
   ['screen','screen',()=>player.pause().then(()=>player.setScreen(true))],
   ['dashboard','upload',()=>player.uploadDashboard([new Uint8Array(12288)],player.getState().generation)]];
  for(const [internal,external,run] of steps){
   await settle(run());
   expect(player.getDisplayEvidence().transport?.source).toBe(internal);
   expect((await status()).display.transport).toMatchObject({source:external,ok:true});
  }
  const operations=device.operations.length,before=await status();clock.advance(1000);
  for(let n=0;n<3;n++){const read=await status();expect(read.display).toEqual(before.display);expect(read.player.generation).toBe(before.player.generation);}
  expect(device.operations).toHaveLength(operations);expect(player.getDisplayEvidence().transport?.source).toBe('dashboard');
 }finally{await player.close();}
});
