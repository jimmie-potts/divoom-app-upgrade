import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir,cpus,loadavg} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createApp} from '../apps/server/dist/app.js';
import {provisionCredential} from '../apps/server/dist/mcp-config.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const directory=await mkdtemp(join(tmpdir(),'pixoo-monitor-profile-'));
const limits={1:{p95:63,p99:65},10:{p95:82,p99:87},50:{p95:377,p99:396}};
const repeats=3,samples=1000;
const receipt={version:1,scope:'isolated Linux authenticated hook to embedded durable host; excludes installation, rendering and optical evidence',node:process.version,platform:process.platform,cpuCount:cpus().length,load:loadavg(),baseline:'agent-device-hub@1fd353215532a5d0220b99d9b35b6da0436221cc/docs/performance/linux-budgets.json',repeats,samplesPerRepeat:samples,profiles:[],passed:true};
try{
 if(process.platform!=='linux')throw new Error('Linux qualification required');
 for(const concurrency of [1,10,50]){
  const pooled=[];
  for(let repeat=0;repeat<repeats;repeat++){
   const dataDir=join(directory,`${concurrency}-${repeat}`);await mkdir(join(dataDir,'agent-monitor'),{recursive:true});
   await writeFile(join(dataDir,'agent-monitor','config.json'),JSON.stringify({version:1,mode:'embedded',ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true},{id:'nanoleaf',clearOnNewTurn:false},{id:'stalled',clearOnNewTurn:false}]}));
   const token=await provisionCredential(join(dataDir,'agent-monitor'),'producer',['control']);
   const app=createApp({dataDir,monitorEnabled:true});let peakRss=process.memoryUsage().rss;
   const monitor=setInterval(()=>{peakRss=Math.max(peakRss,process.memoryUsage().rss);},10);
   const times=[];let sequence=0;
   try{
    const address=await app.listen({host:'127.0.0.1',port:0});
    const path=join(dataDir,'hook.json');
    await writeFile(path,JSON.stringify({enabled:true,qualified:true,source:{provider:'codex',client:'cli',hostId:'host',sourceId:'source',hook:'UserPromptSubmit'},endpoint:address+'/api/monitor/v1/events',token}),{mode:0o600});
    const invoke=async()=>{
     const number=sequence++,at=performance.now();
     await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,[join(root,'scripts/monitor-hook.mjs'),path],{stdio:['pipe','pipe','pipe']});let output=0;
      const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('hook-timeout'));},3000);
      child.stdout.on('data',part=>{output+=part.length;});child.stderr.on('data',part=>{output+=part.length;});
      child.once('error',reject);child.once('exit',code=>{clearTimeout(timeout);if(code!==0||output)reject(new Error('hook-failed'));else resolve();});
      child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({session_id:`session-${number%concurrency}`,turn_id:`turn-${number}`,prompt:'EXCLUDED-PERFORMANCE-CANARY'}));
     });
     return performance.now()-at;
    };
    const coldMs=await invoke();
    for(let offset=0;offset<samples;offset+=concurrency)times.push(...await Promise.all(Array.from({length:Math.min(concurrency,samples-offset)},invoke)));
    const state=await (await fetch(address+'/api/monitor/v1/sessions',{headers:{authorization:`Bearer ${token}`}})).json();
    if(state.snapshot.revision+state.admissionRejected!==samples+1)throw new Error('unaccounted-admission');
    times.sort((a,b)=>a-b);pooled.push(...times);
    const p95=times[Math.ceil(times.length*.95)-1],p99=times[Math.ceil(times.length*.99)-1];
    const passed=p95<=limits[concurrency].p95&&p99<=limits[concurrency].p99&&Math.max(...times)<3000;
    receipt.passed&&=passed;receipt.profiles.push({concurrency,repeat,coldMs,p95Ms:p95,p99Ms:p99,maxMs:times.at(-1),hostPeakRssMiB:peakRss/1048576,admitted:state.snapshot.revision,overloadRejected:state.admissionRejected,passed});
    process.stderr.write(`Completed ${concurrency} tasks, repetition ${repeat+1}: p95 ${p95.toFixed(1)} ms, p99 ${p99.toFixed(1)} ms, ${passed?'pass':'fail'}\n`);
   }finally{clearInterval(monitor);await app.close();}
  }
  pooled.sort((a,b)=>a-b);const p95=pooled[Math.ceil(pooled.length*.95)-1],p99=pooled[Math.ceil(pooled.length*.99)-1];
  receipt.passed&&=p95<=limits[concurrency].p95&&p99<=limits[concurrency].p99;
 }
}catch(error){receipt.passed=false;receipt.failure=error.message;}finally{await rm(directory,{recursive:true,force:true});}
process.stdout.write(JSON.stringify(receipt,null,2)+'\n');if(!receipt.passed)process.exitCode=1;
