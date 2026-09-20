import type {FastifyInstance,FastifyReply,FastifyRequest} from 'fastify';
import {evaluate,type FeedEvent,type Ticket} from '@jimmie-potts/device-contracts';
import type {ControllerState} from './controller-state.js';
import {ApiError} from './security.js';
interface Client {request:FastifyRequest;reply:FastifyReply;queue:string[];working:boolean;closed:boolean;ready:boolean;drain?:ReturnType<typeof setTimeout>}
export class ControllerEvents {
 private sequence=0;private history:FeedEvent[]=[];private clients=new Set<Client>();private signature='';private closed=false;
 private timer:ReturnType<typeof setInterval>;private ticks=0;
 constructor(private state:ControllerState,private authenticate:(request:FastifyRequest)=>Promise<void>){
  this.timer=setInterval(()=>{this.ticks++;for(const client of this.clients)this.enqueue(client,this.ticks%15===0?': heartbeat\n\n':'');},1000);this.timer.unref();
 }
 snapshot(){return this.state.snapshot({epoch:this.state.feedEpoch,sequence:this.sequence});}
 publish():void{
  if(this.closed)return;
  const signature=JSON.stringify(this.snapshot(),(key,value)=>['sampledAtMs','evidenceAgeMs','cursor'].includes(key)?undefined:value);
  if(signature===this.signature)return;this.signature=signature;this.sequence++;
  const snapshot=this.snapshot(),event:FeedEvent={apiVersion:'1.0',kind:'change',cursor:snapshot.cursor,snapshot};
  this.history.push(event);if(this.history.length>32)this.history.shift();
  for(const client of this.clients)this.enqueue(client,this.message(event));
 }
 private message(event:FeedEvent){return `id: ${event.cursor.epoch}:${event.cursor.sequence}\nevent: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`;}
 private remove(client:Client){client.closed=true;this.clients.delete(client);client.queue=[];if(client.drain)clearTimeout(client.drain);}
 private terminate(client:Client){this.remove(client);client.reply.raw.destroy();}
 private enqueue(client:Client,body:string){
  if(client.closed||!client.ready)return;
  if(client.queue.length>=32||client.drain){this.terminate(client);return;}
  client.queue.push(body);if(!client.working)void this.flush(client);
 }
 private async flush(client:Client){
  client.working=true;
  try{
   while(client.queue.length&&!client.closed){
    await this.authenticate(client.request);if(client.closed)return;
    const body=client.queue.shift()!;
    if(body&&!client.reply.raw.write(body)){
     client.drain=setTimeout(()=>this.terminate(client),5000);client.drain.unref();
     client.reply.raw.once('drain',()=>{if(client.drain)clearTimeout(client.drain);delete client.drain;});
     if(client.queue.length){this.terminate(client);return;}
    }
   }
  }catch{this.terminate(client);}finally{client.working=false;}
 }
 register(app:FastifyInstance){
  app.get('/controller/v1/events',async(request,reply)=>{
   if(this.closed)throw new ApiError('capacity',429);
   if(this.clients.size>=16)throw new ApiError('capacity',429);
   // Reserve a stream slot before asynchronous catalog reads.
   const client:Client={request,reply,queue:[],working:false,closed:false,ready:false};this.clients.add(client);
   try{
    await this.state.refreshCatalog();await this.authenticate(request);
    if(this.closed)throw new ApiError('capacity',429);
    this.publish();
    // Publication above must not write to a response before its SSE headers.
    client.queue=[];
    reply.hijack();reply.raw.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','x-content-type-options':'nosniff','connection':'keep-alive'});
    client.ready=true;
    reply.raw.on('close',()=>this.remove(client));
    const last=request.headers['last-event-id'];let cursor:Ticket|undefined;
    if(typeof last==='string'){
     const [epoch,sequence,...extra]=last.split(':');
     if(epoch&&sequence!==undefined&&/^(0|[1-9][0-9]*)$/.test(sequence)&&!extra.length)cursor={epoch,sequence:Number(sequence)};
    }
    const result=evaluate({operation:'feed',cursor:cursor??null,snapshot:this.snapshot(),events:this.history}) as {events:FeedEvent[]};
    this.enqueue(client,result.events.length?result.events.map(event=>this.message(event)).join(''):': current\n\n');
   }catch(error){this.remove(client);throw error;}
  });
 }
 close(){this.closed=true;clearInterval(this.timer);for(const client of this.clients){this.remove(client);client.reply.raw.end();}}
}
