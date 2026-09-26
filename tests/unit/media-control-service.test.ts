import {expect,it,vi} from 'vitest';
import type {Player} from '@pixoo/playback';
import {ControlService} from '../../apps/server/src/control-service.js';
import {Commands} from '../../apps/server/src/commands.js';
it('shares canonical player receipts and protects the retained snapshot',async()=>{
 const commands=new Commands(),pause=vi.fn(async()=>{});
 const player={pause,getState:()=>({state:'paused'}),getSession:()=>null} as unknown as Player;
 const service=new ControlService(player,commands,'simulator');
 const body={requestId:commands.nextRequestId,command:'pause'};
 const result=await service.playback(body);
 result.player.state='error';
 expect((await service.playback(body)).player.state).toBe('paused');expect(pause).toHaveBeenCalledTimes(1);
 await expect(service.playback({...body,command:'stop'})).rejects.toMatchObject({code:'request-conflict'});
});
it('validates added player commands before reserving identity',async()=>{
 const commands=new Commands(),service=new ControlService({} as Player,commands,'simulator'),requestId=commands.nextRequestId;
 await expect(service.playback({requestId,command:'show-media',renditionId:'bad'})).rejects.toMatchObject({code:'invalid-input'});
 expect(commands.nextRequestId).toBe(requestId);
});
it('reserves revision failures once and keeps selection identity distinct',async()=>{
 const commands=new Commands();
 const failure=Object.assign(new Error('revision-conflict'),{code:'revision-conflict'});
 const start=vi.fn(async()=>{throw failure;});
 const service=new ControlService({start} as unknown as Player,commands,'simulator');
 const body={requestId:commands.nextRequestId,command:'start',playlistId:'550e8400-e29b-41d4-a716-446655440000',revision:2};
 await expect(service.playback(body)).rejects.toBe(failure);
 await expect(service.playback(body)).rejects.toBe(failure);expect(start).toHaveBeenCalledTimes(1);expect(start).toHaveBeenCalledWith(body.playlistId,2);
 await expect(service.playback({...body,revision:3})).rejects.toMatchObject({code:'request-conflict'});
});
it('keeps legacy payload ordering and rejects extra policy fields before admission',async()=>{
 const commands=new Commands(),pause=vi.fn(async()=>{}),player={pause,getState:()=>({state:'paused'}),getSession:()=>null} as unknown as Player;
 const service=new ControlService(player,commands,'simulator'),requestId=commands.nextRequestId;
 await expect(service.playback({requestId,command:'show-media',renditionId:'a'.repeat(64),playback:{mode:'duration',durationMs:50,extra:true}})).rejects.toMatchObject({code:'invalid-input'});
 expect(commands.nextRequestId).toBe(requestId);
 const original={requestId,command:'pause'};
 const retained=await commands.execute(requestId,['player',original],{kind:'player',input:{requestId,command:'pause'}},async()=>service.snapshot());
 expect(await service.playback({command:'pause',requestId})).toEqual(retained);expect(pause).not.toHaveBeenCalled();
});
