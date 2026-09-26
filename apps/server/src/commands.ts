import {randomUUID} from 'node:crypto';
import {ApiError} from './security.js';
import type {ApplicationOperations,CommandEvent,OperationMap} from './command-observations.js';
export type {CommandEvent} from './command-observations.js';
interface Receipt {fingerprint:string;result:Promise<unknown>;done:boolean}
export class Commands<Operations extends OperationMap=ApplicationOperations> {
 readonly epoch=randomUUID();
 private sequence=1;
 private receipts=new Map<string,Receipt>();
 private listeners=new Set<(event:CommandEvent<Operations>)=>void>();
 private revision=0;
 private effects=new Map<string,number>();
 retainPending(requestId:string):()=>void{
  this.effects.set(requestId,(this.effects.get(requestId)??0)+1);let released=false;
  return ()=>{if(released)return;released=true;const remaining=this.effects.get(requestId)!-1;if(remaining)this.effects.set(requestId,remaining);else this.effects.delete(requestId);};
 }
 get configurationRevision():number{return this.revision;}
 changed():void{if(this.revision===Number.MAX_SAFE_INTEGER)throw new ApiError('busy',503);this.revision++;}
 subscribe(listener:(event:CommandEvent<Operations>)=>void):()=>void{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};}
 private notify(event:CommandEvent<Operations>):void{for(const listener of this.listeners){try{listener(event);}catch{/* Observers cannot alter command execution. */}}}
 get nextRequestId():string {return `${this.epoch}:${this.sequence}`;}
 execute<Kind extends keyof Operations>(requestId:string,payload:unknown,...[operation,action]:{[Key in Kind]:[operation:{kind:Key;input:Operations[Key]['input']},action:()=>Promise<Operations[Key]['result']>]}[Kind]):Promise<Operations[Kind]['result']> {
  const fingerprint=JSON.stringify(payload),existing=this.receipts.get(requestId);
  if(existing){if(existing.fingerprint!==fingerprint)throw new ApiError('request-conflict',409);return existing.result as Promise<Operations[Kind]['result']>;}
  if(!requestId.startsWith(`${this.epoch}:`))throw new ApiError('request-expired',410);
  const sequence=Number(requestId.slice(this.epoch.length+1));
  if(sequence<this.sequence)throw new ApiError('request-expired',410);
  if(requestId!==this.nextRequestId||!Number.isSafeInteger(sequence))throw new ApiError('request-order',409);
  if(this.sequence===Number.MAX_SAFE_INTEGER)throw new ApiError('busy',503);
  if(new Set([...this.effects.keys(),...[...this.receipts].filter(([,receipt])=>!receipt.done).map(([id])=>id)]).size>=32)throw new ApiError('busy',503);
  this.sequence++;
  const result=Promise.resolve().then(action),receipt={fingerprint,result,done:false};
  this.receipts.set(requestId,receipt);
  // The typed arguments correlate this key, input and result. TypeScript cannot
  // distribute an unresolved generic key across the mapped event union.
  const notify=(event:{phase:'pending'}|{phase:'complete';outcome:'success';result:Operations[Kind]['result']}|{phase:'complete';outcome:'failure';error:unknown})=>this.notify({requestId,...operation,...event} as CommandEvent<Operations>);
  notify({phase:'pending'});
  const finished=()=>{
   receipt.done=true;
   let completed=[...this.receipts.values()].filter(r=>r.done).length;
   for(const [id,item]of this.receipts){if(completed<=256)break;if(item.done){this.receipts.delete(id);completed--;}}
  };
  void result.then(value=>{finished();notify({phase:'complete',outcome:'success',result:value});},error=>{finished();notify({phase:'complete',outcome:'failure',error});});return result;
 }
}
