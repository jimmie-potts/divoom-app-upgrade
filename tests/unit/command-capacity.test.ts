import {expect,it} from 'vitest';
import {Commands} from '../../apps/server/src/commands.js';
import {ControlService} from '../../apps/server/src/control-service.js';
import {ControllerState} from '../../apps/server/src/controller-state.js';
import {Player} from '@pixoo/playback';
import {FakeDeviceAdapter} from '../../packages/device/src/index.js';
import {MemoryPlaybackStore} from '../helpers/playback-store.js';
import {ManualClock} from '../helpers/manual-clock.js';

it.each([false,true])('preserves active-playback slot ownership with native controller enabled=%s',async enabled=>{
 const clock=new ManualClock(),store=new MemoryPlaybackStore(),player=await Player.open({device:new FakeDeviceAdapter({clock,latencyMs:1000}),store,clock});
 const commands=new Commands(),service=new ControlService(player,commands,'simulator');
 const state=enabled?new ControllerState(service,{controllerId:'pixoo',deviceId:'display',sourceId:'test',controllerEpoch:commands.epoch}):undefined;
 const pending:Promise<unknown>[]=[],flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
 try{
  await service.playback({requestId:commands.nextRequestId,command:'start',playlistId:store.playlist.id});await flush();
  for(let i=0;i<2;i++){clock.advance(1000);await flush();}clock.advance(0);await flush();
  expect(player.getState().state).toBe('playing');
  for(let i=0;i<(enabled?31:32);i++){pending.push(service.display({requestId:commands.nextRequestId,brightness:i}));await flush();}
  const next=commands.nextRequestId;
  await expect(service.display({requestId:next,brightness:50})).rejects.toMatchObject({code:'busy'});
  expect(commands.nextRequestId).toBe(next);
 }finally{await player.close();await Promise.all(pending);state?.close();}
});
