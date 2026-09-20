import {randomUUID} from 'node:crypto';
import {ApiError} from './security.js';
interface Receipt {fingerprint:string;result:Promise<unknown>;done:boolean}
export interface CommandEvent {requestId:string;payload:unknown;phase:'pending'|'complete';result?:unknown;error?:unknown}
export class Commands {
 readonly epoch=randomUUID();
 private sequence=1;
 private receipts=new Map<string,Receipt>();
 private listeners=new Set<(event:CommandEvent)=>void>();
 private revision=0;
 private effects=new Map<string,number>();
 retainPending(requestId:string):()=>void{
  this.effects.set(requestId,(this.effects.get(requestId)??0)+1);let released=false;
  return ()=>{if(released)return;released=true;const remaining=this.effects.get(requestId)!-1;if(remaining)this.effects.set(requestId,remaining);else this.effects.delete(requestId);};
 }
 get configurationRevision():number{return this.revision;}
 changed():void{if(this.revision===Number.MAX_SAFE_INTEGER)throw new ApiError('busy',503);this.revision++;}
 subscribe(listener:(event:CommandEvent)=>void):()=>void{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};}
 private notify(event:CommandEvent):void{for(const listener of this.listeners){try{listener(event);}catch{/* Observers cannot alter command execution. */}}}
 get nextRequestId():string {return `${this.epoch}:${this.sequence}`;}
 execute<T>(requestId:string,payload:unknown,action:()=>Promise<T>):Promise<T> {
  const fingerprint=JSON.stringify(payload),existing=this.receipts.get(requestId);
  if(existing){if(existing.fingerprint!==fingerprint)throw new ApiError('request-conflict',409);return existing.result as Promise<T>;}
  if(!requestId.startsWith(`${this.epoch}:`))throw new ApiError('request-expired',410);
  const sequence=Number(requestId.slice(this.epoch.length+1));
  if(sequence<this.sequence)throw new ApiError('request-expired',410);
  if(requestId!==this.nextRequestId||!Number.isSafeInteger(sequence))throw new ApiError('request-order',409);
  if(this.sequence===Number.MAX_SAFE_INTEGER)throw new ApiError('busy',503);
  if(new Set([...this.effects.keys(),...[...this.receipts].filter(([,receipt])=>!receipt.done).map(([id])=>id)]).size>=32)throw new ApiError('busy',503);
  this.sequence++;
  const result=Promise.resolve().then(action),receipt={fingerprint,result,done:false};
  this.receipts.set(requestId,receipt);
  this.notify({requestId,payload,phase:'pending'});
  const finished=()=>{
   receipt.done=true;
   let completed=[...this.receipts.values()].filter(r=>r.done).length;
   for(const [id,item]of this.receipts){if(completed<=256)break;if(item.done){this.receipts.delete(id);completed--;}}
  };
  void result.then(value=>{finished();this.notify({requestId,payload,phase:'complete',result:value});},error=>{finished();this.notify({requestId,payload,phase:'complete',error});});return result;
 }
}
