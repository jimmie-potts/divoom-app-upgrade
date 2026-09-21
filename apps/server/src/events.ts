import {randomUUID} from 'node:crypto';
import type {FastifyInstance,FastifyReply,FastifyRequest} from 'fastify';
import {ApiError} from './security.js';
interface Event {sequence:number;body:string}
const clientPools=new WeakMap<object,Set<Client>>();
interface Client {request:FastifyRequest;queue:string[];working:boolean;closed:boolean;pool?:Set<Client>;reply:FastifyReply;blocked:boolean;timer?:ReturnType<typeof setTimeout>}
export class Events {
 private epoch=randomUUID();private sequence=0;
 private history:Event[]=[];private clients=new Set<Client>();private last:string;
 private heartbeat:ReturnType<typeof setInterval>;
 constructor(private snapshot:()=>unknown,private authenticate?:((request:FastifyRequest)=>Promise<void>)){
  this.last=this.signature(snapshot());
  let ticks=0;this.heartbeat=setInterval(()=>{ticks++;for(const client of this.clients)this.write(client,!this.authenticate||ticks%15===0?': heartbeat\n\n':'');},this.authenticate?1000:15000);this.heartbeat.unref();
 }
 private signature(value:unknown):string {return JSON.stringify(value,(key,value)=>key==='sampledAtMs'?undefined:value);}
 private message(event:string,data:string,sequence=this.sequence):string{return `id: ${this.epoch}:${sequence}\nevent: ${event}\ndata: ${data}\n\n`;}
 private remove(client:Client):void {client.closed=true;client.queue=[];this.clients.delete(client);client.pool?.delete(client);if(client.timer)clearTimeout(client.timer);}
 private write(client:Client,body:string):void {
  if(client.closed)return;
  if(!this.authenticate){this.rawWrite(client,body);return;}
  if(client.queue.length>=32){client.reply.raw.destroy();this.remove(client);return;}
  client.queue.push(body);if(!client.working)void this.flush(client);
 }
 private async flush(client:Client){
  client.working=true;
  try{while(client.queue.length&&!client.closed){await this.authenticate!(client.request);if(client.closed)return;const body=client.queue.shift()!;if(body)this.rawWrite(client,body);}}
  catch{client.reply.raw.destroy();this.remove(client);}finally{client.working=false;}
 }
 private rawWrite(client:Client,body:string):void {
  if(client.blocked){client.reply.raw.destroy();this.remove(client);return;}
  if(!client.reply.raw.write(body)){
   client.blocked=true;client.timer=setTimeout(()=>{client.reply.raw.destroy();this.remove(client);},5000);client.timer.unref();
   client.reply.raw.once('drain',()=>{client.blocked=false;if(client.timer)clearTimeout(client.timer);});
  }
 }
 publish():void {
  const snapshot=this.snapshot(),signature=this.signature(snapshot);if(signature===this.last)return;this.last=signature;this.sequence++;
  const state=JSON.stringify(snapshot);
  const event={sequence:this.sequence,body:this.message('state',state)};this.history.push(event);if(this.history.length>32)this.history.shift();
  for(const client of this.clients)this.write(client,event.body);
 }
 register(app:FastifyInstance,path='/api/events'):void {
  let pool=clientPools.get(app.server);if(!pool){pool=new Set();clientPools.set(app.server,pool);}
  const shared=pool;
  app.get(path,(request,reply)=>{
   if(shared.size>=16)throw new ApiError('busy',503);
   this.publish();
   const client:Client={request,queue:[],working:false,closed:false,reply,blocked:false,pool:shared};this.clients.add(client);shared.add(client);reply.hijack();
   reply.raw.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','x-content-type-options':'nosniff','connection':'keep-alive'});
   reply.raw.on('close',()=>this.remove(client));
   const last=request.headers['last-event-id'];
   const prefix=`${this.epoch}:`,number=typeof last==='string'&&last.startsWith(prefix)?Number(last.slice(prefix.length)):NaN;
   const first=this.history[0]?.sequence??this.sequence+1;
   if(typeof last==='string'&&last===`${prefix}${number}`&&Number.isSafeInteger(number)&&number>=Math.max(0,first-1)&&number<=this.sequence){
    const replay=this.history.filter(event=>event.sequence>number).map(event=>event.body).join('');
    this.write(client,replay||': current\n\n');
   }else this.write(client,this.message('resync',JSON.stringify(this.snapshot())));
  });
 }
 close():void {clearInterval(this.heartbeat);for(const client of this.clients){client.reply.raw.end();this.remove(client);}}
}
