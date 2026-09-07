import type {Player} from '@pixoo/playback';
import type {OperationResult} from '@pixoo/device';
import {displayCommand} from '@pixoo/core';
import {Commands} from './commands.js';
import {parse} from './validation.js';
import {ApiError} from './security.js';
export class ControlService {
 constructor(readonly player:Player,readonly commands:Commands,readonly mode:'simulator'|'device'){}
 snapshot=()=>({sampledAtMs:performance.now(),serverId:this.commands.epoch,nextRequestId:this.commands.nextRequestId,player:this.player.getState(),session:this.player.getSession()});
 status(){
  const state=this.player.getState();
  return {ready:true,mode:this.mode,connected:this.mode==='simulator'?false:state.availability==='unknown'?null:state.availability==='available',
   serverId:this.commands.epoch,nextRequestId:this.commands.nextRequestId,sampledAtMs:performance.now(),display:this.player.getDisplayEvidence(),player:state};
 }
 async display(input:unknown){
  const body=parse(displayCommand,input);
  const retained=await this.commands.execute(body.requestId,['display',body],async()=>{
   const operation=body.screenOn!==undefined?await this.player.setScreen(body.screenOn):await this.player.setBrightness(body.brightness!);
   return {requestId:body.requestId,operation:operation??null,snapshot:this.snapshot()};
  });
  return structuredClone(retained);
 }
}
export function requireDisplaySuccess(value:OperationResult<void>|null):void{
 if(!value)throw new ApiError('cancelled',409);
 if(!value.ok)throw new ApiError(value.code,value.code==='invalid-input'?400:503,{priorEffects:value.priorEffects});
}
