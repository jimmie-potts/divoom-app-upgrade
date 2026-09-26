import {randomUUID} from 'node:crypto';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import {ApiError} from './security.js';
import {SseDelivery,type DeliveryClient} from './sse-delivery.js';
interface Event {sequence:number;body:string}
const clientPools=new WeakMap<object,Set<DeliveryClient>>();
export class Events {
 private epoch=randomUUID();private sequence=0;
 private history:Event[]=[];private last:string;
 private delivery:SseDelivery;
 constructor(private snapshot:()=>unknown,authenticate?:((request:FastifyRequest)=>Promise<void>)){
  this.last=this.signature(snapshot());
  this.delivery=new SseDelivery(authenticate,'after-authorization');
 }
 private signature(value:unknown):string {return JSON.stringify(value,(key,value)=>key==='sampledAtMs'?undefined:value);}
 private message(event:string,data:string,sequence=this.sequence):string{return `id: ${this.epoch}:${sequence}\nevent: ${event}\ndata: ${data}\n\n`;}
 publish():void {
  const snapshot=this.snapshot(),signature=this.signature(snapshot);if(signature===this.last)return;this.last=signature;this.sequence++;
  const state=JSON.stringify(snapshot);
  const event={sequence:this.sequence,body:this.message('state',state)};this.history.push(event);if(this.history.length>32)this.history.shift();
  this.delivery.broadcast(event.body);
 }
 register(app:FastifyInstance,path='/api/events'):void {
  let pool=clientPools.get(app.server);if(!pool){pool=new Set();clientPools.set(app.server,pool);}
  const shared=pool;
  app.get(path,(request,reply)=>{
   if(shared.size>=16)throw new ApiError('busy',503);
   this.publish();
   const client=this.delivery.reserve(request,reply,()=>shared.delete(client));shared.add(client);reply.hijack();
   reply.raw.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','x-content-type-options':'nosniff','connection':'keep-alive'});
   this.delivery.activate(client);
   const last=request.headers['last-event-id'];
   const prefix=`${this.epoch}:`,number=typeof last==='string'&&last.startsWith(prefix)?Number(last.slice(prefix.length)):NaN;
   const first=this.history[0]?.sequence??this.sequence+1;
   if(typeof last==='string'&&last===`${prefix}${number}`&&Number.isSafeInteger(number)&&number>=Math.max(0,first-1)&&number<=this.sequence){
    const replay=this.history.filter(event=>event.sequence>number).map(event=>event.body).join('');
    this.delivery.send(client,replay||': current\n\n');
   }else this.delivery.send(client,this.message('resync',JSON.stringify(this.snapshot())));
  });
 }
 close():void {this.delivery.close();}
}
