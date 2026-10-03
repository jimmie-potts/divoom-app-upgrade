import {createHostDiagnostics,type HostDiagnostics} from '@jimmie-potts/bunny-observability/host';
import {randomUUID} from 'node:crypto';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderMedia } from './render.js';
import { MediaError, RENDERER_VERSION, type Rendition } from './contracts.js';
import type { WorkerRequest } from './worker-client.js';
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
process.once('message', async (request: WorkerRequest) => {
  let diagnostics:HostDiagnostics|undefined;
  if(request.diagnostics){
    try{diagnostics=await createHostDiagnostics({enabled:true,...request.diagnostics,resource:{'service.name':'pixoo-media-worker','service.namespace':'bunny','service.version':'0.0.0','service.instance.id':randomUUID(),'deployment.environment.name':'development'}});}catch{/* Diagnostics initialization cannot reject a render. */}
  }
  let response:{ok:boolean;code?:string};
  const render=async()=>{
    const bytes = await readFile(request.input);
    if (hash(bytes) !== request.sourceHash) throw new MediaError('invalid-input');
    const result = await renderMedia(bytes,request.transform,request.profile,request.limits);
    const manifest: Rendition = { id:request.id, sourceHash:request.sourceHash, renderer:RENDERER_VERSION, transform:request.transform, profile:request.profile,
      source:result.source, warnings:result.warnings, effectiveDurationMs:result.frames.some(f=>f.delayMs === null) ? null : result.frames.reduce((a,f)=>a+f.delayMs!,0), frames:[] };
    for (const [index,frame] of result.frames.entries()) {
      await writeFile(join(request.output,`${index}.rgb`),frame.rgb,{flag:'wx'});
      await writeFile(join(request.output,`${index}.png`),frame.preview,{flag:'wx'});
      manifest.frames.push({index,delayMs:frame.delayMs,rgbHash:hash(frame.rgb),previewHash:hash(frame.preview)});
    }
    await writeFile(join(request.output,'manifest.json'),JSON.stringify(manifest),{flag:'wx'});
  };
  try{
    if(diagnostics)await diagnostics.run({scope:'bunny.media',operation:'media',spanName:'bunny.command.execute',root:true,traceparent:request.diagnostics?.traceparent,authenticated:true,owned:true},render);else await render();
    response={ok:true};
  }catch(error){response={ok:false,code:error instanceof MediaError?error.code:'decode-failed'};}
  await diagnostics?.shutdown();
  process.send?.(response,()=>process.disconnect());
});
