import {expect,it} from 'vitest';
import {spawn,spawnSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {existsSync} from 'node:fs';
import {chmod,mkdir,mkdtemp,readFile,readdir,rename,rm,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {pairingToken,standInHub} from '../helpers/stand-in-hub.js';

const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function until<T>(read:()=>Promise<T>,accept:(value:T)=>boolean):Promise<T>{
 const deadline=Date.now()+15000;let value=await read();
 while(!accept(value)&&Date.now()<deadline){await delay(100);value=await read();}
 if(!accept(value))throw new Error('timed out waiting for paired run');return value;
}
async function call(entry:string,args:string[],env:NodeJS.ProcessEnv){
 const child=spawn(process.execPath,[entry,...args],{cwd:process.cwd(),env,stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',chunk=>{stdout+=chunk;});child.stderr.on('data',chunk=>{stderr+=chunk;});
 const code=await new Promise<number|null>((done,reject)=>{child.once('error',reject);child.once('close',done);});
 const line=stdout.trim().split('\n').filter(Boolean).at(-1);
 return {code,stderr,result:line?JSON.parse(line) as Record<string,unknown>:undefined};
}
async function writable(path:string):Promise<void>{
 await chmod(path,0o700);
 for(const entry of await readdir(path,{withFileTypes:true})){
  const child=join(path,entry.name);if(entry.isDirectory())await writable(child);else await chmod(child,0o600);
 }
}
async function frozenBytes(path:string):Promise<Record<string,string>>{
 const result:Record<string,string>={};
 async function walk(directory:string,prefix=''){
  for(const entry of await readdir(directory,{withFileTypes:true})){
   const relative=join(prefix,entry.name),absolute=join(directory,entry.name);
   if(entry.isDirectory())await walk(absolute,relative);
   else if(entry.isFile())result[relative]=createHash('sha256').update(await readFile(absolute)).digest('hex');
   else throw new Error('unexpected frozen proof entry');
  }
 }
 await walk(path);return result;
}

// CI covers the same source/transport with plain child processes. This explicit
// qualification additionally exercises the real user manager and retained proof.
it.skipIf(process.env.APP_VERIFY_REQUIRE_SYSTEMD!=='1')('pauses a supervised Pixoo feed, reseeds a lower owner, and keeps failed release stoppable',async()=>{
 const manager=spawnSync('systemctl',['--user','is-system-running'],{encoding:'utf8'});
 expect(['running','degraded','starting','initializing']).toContain(manager.stdout.trim());
 const cache=join(homedir(),'.cache','pixoo-verify');await mkdir(cache,{recursive:true});
 const base=await mkdtemp(join(cache,'gh127-')),app=`px${randomBytes(3).toString('hex')}`;
 const stateRoot=join(base,'state'),proofRoot=join(base,'proof'),tmp=join(base,'tmp');
 const marker=join(base,'expected-old-pid'),audit=join(base,'seed-order.jsonl');await mkdir(tmp);
 const env={...process.env,TMPDIR:tmp,APP_VERIFY_STATE_ROOT:stateRoot,APP_VERIFY_PROOF_ROOT:proofRoot,APP_VERIFY_WINDOWS_CHECK:'off'};
 const core=pathToFileURL(resolve('node_modules/@jimmie-potts/app-verify/dist/index.js')).href;
 const adapter=pathToFileURL(resolve('scripts/verify/plugin.ts')).href,entry=join(base,'verify.mjs');
 await writeFile(entry,`
import {runCli} from ${JSON.stringify(core)};
import plugin from ${JSON.stringify(adapter)};
import {existsSync,readFileSync,appendFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const original=plugin.scenarios['hub-paired'];
const paired={...original,async seed(context){
 if(existsSync(${JSON.stringify(marker)})){
  const oldPid=Number(readFileSync(${JSON.stringify(marker)},'utf8'));
  const show=spawnSync('systemctl',['--user','show','app-verify-'+context.runId+'.service','-p','MainPID','-p','ActiveState','-p','LoadState'],{encoding:'utf8'});
  const values=Object.fromEntries(show.stdout.trim().split(String.fromCharCode(10)).map(line=>line.split('=')));
  const activePid=Number(values.MainPID);
  const stopped=values.LoadState==='not-found'||(activePid===0&&['inactive','failed'].includes(values.ActiveState));
  const record={oldPid,activePid,requestExists:existsSync(context.runtimeDir+'/feed-pause.request'),releaseExists:existsSync(context.runtimeDir+'/feed-pause.release')};
  appendFileSync(${JSON.stringify(audit)},JSON.stringify(record)+'\\n');
  if(show.error||!stopped||!record.requestExists)throw new Error('old paired unit was not stopped before seed');
 }
 return original.seed(context);
}};
const selected={...plugin,app:${JSON.stringify(app)},scenarios:{...plugin.scenarios,'hub-paired':paired}};
process.exitCode=await runCli(selected,process.argv.slice(2));
`);
 const cli=(args:string[])=>call(entry,args,env),token={feed:pairingToken(),controller:pairingToken()};
 const hub=await standInHub(token.feed);hub.setFeed('accept');let runId='';
 try{
  await hub.event('session.started');await hub.event('turn.ended');const oldRevision=hub.revision();
  const start=await cli(['start','--lease','10']);expect(start.code,start.stderr).toBe(0);runId=String(start.result?.runId);
  const runtime=join(stateRoot,runId),proof=join(proofRoot,runId);
  const control=(name:string)=>join(runtime,`feed-pause.${name}`);
  const writeControl=async(name:string,value:unknown)=>{const path=control(`tmp-${randomBytes(6).toString('hex')}`);await writeFile(path,JSON.stringify(value),{mode:0o600,flag:'wx'});await rename(path,control(name));};
  const ack=(nonce:string)=>until(async()=>{try{return JSON.parse(await readFile(control('ack'),'utf8')) as {nonce?:string;pid?:number};}catch{return {};}},value=>value.nonce===nonce);
  await writeFile(join(runtime,'hub-feed-token'),token.feed,{mode:0o600});await writeFile(join(runtime,'hub-controller-token'),token.controller,{mode:0o600});
  const paired=await cli(['scenario',runId,'hub-paired','--input',`hub-feed=${hub.origin}`]);expect(paired.code,paired.stderr).toBe(0);
  const port=Number(paired.result?.port),url=String(paired.result?.url);
  const tokensBefore=await Promise.all(['hub-feed-token','hub-controller-token'].map(name=>readFile(join(runtime,name))));
  const captured=await cli(['capture',runId,'hub-sessions']);expect(captured.code,captured.stderr).toBe(0);expect(captured.result).toMatchObject({outcome:'passed',set:'verified'});
  const handoff=await cli(['handoff',runId]);expect(handoff.code,handoff.stderr).toBe(0);
  const verified=join(proof,'verified'),frozenBefore=await frozenBytes(verified);
  expect(Object.keys(frozenBefore)).toContain('SHA256SUMS');expect(Object.keys(frozenBefore).some(name=>name.endsWith('assertions.json'))).toBe(true);
  const doctor=async()=>{
   const result=await cli(['doctor',runId]);expect(result.code,result.stderr).toBe(0);
   return (result.result?.runs as {unit:{mainPid:number};proof:{sums:string};checks:{id:string;outcome:string}[]}[])[0]!;
  };
  const oldPid=(await doctor()).unit.mainPid;
  const first={version:1,runId,nonce:randomBytes(16).toString('hex')};await writeControl('request',first);
  expect(await ack(first.nonce)).toEqual({...first,pid:oldPid});
  const calls=hub.reads.accepted;
  expect((await fetch(new URL('/api/health',url))).status).toBe(200);expect((await fetch(url)).status).toBe(200);
  await hub.reset();expect(hub.revision()).toBeLessThan(oldRevision);await writeControl('release',first);
  await delay(1200);expect(hub.reads.accepted).toBe(calls);expect((await doctor()).unit.mainPid).toBe(oldPid);
  await writeFile(marker,String(oldPid),{mode:0o600});
  const resumed=await cli(['scenario',runId,'hub-paired']);expect(resumed.code,resumed.stderr).toBe(0);expect(resumed.result?.port).toBe(port);
  const observations=(await readFile(audit,'utf8')).trim().split('\n').map(line=>JSON.parse(line) as Record<string,unknown>);
  expect(observations).toContainEqual({oldPid,activePid:0,requestExists:true,releaseExists:true});
  const current=await until(async()=>(await fetch(new URL('/api/integration/v1/sessions',url))).json() as Promise<{connection:string;snapshot?:{revision:number}}>,view=>view.connection==='current'&&view.snapshot?.revision===hub.revision());
  expect(current.snapshot!.revision).toBeLessThan(oldRevision);
  const ready=await doctor(),newPid=ready.unit.mainPid;expect(newPid).not.toBe(oldPid);expect(ready.proof.sums).toBe('ok');expect(ready.checks.find(check=>check.id==='hub-feed')?.outcome).toBe('passed');
  for(const name of ['request','ack','release'])expect(existsSync(control(name))).toBe(false);
  expect(await Promise.all(['hub-feed-token','hub-controller-token'].map(name=>readFile(join(runtime,name))))).toEqual(tokensBefore);expect(await frozenBytes(verified)).toEqual(frozenBefore);
  const second={version:1,runId,nonce:randomBytes(16).toString('hex')};await writeControl('request',second);expect(await ack(second.nonce)).toEqual({...second,pid:newPid});await writeFile(marker,String(newPid),{mode:0o600});
  const refused=await cli(['scenario',runId,'hub-paired']);expect(refused.code).toBe(1);expect(refused.result).toMatchObject({state:'stopped',cause:'reset-failed'});expect(String(refused.result?.detail)).toContain('matching feed-pause.release');
  const stopped=await cli(['stop',runId]);expect(stopped.code,stopped.stderr).toBe(0);expect(await frozenBytes(verified)).toEqual(frozenBefore);
 }finally{
  if(runId)await cli(['stop',runId]);await hub.close();await writable(base);await rm(base,{recursive:true,force:true});
  const listed=spawnSync('systemctl',['--user','list-units','--all','--plain','--no-legend',`app-verify-${app}-*`],{encoding:'utf8'});
  expect(listed.status).toBe(0);expect(listed.stdout.trim()).toBe('');
 }
},300000);
