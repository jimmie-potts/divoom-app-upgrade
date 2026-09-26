import type {FastifyReply,FastifyRequest} from 'fastify';

export interface DeliveryClient {
 request:FastifyRequest;reply:FastifyReply;queue:string[];working:boolean;closed:boolean;ready:boolean;
 onRemove:()=>void;drain?:ReturnType<typeof setTimeout>;onDrain?:()=>void;
}
// These policies preserve the existing feeds' different authorization ordering.
type BlockedPolicy='after-authorization'|'on-enqueue';
export class SseDelivery {
 private clients=new Set<DeliveryClient>();
 private timer:ReturnType<typeof setInterval>;
 constructor(private authenticate:((request:FastifyRequest)=>Promise<void>)|undefined,private blockedPolicy:BlockedPolicy){
  let ticks=0;
  this.timer=setInterval(()=>{ticks++;this.broadcast(!this.authenticate||ticks%15===0?': heartbeat\n\n':'');},this.authenticate?1000:15000);
  this.timer.unref();
 }
 get size(){return this.clients.size;}
 reserve(request:FastifyRequest,reply:FastifyReply,onRemove=()=>{}):DeliveryClient {
  const client:DeliveryClient={request,reply,queue:[],working:false,closed:false,ready:false,onRemove};
  this.clients.add(client);return client;
 }
 // Feed owners write their headers before enabling publication and timers.
 activate(client:DeliveryClient):void{client.ready=true;client.reply.raw.on('close',()=>this.remove(client));}
 remove(client:DeliveryClient):void {
  client.closed=true;client.queue=[];this.clients.delete(client);client.onRemove();
  if(client.drain)clearTimeout(client.drain);
  if(client.onDrain)client.reply.raw.off('drain',client.onDrain);
  delete client.drain;delete client.onDrain;
 }
 private finish(client:DeliveryClient,method:'destroy'|'end'):void {
  if(this.blockedPolicy==='on-enqueue')this.remove(client);
  client.reply.raw[method]();
  if(this.blockedPolicy==='after-authorization')this.remove(client);
 }
 send(client:DeliveryClient,body:string):void {
  if(client.closed||!client.ready)return;
  if(!this.authenticate){this.rawWrite(client,body);return;}
  if(client.queue.length>=32||(this.blockedPolicy==='on-enqueue'&&client.drain)){this.finish(client,'destroy');return;}
  client.queue.push(body);if(!client.working)void this.flush(client);
 }
 broadcast(body:string):void{for(const client of this.clients)this.send(client,body);}
 private async flush(client:DeliveryClient):Promise<void>{
  client.working=true;
  try{
   while(client.queue.length&&!client.closed){
    await this.authenticate!(client.request);if(client.closed)return;
    const body=client.queue.shift()!;if(body)this.rawWrite(client,body);
   }
  }catch{this.finish(client,'destroy');}finally{client.working=false;}
 }
 private rawWrite(client:DeliveryClient,body:string):void {
  if(client.drain){this.finish(client,'destroy');return;}
  if(!client.reply.raw.write(body)){
   client.drain=setTimeout(()=>this.finish(client,'destroy'),5000);client.drain.unref();
   client.onDrain=()=>{if(client.drain)clearTimeout(client.drain);delete client.drain;delete client.onDrain;};
   client.reply.raw.once('drain',client.onDrain);
   if(this.blockedPolicy==='on-enqueue'&&client.queue.length)this.finish(client,'destroy');
  }
 }
 close():void{clearInterval(this.timer);for(const client of this.clients)this.finish(client,'end');}
}
