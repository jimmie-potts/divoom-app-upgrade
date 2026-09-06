import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderMedia } from './render.js';
import { MediaError, RENDERER_VERSION, type Rendition } from './contracts.js';
import type { WorkerRequest } from './worker-client.js';
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
process.once('message', async (request: WorkerRequest) => {
  try {
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
    process.send?.({ok:true},() => process.disconnect());
  } catch (error) {
    process.send?.({ok:false,code:error instanceof MediaError ? error.code : 'decode-failed'},() => process.disconnect());
  }
});
