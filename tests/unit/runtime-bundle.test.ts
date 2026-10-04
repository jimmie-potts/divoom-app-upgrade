import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {stageRuntimeBundle,verifyRuntimeBundle} from '../../apps/server/src/runtime-bundle.js';

it('packages the complete compiled closure and detects manifest and runtime tampering',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pixoo-bundle-')),source=join(root,'source'),destination=join(root,'release'),sha='b'.repeat(40);
 try{
  for(const path of ['apps/server/dist','packages/core/dist','node_modules'])await mkdir(join(source,path),{recursive:true});
  await writeFile(join(source,'package.json'),'{"type":"module"}');
  await writeFile(join(source,'apps/server/package.json'),'{"name":"@pixoo/server","version":"0.0.0"}');
  await writeFile(join(source,'packages/core/package.json'),'{"name":"@pixoo/core"}');
  await writeFile(join(source,'apps/server/dist/build.json'),JSON.stringify({sourceRevision:sha,version:'0.0.0'}));
  await writeFile(join(source,'apps/server/dist/main.js'),'export {};');await writeFile(join(source,'packages/core/dist/index.js'),'export {};');
  await writeFile(join(source,'.env'),'PRIVATE=synthetic');
  const identity=await stageRuntimeBundle(source,destination,sha);
  await verifyRuntimeBundle(destination,identity);
  await expect(readFile(join(destination,'runtime/.env'))).rejects.toMatchObject({code:'ENOENT'});
  await writeFile(join(destination,'runtime/apps/server/dist/main.js'),'tampered');
  await expect(verifyRuntimeBundle(destination,identity)).rejects.toThrow('runtime-inventory-changed');
  await writeFile(join(destination,'manifest.json'),'{}');
  await expect(verifyRuntimeBundle(destination,identity)).rejects.toThrow('runtime-manifest-changed');
 }finally{await rm(root,{recursive:true,force:true});}
});

it('refuses build metadata that cannot establish the requested revision',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pixoo-bundle-'));
 try{
  await mkdir(join(root,'source/apps/server/dist'),{recursive:true});
  await writeFile(join(root,'source/apps/server/dist/build.json'),JSON.stringify({sourceRevision:'unknown',version:'0.0.0'}));
  await expect(stageRuntimeBundle(join(root,'source'),join(root,'release'),'b'.repeat(40))).rejects.toThrow('runtime-build-identity-mismatch');
 }finally{await rm(root,{recursive:true,force:true});}
});
