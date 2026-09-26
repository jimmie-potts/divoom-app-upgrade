import {expect,it,vi} from 'vitest';
import {Commands as Ledger,type CommandEvent as Event} from '../../apps/server/src/commands.js';

type TestOperations={test:{input:undefined;result:unknown}};
type CommandEvent=Event<TestOperations>;
function execute<T>(ledger:Ledger<TestOperations>,requestId:string,payload:unknown,action:()=>Promise<T>):Promise<unknown>{
 return ledger.execute(requestId,payload,{kind:'test',input:undefined},action);
}

it('reserves synchronously, notifies before execution and completes before callers',async()=>{
 const commands=new Ledger<TestOperations>(),order:string[]=[],events:CommandEvent[]=[];
 const id=commands.nextRequestId,payload=['test'];
 commands.subscribe(event=>{events.push(event);order.push(event.phase);expect(commands.nextRequestId).not.toBe(id);});
 const action=vi.fn(async()=>{order.push('action');return 42;});
 const first=execute(commands,id,payload,action);
 expect(order).toEqual(['pending']);expect(action).not.toHaveBeenCalled();
 expect(execute(commands,id,payload,action)).toBe(first);
 expect(()=>execute(commands,id,['different'],action)).toThrow(expect.objectContaining({code:'request-conflict'}));
 expect(await first.then(value=>{order.push('caller');return value;})).toBe(42);
 expect(order).toEqual(['pending','action','complete','caller']);
 expect(execute(commands,id,payload,action)).toBe(first);expect(action).toHaveBeenCalledTimes(1);
 expect(events).toHaveLength(2);expect(events[1]).toMatchObject({result:42});
});

it.each([false,true])('retains failures and isolates synchronous observers (async=%s)',async asynchronous=>{
 const commands=new Ledger<TestOperations>(),events:CommandEvent[]=[],failure=new Error('failure');
 commands.subscribe(()=>{throw new Error('observer');});
 const unsubscribe=commands.subscribe(event=>events.push(event));
 const action=vi.fn(()=>asynchronous?Promise.reject(failure):(()=>{throw failure;})());
 const id=commands.nextRequestId,result=execute(commands,id,{},action);
 await expect(result).rejects.toBe(failure);
 expect(execute(commands,id,{},action)).toBe(result);
 await expect(result).rejects.toBe(failure);expect(action).toHaveBeenCalledTimes(1);
 expect(events.map(event=>event.phase)).toEqual(['pending','complete']);expect(events[1]).toMatchObject({error:failure});
 unsubscribe();await execute(commands,commands.nextRequestId,{},async()=>undefined);expect(events).toHaveLength(2);
});

it('deduplicates pending receipts and retained effects, with idempotent releases',async()=>{
 const commands=new Ledger<TestOperations>(),resolvers:Array<()=>void>=[],work:Promise<unknown>[]=[];
 const first=commands.nextRequestId;
 for(let i=0;i<32;i++)work.push(execute(commands,commands.nextRequestId,i,()=>new Promise<void>(resolve=>resolvers.push(resolve))));
 const release1=commands.retainPending(first),release2=commands.retainPending(first),next=commands.nextRequestId;
 expect(()=>execute(commands,next,32,async()=>{})).toThrow(expect.objectContaining({code:'busy'}));expect(commands.nextRequestId).toBe(next);
 await Promise.resolve();resolvers[0]!();await work[0];
 expect(()=>execute(commands,next,32,async()=>{})).toThrow(expect.objectContaining({code:'busy'}));
 release1();release1();expect(()=>execute(commands,next,32,async()=>{})).toThrow(expect.objectContaining({code:'busy'}));
 release2();await execute(commands,next,32,async()=>{});
 resolvers.slice(1).forEach(resolve=>resolve());await Promise.all(work);
});

it('retains 256 completed receipts in insertion order without evicting pending work',async()=>{
 const commands=new Ledger<TestOperations>();let finish!:()=>void;
 const pendingId=commands.nextRequestId,pending=execute(commands,pendingId,'pending',()=>new Promise<void>(resolve=>{finish=resolve;}));
 const oldest=commands.nextRequestId;await execute(commands,oldest,0,async()=>0);
 const retained=commands.nextRequestId;await execute(commands,retained,1,async()=>1);
 for(let i=2;i<=256;i++)await execute(commands,commands.nextRequestId,i,async()=>i);
 expect(()=>execute(commands,oldest,0,async()=>0)).toThrow(expect.objectContaining({code:'request-expired'}));
 expect(await execute(commands,retained,1,async()=>99)).toBe(1);
 expect(execute(commands,pendingId,'pending',async()=>{})).toBe(pending);finish();await pending;
 expect(()=>execute(commands,pendingId,'pending',async()=>{})).toThrow(expect.objectContaining({code:'request-expired'}));
 expect(await execute(commands,retained,1,async()=>99)).toBe(1);
});
