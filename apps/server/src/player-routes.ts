import type {FastifyInstance} from 'fastify';
import type {Player} from '@pixoo/playback';
import {Commands} from './commands.js';
import {ControlService} from './control-service.js';
export function playerRoutes(app:FastifyInstance,player:Player,commands:Commands,changed:()=>void=()=>{},service=new ControlService(player,commands,'simulator')){
 const snapshot=service.snapshot;
 app.get('/api/player',snapshot);
 app.post('/api/player/commands',request=>service.playback(request.body).finally(changed));
 return snapshot;
}
