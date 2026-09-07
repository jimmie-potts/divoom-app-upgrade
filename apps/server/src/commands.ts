import {randomUUID} from 'node:crypto';
import {ApiError} from './security.js';
interface Receipt {fingerprint:string;result:Promise<unknown>;done:boolean}
export class Commands {
 readonly epoch=randomUUID();
 private sequence=1;
 private receipts=new Map<string,Receipt>();
 get nextRequestId():string {return `${this.epoch}:${this.sequence}`;}
 execute<T>(requestId:string,payload:unknown,action:()=>Promise<T>):Promise<T> {
  const fingerprint=JSON.stringify(payload),existing=this.receipts.get(requestId);
  if(existing){if(existing.fingerprint!==fingerprint)throw new ApiError('request-conflict',409);return existing.result as Promise<T>;}
  if(!requestId.startsWith(`${this.epoch}:`))throw new ApiError('request-expired',410);
  const sequence=Number(requestId.slice(this.epoch.length+1));
  if(sequence<this.sequence)throw new ApiError('request-expired',410);
  if(requestId!==this.nextRequestId||!Number.isSafeInteger(sequence))throw new ApiError('request-order',409);
  if(this.sequence===Number.MAX_SAFE_INTEGER)throw new ApiError('busy',503);
  this.sequence++;
  const result=Promise.resolve().then(action),receipt={fingerprint,result,done:false};
  this.receipts.set(requestId,receipt);
  const finished=()=>{
   receipt.done=true;
   let completed=[...this.receipts.values()].filter(r=>r.done).length;
   for(const [id,item]of this.receipts){if(completed<=256)break;if(item.done){this.receipts.delete(id);completed--;}}
  };
  void result.then(finished,finished);return result;
 }
}
