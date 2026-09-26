import type {FastifyInstance,FastifyRequest} from 'fastify';
import {evaluate,type FeedEvent,type Ticket} from '@jimmie-potts/device-contracts';
import type {ControllerState} from './controller-state.js';
import {ApiError} from './security.js';
import {SseDelivery} from './sse-delivery.js';
export class ControllerEvents {
 private sequence=0;private history:FeedEvent[]=[];private signature='';private closed=false;
 private delivery:SseDelivery;
 constructor(private state:ControllerState,private authenticate:(request:FastifyRequest)=>Promise<void>){
  this.delivery=new SseDelivery(authenticate,'on-enqueue');
 }
 snapshot(){return this.state.snapshot({epoch:this.state.feedEpoch,sequence:this.sequence});}
 publish():void{
  if(this.closed)return;
  const signature=JSON.stringify(this.snapshot(),(key,value)=>['sampledAtMs','evidenceAgeMs','cursor'].includes(key)?undefined:value);
  if(signature===this.signature)return;this.signature=signature;this.sequence++;
  const snapshot=this.snapshot(),event:FeedEvent={apiVersion:'1.0',kind:'change',cursor:snapshot.cursor,snapshot};
  this.history.push(event);if(this.history.length>32)this.history.shift();
  this.delivery.broadcast(this.message(event));
 }
 private message(event:FeedEvent){return `id: ${event.cursor.epoch}:${event.cursor.sequence}\nevent: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`;}
 register(app:FastifyInstance){
  app.get('/controller/v1/events',async(request,reply)=>{
   if(this.closed)throw new ApiError('capacity',429);
   if(this.delivery.size>=16)throw new ApiError('capacity',429);
   // Reserve a stream slot before asynchronous catalog reads.
   const client=this.delivery.reserve(request,reply);
   try{
    await this.state.refreshCatalog();await this.authenticate(request);
    if(this.closed)throw new ApiError('capacity',429);
    this.publish();
    // Publication above must not write to a response before its SSE headers.
    reply.hijack();reply.raw.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','x-content-type-options':'nosniff','connection':'keep-alive'});
    this.delivery.activate(client);
    const last=request.headers['last-event-id'];let cursor:Ticket|undefined;
    if(typeof last==='string'){
     const [epoch,sequence,...extra]=last.split(':');
     if(epoch&&sequence!==undefined&&/^(0|[1-9][0-9]*)$/.test(sequence)&&!extra.length)cursor={epoch,sequence:Number(sequence)};
    }
    const result=evaluate({operation:'feed',cursor:cursor??null,snapshot:this.snapshot(),events:this.history}) as {events:FeedEvent[]};
    this.delivery.send(client,result.events.length?result.events.map(event=>this.message(event)).join(''):': current\n\n');
   }catch(error){this.delivery.remove(client);throw error;}
  });
 }
 close(){this.closed=true;this.delivery.close();}
}
