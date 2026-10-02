import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {HttpDeviceAdapter} from '@pixoo/device';
import {createDeviceTransport} from '../packages/device/dist/http-transport.js';
import {GIF_EXPERIMENT_PROFILE,parseGifQualificationArgs,runGifQualification,gifQualificationPreview} from '../packages/device/dist/gif-qualification.js';
import {acquireDeviceOwner} from '../apps/server/dist/device-owner.js';
import {privatePath} from '../apps/server/dist/config.js';
if(process.argv.length===3&&process.argv[2]==='--help'){
 console.log('Offline default: emit HTML to stdout or --preview /absolute/new-file.html. Physical: --device --allow-display-change --confirm-exclusive-writer --owner NAME --model Pixoo64 --firmware VERSION_OR_unknown --source-revision SHA and explicit PIXOO_DEVICE_IP. Five fixed stages, 180 seconds maximum; final control may remain displayed. See docs/gif-qualification.md.');
}else{
 let device,release;const abort=new AbortController(),stop=()=>abort.abort();const exchanges=[];
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
 try{
  const config=parseGifQualificationArgs(process.argv.slice(2),process.env);
  if(config.preview)await writeFile(await privatePath(config.preview),gifQualificationPreview(),{flag:'wx',mode:0o600});
  if(config.mode==='fake'){
   if(!config.preview)process.stdout.write(gifQualificationPreview());
  }else{
   const cwd=fileURLToPath(new URL('..',import.meta.url));
   if(execFileSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8'}).trim()!==config.sourceRevision||execFileSync('git',['status','--porcelain'],{cwd,encoding:'utf8'}).trim())throw new Error('Physical execution requires the supplied revision and clean worktree');
   release=await acquireDeviceOwner(config.ip);const transport=createDeviceTransport(config.ip);
   device=new HttpDeviceAdapter({ip:config.ip,profile:GIF_EXPERIMENT_PROFILE},async(body,signal)=>{
    const request={...body};if(typeof request.PicData==='string'){const bytes=Buffer.from(request.PicData,'base64');request.PicData={byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
    const entry={request,startedAtMs:performance.now(),completedAtMs:null,response:null,error:null};exchanges.push(entry);
    try{const response=await transport(body,signal);entry.response=Object.fromEntries(['error_code','PicId','SelectIndex','Brightness','LightSwitch'].filter(k=>typeof response[k]==='number').map(k=>[k,response[k]]));return response;}
    catch(error){entry.error={code:typeof error.code==='string'?error.code:'transport-error'};throw error;}
    finally{entry.completedAtMs=performance.now();}
   });
   const report=await runGifQualification(device,abort.signal);
   console.log(JSON.stringify({...report,exchanges,sourceRevision:config.sourceRevision,timeOrigin:performance.timeOrigin,profile:GIF_EXPERIMENT_PROFILE,evidence:'http-complete-observation-pending',restoration:'Settings unchanged; final sent content may remain. No artwork restoration attempted.'},null,2));
   process.exitCode=report.status==='complete'?0:1;
  }
 }catch{console.error('GIF qualification failed; inspect source revision, admission flags and exclusive ownership. No automatic retry.');process.exitCode=1;}
 finally{try{await device?.close();}finally{release?.();process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}}
}
