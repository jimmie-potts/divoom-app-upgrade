import {expect,it} from 'vitest';
import {parseRuntimeRequest,runtimeReserve,runtimeRequestJson} from '../../apps/server/src/runtime-adapter.js';
it('binds the supervisor request to the named owner and exact merged revision',()=>{
 const value={schemaVersion:1,operation:'install',repository:'jimmie-potts/divoom-app-upgrade',issue:115,merge:'a'.repeat(40),owner:'fixture',deadline:Date.now()/1000+900,evidenceDirectory:'/private/run'};
 expect(parseRuntimeRequest(value,'fixture').merge).toBe(value.merge);
 expect(()=>parseRuntimeRequest({...value,owner:'other'},'fixture')).toThrow();
 expect(()=>parseRuntimeRequest({...value,merge:'main'},'fixture')).toThrow();
 expect(()=>parseRuntimeRequest({...value,command:'arbitrary'},'fixture')).toThrow();
 expect(()=>runtimeReserve(Date.now()/1000+5,600)).toThrow('insufficient-installation-deadline-reserve');
 expect(()=>runtimeRequestJson('{"owner":"first","owner":"second"}')).toThrow('duplicate-request-key');
});
