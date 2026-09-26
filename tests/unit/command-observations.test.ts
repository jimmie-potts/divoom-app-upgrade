import {expect,it} from 'vitest';
import {Commands,type CommandEvent} from '../../apps/server/src/commands.js';
import {ControlService} from '../../apps/server/src/control-service.js';
import {ControllerState} from '../../apps/server/src/controller-state.js';
import {Player} from '@pixoo/playback';
import {FakeDeviceAdapter} from '../../packages/device/src/index.js';
import {MemoryPlaybackStore} from '../helpers/playback-store.js';

it('publishes typed metadata independently of replay serialization',async()=>{
 const player=await Player.open({device:new FakeDeviceAdapter(),store:new MemoryPlaybackStore()}),commands=new Commands(),service=new ControlService(player,commands,'simulator');
 const events:CommandEvent[]=[];commands.subscribe(event=>events.push(event));
 try{
  const requestId=commands.nextRequestId,input={requestId,brightness:25};
  const result=await commands.execute(requestId,['opaque',1],{kind:'display',input},()=>service.applyDisplay(input));
  expect(events).toEqual([{requestId,kind:'display',input,phase:'pending'},{requestId,kind:'display',input,phase:'complete',outcome:'success',result}]);
  expect(await commands.execute(requestId,['opaque',1],{kind:'display',input:{requestId,brightness:99}},async()=>{throw new Error('must not execute');})).toBe(result);
  expect(events).toHaveLength(2);
  const complete=events[1]!;
  if(complete.kind==='display'&&complete.phase==='complete'&&complete.outcome==='success')expect(complete.result.operation?.ok).toBe(true);
  else throw new Error('missing display completion');
 }finally{await player.close();}
});

it('observes supported local/native operations without projecting local-only commands',async()=>{
 const player=await Player.open({device:new FakeDeviceAdapter(),store:new MemoryPlaybackStore()}),commands=new Commands(),service=new ControlService(player,commands,'simulator');
 const state=new ControllerState(service,{controllerId:'pixoo',deviceId:'display',sourceId:'test',controllerEpoch:commands.epoch});
 const pending:string[]=[];state.onChange=()=>{pending.push(...state.snapshot().state.pending.map(item=>item.command.kind));};
 try{
  await service.display({requestId:commands.nextRequestId,brightness:25});
  expect(pending).toContain('brightness.set');expect(state.snapshot().state.lastOutcome).toMatchObject({status:'known',receipt:{outcome:'sent',completedOperations:['display']}});
  pending.length=0;
  const before=state.snapshot().state.lastOutcome;
  for(const command of ['show-media','restart-with-changes'] as const){
   const requestId=commands.nextRequestId;
   await commands.execute(requestId,['local',command],{kind:'player',input:command==='show-media'?{requestId,command,renditionId:'a'.repeat(64)}:{requestId,command}},async()=>service.snapshot());
  }
  await commands.execute(commands.nextRequestId,['integration'],{kind:'integration',input:undefined},async()=>{throw new Error('unavailable');}).catch(()=>{});
  expect(pending).toEqual([]);expect(state.snapshot().state.lastOutcome).toEqual(before);
  const snap=state.snapshot(),receipt=await state.execute({apiVersion:'1.0',controllerId:'pixoo',deviceId:'display',requestId:snap.nextRequestId,expectedConfigurationRevision:snap.configurationRevision,expectedGeneration:snap.generation,command:{kind:'media.control',action:'pause'}});
  expect(pending).toContain('media.control');expect(state.snapshot().state.lastOutcome).toEqual({status:'known',receipt});
 }finally{state.close();await player.close();}
});

it('requires correlated metadata and results even when an operation key is a union',()=>{
 const commands=new Commands<{one:{input:number;result:number};two:{input:string;result:string}}>();
 // This function is typechecked but never executes invalid commands.
 const typecheck=(kind:'one'|'two')=>{
  // @ts-expect-error A union key cannot pair an arbitrary input and result.
  commands.execute('id',{}, {kind,input:123},async()=>'wrong');
  // @ts-expect-error Explicit union instantiation must preserve each tuple's correlation.
  commands.execute<'one'|'two'>('id',{}, {kind:'one',input:123},async()=>'wrong');
  // @ts-expect-error Literal operation results remain constrained.
  commands.execute('id',{}, {kind:'one',input:123},async()=>'wrong');
  const numberResult:Promise<number>=commands.execute('id',{}, {kind:'one',input:123},async()=>123);
  return numberResult;
 };
 expect(typecheck).toBeTypeOf('function');
});
