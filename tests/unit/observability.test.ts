import {describe,it,expect} from 'vitest';
import {createDiagnostics,diagnosticOutcome} from '../../apps/server/src/diagnostics.js';
describe('host diagnostics',()=>{
 it('is inert unless explicitly enabled',async()=>{
  const host=await createDiagnostics({});
  expect(host.runtime.counts()).toEqual({enabled:false});
  await host.runtime.shutdown();
 });
 it('preserves uncertainty before HTTP status classification',()=>{
  expect(diagnosticOutcome({failure:{code:'uncertain-result'}},503)).toBe('uncertain');
  expect(diagnosticOutcome({operation:{ok:false,priorEffects:'possible'}},500)).toBe('uncertain');
  expect(diagnosticOutcome({ok:false,priorEffects:'none'},400)).toBe('rejected');
  expect(diagnosticOutcome({},200)).toBe('succeeded');
 });
});

it('emits canonical process events and preserves thrown error identity',async()=>{
 const records:Array<{event_name:string;attributes:Record<string,unknown>}>=[];
 const host=await createDiagnostics({PIXOO_OBSERVABILITY_ENABLED:'1'},line=>{records.push(JSON.parse(line));});
 const {diagnose}=await import('../../apps/server/src/diagnostics.js');
 const error={code:'uncertain-result'};let calls=0;
 await expect(diagnose(host.runtime,{scope:'bunny.controller',operation:'brightness'},()=>{calls++;throw error;})).rejects.toBe(error);
 await host.runtime.shutdown();expect(calls).toBe(1);
 expect(records).toHaveLength(1);expect(records[0]?.attributes['bunny.outcome']).toBe('uncertain');
});

it('retains actual HTTP error details and native receipt outcomes',async()=>{
 const {ApiError}=await import('../../apps/server/src/security.js');
 expect(diagnosticOutcome(new ApiError('timeout',503,{priorEffects:'possible'}))).toBe('uncertain');
 expect(diagnosticOutcome({outcome:'cancelled',failure:{code:'stale-generation'}})).toBe('cancelled');
 expect(diagnosticOutcome({outcome:'failed',failure:{code:'transport-failure'}})).toBe('failed');
});
it('reports shutdown failure before closing diagnostics',async()=>{
 const records:Array<{event_name:string}>=[];
 const diagnostics=await createDiagnostics({PIXOO_OBSERVABILITY_ENABLED:'1'},line=>{records.push(JSON.parse(line));});
 const {createApp}=await import('../../apps/server/src/app.js');
 const app=createApp({diagnostics});const error=new Error('synthetic-close');
 app.addHook('onClose',async()=>{throw error;});await app.ready();
 await expect(app.close()).rejects.toBe(error);
 expect(records.map(record=>record.event_name)).toContain('process.failed');
 expect(records.map(record=>record.event_name)).not.toContain('process.stopped');
});
