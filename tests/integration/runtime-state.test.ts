import {expect,it} from 'vitest';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Library} from '@pixoo/library';
import {qualifyRuntimeState,reopenRuntimeState,snapshotRuntimeState,runtimeStateDigest,runtimeStatePaths} from '../../apps/server/src/runtime-state.js';
it('refuses an unknown SQLite sidecar instead of excluding unowned state',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pixoo-state-sidecar-'));
 try{const library=await Library.open({directory:join(root,'library')});await library.close();await writeFile(join(root,'unknown.sqlite-wal'),'unknown durable owner');await expect(runtimeStatePaths(root)).rejects.toThrow('unknown-runtime-state-file');}
 finally{await rm(root,{recursive:true,force:true});}
});
it('qualifies real compiled target writes and previous reopening across the named durable closure',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pixoo-state-qualification-'));
 try{
  const data=join(root,'fixture'),proof=await qualifyRuntimeState(process.cwd(),process.cwd(),process.execPath,data);
  expect(proof.status).toBe('compatible');expect(await runtimeStatePaths(data)).toEqual(expect.arrayContaining(['library/catalog.sqlite','agent-monitor/state/state.sqlite','agent-monitor/config.json','agent-monitor/presentation.json','agent-monitor/now-playing.json','device.json','mcp-credentials.json','agent-monitor/mcp-credentials.json']));
  await snapshotRuntimeState(data,join(root,'copy'));expect(await reopenRuntimeState(process.cwd(),process.cwd(),process.execPath,join(root,'copy'))).toBe(proof.stateSha256);
  expect(await runtimeStateDigest(data)).toBe(proof.stateSha256);
  await writeFile(join(data,'unknown.json'),'{}');await expect(runtimeStatePaths(data)).rejects.toThrow('unknown-runtime-state-file');
 }finally{await rm(root,{recursive:true,force:true});}
},30000);
it('refuses missing recovery implementation before creating fixture state',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pixoo-state-refusal-'));
 try{await mkdir(join(root,'unsupported'));await expect(qualifyRuntimeState(process.cwd(),join(root,'unsupported'),process.execPath,join(root,'state'))).rejects.toThrow();}
 finally{await rm(root,{recursive:true,force:true});}
});
