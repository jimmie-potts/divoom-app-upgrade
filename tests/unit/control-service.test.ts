import {expect,it,vi} from 'vitest';
import {ControlService} from '../../apps/server/src/control-service.js';
import {Commands} from '../../apps/server/src/commands.js';
import {Player} from '@pixoo/playback';
import {FakeDeviceAdapter} from '../../packages/device/src/index.js';
import {MemoryPlaybackStore} from '../helpers/playback-store.js';

it('retains one immutable display outcome across caller projections',async()=>{
 const device=new FakeDeviceAdapter(),player=await Player.open({device,store:new MemoryPlaybackStore()}),commands=new Commands();
 const service=new ControlService(player,commands,'simulator'),spy=vi.spyOn(device,'setBrightness');
 try{
  const body={requestId:commands.nextRequestId,brightness:42};
  const [first,replay]=await Promise.all([service.display(body),service.display(body)]);
  expect(first).toEqual(replay);expect(spy).toHaveBeenCalledTimes(1);
  expect(first.operation).toMatchObject({ok:true,timing:{completedAtMs:expect.any(Number)}});
  await expect(service.display({...body,brightness:43})).rejects.toMatchObject({code:'request-conflict'});
  expect(service.status()).toMatchObject({mode:'simulator',connected:false,display:{requestedBrightness:42,brightness:{acknowledged:{value:42},observed:null}}});
  await service.display({requestId:commands.nextRequestId,brightness:60});
  expect(await service.display(body)).toEqual(first);
 }finally{await player.close();}
});
it('does not reserve an identity for invalid display input',async()=>{
 const player=await Player.open({device:new FakeDeviceAdapter(),store:new MemoryPlaybackStore()}),commands=new Commands(),service=new ControlService(player,commands,'simulator');
 try{const requestId=commands.nextRequestId;await expect(service.display({requestId,brightness:101})).rejects.toMatchObject({code:'invalid-input'});expect(commands.nextRequestId).toBe(requestId);}
 finally{await player.close();}
});
it('reads dated player evidence without probing or refreshing it',async()=>{
 const device=new FakeDeviceAdapter(),player=await Player.open({device,store:new MemoryPlaybackStore()}),probe=vi.spyOn(device,'probe');
 try{
  expect(player.getDisplayEvidence()).toMatchObject({requestedBrightness:null,brightness:{acknowledged:null,observed:null},transport:null});
  await player.setBrightness(20);const before=player.getDisplayEvidence();
  expect(before).toMatchObject({requestedBrightness:20,brightness:{acknowledged:{value:20},observed:null},transport:{source:'brightness'}});
  expect(player.getDisplayEvidence()).toEqual(before);expect(probe).not.toHaveBeenCalled();
 }finally{await player.close();}
});
it('retains failed outcomes and expires completed history without another execution',async()=>{
 class Failing extends FakeDeviceAdapter{override async setBrightness(...args:Parameters<FakeDeviceAdapter['setBrightness']>){const result=await super.setBrightness(...args);return result.ok?{...result,ok:false as const,code:'timeout' as const,priorEffects:'possible' as const}:result;}}
 const device=new Failing(),player=await Player.open({device,store:new MemoryPlaybackStore(),pauseOnUncertain:true}),commands=new Commands(),service=new ControlService(player,commands,'device'),spy=vi.spyOn(device,'setBrightness');
 try{
  const body={requestId:commands.nextRequestId,brightness:42},first=await service.display(body);
  expect(first.operation).toMatchObject({ok:false,code:'timeout',priorEffects:'possible'});
  expect(await service.display(body)).toEqual(first);expect(spy).toHaveBeenCalledTimes(1);
  for(let n=0;n<256;n++)await service.display({requestId:commands.nextRequestId,brightness:42});
  await expect(service.display(body)).rejects.toMatchObject({code:'request-expired'});expect(spy).toHaveBeenCalledTimes(257);
  const epoch=new Commands();await expect(service.display({requestId:epoch.nextRequestId,brightness:42})).rejects.toMatchObject({code:'request-expired'});
 }finally{await player.close();}
});
