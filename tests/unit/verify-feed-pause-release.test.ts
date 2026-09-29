import {afterEach,expect,it,vi} from 'vitest';
import {readFileSync,renameSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {seedScenario} from '../../scripts/verify/scenarios.ts';
import {makeRun} from '../helpers/verify-run.js';
import {pairingToken,writePairingTokens} from '../helpers/stand-in-hub.js';

// Publish a real replacement at the filesystem boundary, keeping the real file operations.
const hooks=vi.hoisted(()=>({unlink:undefined as undefined|((path:unknown)=>void),rename:undefined as undefined|((path:unknown)=>void)}));
vi.mock('node:fs',async importOriginal=>{
 const original=await importOriginal<typeof import('node:fs')>();
 return {...original,
  unlinkSync:(...args:Parameters<typeof original.unlinkSync>)=>{hooks.unlink?.(args[0]);return original.unlinkSync(...args);},
  renameSync:(...args:Parameters<typeof original.renameSync>)=>{hooks.rename?.(args[0]);return original.renameSync(...args);},
 };
});
const cleanup:(()=>Promise<unknown>)[]=[];
afterEach(async()=>{hooks.unlink=undefined;hooks.rename=undefined;for(const close of cleanup.splice(0))await close();});

it('a completed seed cannot consume a newer pause published during control cleanup',async()=>{
 const run=await makeRun('pixoo-release-race');cleanup.push(run.remove);
 await writePairingTokens(run.runtimeDir,{feed:pairingToken(),controller:pairingToken()});
 const request={version:1,runId:run.runId,nonce:'a'.repeat(32)},newer={...request,nonce:'b'.repeat(32)};
 const path=join(run.runtimeDir,'feed-pause.request');
 for(const kind of ['request','release'])writeFileSync(join(run.runtimeDir,`feed-pause.${kind}`),JSON.stringify(request),{mode:0o600});
 let replaced=false;
 hooks.unlink=target=>{
  if(!replaced&&String(target).includes('feed-pause.')){
   replaced=true;const temporary=join(run.runtimeDir,'replacement');
   writeFileSync(temporary,JSON.stringify(newer),{mode:0o600});renameSync(temporary,path);
  }
 };
 await seedScenario({...run,scenario:'hub-paired',inputs:{'hub-feed':'http://127.0.0.1:41999/'}}).catch((error:unknown)=>{
  expect((error as Error).message).toMatch(/feed pause changed during seed/);
 });
 expect(replaced).toBe(true);
 expect(JSON.parse(readFileSync(path,'utf8'))).toEqual(newer);
});

it('a request changed immediately before its claim is restored and refuses launch',async()=>{
 const run=await makeRun('pixoo-claim-race');cleanup.push(run.remove);
 await writePairingTokens(run.runtimeDir,{feed:pairingToken(),controller:pairingToken()});
 const request={version:1,runId:run.runId,nonce:'a'.repeat(32)},newer={...request,nonce:'b'.repeat(32)};
 const path=join(run.runtimeDir,'feed-pause.request');
 for(const kind of ['request','release'])writeFileSync(join(run.runtimeDir,`feed-pause.${kind}`),JSON.stringify(request),{mode:0o600});
 let replaced=false;
 hooks.rename=target=>{
  if(!replaced&&String(target)===path){
   replaced=true;const temporary=join(run.runtimeDir,'replacement');
   writeFileSync(temporary,JSON.stringify(newer),{mode:0o600});renameSync(temporary,path);
  }
 };
 await expect(seedScenario({...run,scenario:'hub-paired',inputs:{'hub-feed':'http://127.0.0.1:41999/'}})).rejects.toThrow('feed pause changed during seed');
 expect(replaced).toBe(true);
 expect(JSON.parse(readFileSync(path,'utf8'))).toEqual(newer);
});
