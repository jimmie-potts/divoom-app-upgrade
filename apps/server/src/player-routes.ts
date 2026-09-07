import type {FastifyInstance} from 'fastify';
import type {Player} from '@pixoo/playback';
import {playerCommand} from '@pixoo/core';
import {Commands} from './commands.js';
import {parse} from './validation.js';
export function playerRoutes(app:FastifyInstance,player:Player,commands:Commands,changed:()=>void=()=>{}){
 const snapshot=()=>({serverId:commands.epoch,nextRequestId:commands.nextRequestId,player:player.getState(),session:player.getSession()});
 app.get('/api/player',snapshot);
 app.post('/api/player/commands',request=>{
  const body=parse(playerCommand,request.body);
  return commands.execute(body.requestId,['player',body],async()=>{
   if(body.command==='start')await player.start(body.playlistId);
   else if(body.command==='restart-with-changes')await player.restartWithChanges();
   else await player[body.command]();
   return snapshot();
  }).finally(changed);
 });
 return snapshot;
}
