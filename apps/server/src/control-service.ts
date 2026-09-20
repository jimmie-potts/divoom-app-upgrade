import {AsyncLocalStorage} from 'node:async_hooks';
import type {Player} from '@pixoo/playback';
import type {OperationResult} from '@pixoo/device';
import type {Library} from '@pixoo/library';
import type {MediaProfile} from '@pixoo/media';
import {displayCommand,playerCommand,catalogQuery,type PlayerCommand} from '@pixoo/core';
import {Commands} from './commands.js';
import {parse} from './validation.js';
import {ApiError} from './security.js';
export class ControlService {
 // Async context follows queued player work, retries and automatic traversal.
 // Each upload captures its initiating command even after another client takes over.
 private playbackContext=new AsyncLocalStorage<PlayerCommand>();
 get playbackRequest(){return this.playbackContext.getStore();}
 constructor(readonly player:Player,readonly commands:Commands,readonly mode:'simulator'|'device',readonly library?:Library,readonly profile?:Readonly<MediaProfile>,readonly stillDelayMs=100){}
 snapshot=()=>({sampledAtMs:performance.now(),serverId:this.commands.epoch,nextRequestId:this.commands.nextRequestId,player:this.player.getState(),session:this.player.getSession()});
 status(){
  const state=this.player.getState();
  return {ready:true,mode:this.mode,connected:this.mode==='simulator'?false:state.availability==='unknown'?null:state.availability==='available',
   serverId:this.commands.epoch,nextRequestId:this.commands.nextRequestId,sampledAtMs:performance.now(),display:this.player.getDisplayEvidence(),player:state};
 }
 async playback(input:unknown){
  const body=parse(playerCommand,input);
  const retained=await this.commands.execute(body.requestId,['player',body],async()=>{
   this.commands.changed();return this.applyPlayback(body);
  });
  return structuredClone(retained);
 }
 async applyPlayback(body:PlayerCommand){
  return this.playbackContext.run(body,async()=>{
  if(body.command==='start')await this.player.start(body.playlistId,body.revision);
  else if(body.command==='show-media')await this.player.showMedia(body.renditionId,body.playback);
  else if(body.command==='restart-with-changes')await this.player.restartWithChanges();
  else await this.player[body.command]();
  return this.snapshot();
  });
 }
 async catalog(kind:'media'|'playlists',input:unknown){
  const query=parse(catalogQuery,input);
  if(!this.library)throw new ApiError('closed',503);
  return kind==='media'?this.library.queryMedia(query,this.profile,this.stillDelayMs):this.library.queryPlaylists(query);
 }
 async display(input:unknown){
  const body=parse(displayCommand,input);
  const retained=await this.commands.execute(body.requestId,['display',body],async()=>{
   this.commands.changed();return this.applyDisplay(body);
  });
  return structuredClone(retained);
 }
 async applyDisplay(body:{requestId:string;screenOn?:boolean|undefined;brightness?:number|undefined}){
  const operation=body.screenOn!==undefined?await this.player.setScreen(body.screenOn):await this.player.setBrightness(body.brightness!);
  return {requestId:body.requestId,operation:operation??null,snapshot:this.snapshot()};
 }
}
export function requireDisplaySuccess(value:OperationResult<void>|null):void{
 if(!value)throw new ApiError('cancelled',409);
 if(!value.ok)throw new ApiError(value.code,value.code==='invalid-input'?400:503,{priorEffects:value.priorEffects});
}
