import {expect,it} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createApp} from '../../apps/server/src/app.js';
import {provisionCredential} from '../../apps/server/src/mcp-config.js';
it('uses the released normalizer with authenticated fail-open transport and excludes raw provider content',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'monitor-hook-')),directory=join(dataDir,'agent-monitor');await mkdir(directory);
 await writeFile(join(directory,'config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}]}));
 const token=await provisionCredential(directory,'producer',['control']);const app=createApp({dataDir,monitorEnabled:true});
 const invoke=()=>new Promise<{code:number|null;output:string;ms:number}>((resolve,reject)=>{
  const start=performance.now(),child=spawn(process.execPath,['scripts/monitor-hook.mjs',join(dataDir,'hook.json')],{cwd:process.cwd(),stdio:['pipe','pipe','pipe']});let output='';
  child.stdout.on('data',part=>{output+=part;});child.stderr.on('data',part=>{output+=part;});child.on('error',reject);child.on('exit',code=>resolve({code,output,ms:performance.now()-start}));
  child.stdin.end(JSON.stringify({session_id:'session',turn_id:'turn',prompt:'PRIVATE-PROMPT-CANARY',cwd:'/private/path',transcript:'PRIVATE-TRANSCRIPT'}));
 });
 try{
  const url=await app.listen({host:'127.0.0.1',port:0});
  await writeFile(join(dataDir,'hook.json'),JSON.stringify({enabled:true,qualified:true,source:{provider:'codex',client:'cli',hostId:'host',sourceId:'source',hook:'UserPromptSubmit'},endpoint:url+'/api/monitor/v1/events',token}));
  expect(await invoke()).toMatchObject({code:0,output:''});
  const state=await (await fetch(url+'/api/monitor/v1/sessions',{headers:{authorization:`Bearer ${token}`}})).json();expect(state.snapshot.sessions).toHaveLength(1);expect(JSON.stringify(state)).not.toContain('PRIVATE');
  await app.close();const failed=await invoke();expect(failed).toMatchObject({code:0,output:''});expect(failed.ms).toBeLessThan(3000);
 }finally{await app.close();await rm(dataDir,{recursive:true,force:true});}
});
