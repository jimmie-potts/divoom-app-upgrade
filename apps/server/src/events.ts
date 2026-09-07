import {randomUUID} from 'node:crypto';
import type {FastifyInstance,FastifyReply} from 'fastify';
import {ApiError} from './security.js';
interface Event {sequence:number;body:string}
interface Client {reply:FastifyReply;blocked:boolean;timer?:ReturnType<typeof setTimeout>}
export class Events {
 private epoch=randomUUID();private sequence=0;
 private history:Event[]=[];private clients=new Set<Client>();private last:string;
 private heartbeat:ReturnType<typeof setInterval>;
 constructor(private snapshot:()=>unknown){
  this.last=JSON.stringify(snapshot());
  this.heartbeat=setInterval(()=>{for(const client of this.clients)this.write(client,': heartbeat\n\n');},15000);this.heartbeat.unref();
 }
 private message(event:string,data:string,sequence=this.sequence):string{return `id: ${this.epoch}:${sequence}\nevent: ${event}\ndata: ${data}\n\n`;}
 private remove(client:Client):void {this.clients.delete(client);if(client.timer)clearTimeout(client.timer);}
 private write(client:Client,body:string):void {
  if(client.blocked){client.reply.raw.destroy();this.remove(client);return;}
  if(!client.reply.raw.write(body)){
   client.blocked=true;client.timer=setTimeout(()=>{client.reply.raw.destroy();this.remove(client);},5000);client.timer.unref();
   client.reply.raw.once('drain',()=>{client.blocked=false;if(client.timer)clearTimeout(client.timer);});
  }
 }
 publish():void {
  const state=JSON.stringify(this.snapshot());if(state===this.last)return;this.last=state;this.sequence++;
  const event={sequence:this.sequence,body:this.message('state',state)};this.history.push(event);if(this.history.length>32)this.history.shift();
  for(const client of this.clients)this.write(client,event.body);
 }
 register(app:FastifyInstance):void {
  app.get('/api/events',(request,reply)=>{
   if(this.clients.size>=16)throw new ApiError('busy',503);
   this.publish();
   const client:Client={reply,blocked:false};this.clients.add(client);reply.hijack();
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
