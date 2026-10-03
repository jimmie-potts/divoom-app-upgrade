import {spawnSync} from 'node:child_process';
import {cp,lstat,mkdir,readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {canonicalRuntime,readRuntimeFile,runtimeFileHash,runtimeHash,runtimeInventory,verifyInventory,type RuntimeInventory,type RuntimeRelease} from './runtime-release.js';

interface RuntimeManifest {schemaVersion:1;artifact:'pixoo-runtime';sourceRevision:string;version:string;inventory:RuntimeInventory}

/** Stage a freshly built closure. The caller owns clean merged-source qualification. */
export async function stageRuntimeBundle(source:string,destination:string,revision:string):Promise<RuntimeRelease> {
 const build=JSON.parse((await readRuntimeFile(join(source,'apps/server/dist/build.json'),4096)).toString()) as {sourceRevision:unknown;version:unknown};
 if(!/^[a-f0-9]{40}$/.test(revision)||build.sourceRevision!==revision||typeof build.version!=='string'||!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(build.version))throw new Error('runtime-build-identity-mismatch');
 await mkdir(destination,{mode:0o700});const runtime=join(destination,'runtime');await mkdir(runtime,{mode:0o700});
 await cp(join(source,'package.json'),join(runtime,'package.json'),{errorOnExist:true,force:false,verbatimSymlinks:true});
 for(const group of ['apps','packages']){
  await mkdir(join(runtime,group));
  for(const name of (await readdir(join(source,group))).sort()){
   const origin=join(source,group,name),info=await lstat(origin);
   if(!info.isDirectory()||info.isSymbolicLink())throw new Error('unsafe-runtime-workspace');
   const target=join(runtime,group,name);await mkdir(target);
   await cp(join(origin,'package.json'),join(target,'package.json'),{errorOnExist:true,force:false,verbatimSymlinks:true});
   for(const directory of ['dist','node_modules']){
    try{
     const nested=await lstat(join(origin,directory));if(!nested.isDirectory()||nested.isSymbolicLink())throw new Error('unsafe-runtime-workspace');
     await cp(join(origin,directory),join(target,directory),{recursive:true,errorOnExist:true,force:false,verbatimSymlinks:true,preserveTimestamps:true});
    }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
   }
  }
 }
 await cp(join(source,'node_modules'),join(runtime,'node_modules'),{recursive:true,errorOnExist:true,force:false,verbatimSymlinks:true,preserveTimestamps:true});
 const inventory=await runtimeInventory(runtime);
 const manifest:RuntimeManifest={schemaVersion:1,artifact:'pixoo-runtime',sourceRevision:revision,version:build.version,inventory};
 const bytes=canonicalRuntime(manifest)+'\n';await writeFile(join(destination,'manifest.json'),bytes,{flag:'wx',mode:0o600});
 const result=spawnSync('tar',['--sort=name','--mtime=@0','--owner=0','--group=0','--numeric-owner','--format=gnu','-czf',join(destination,'runtime.tgz'),'-C',destination,'manifest.json','runtime'],
  {encoding:'utf8',timeout:120000,maxBuffer:1024*1024});
 if(result.error||result.status!==0)throw new Error('runtime-archive-failed');
 const identity:RuntimeRelease={kind:'release',sourceRevision:revision,version:build.version,archiveSha256:await runtimeFileHash(join(destination,'runtime.tgz'),1024*1024*1024),manifestSha256:runtimeHash(bytes)};
 await verifyRuntimeBundle(destination,identity);return identity;
}

export async function verifyRuntimeBundle(directory:string,identity:RuntimeRelease):Promise<void> {
 const bytes=await readRuntimeFile(join(directory,'manifest.json'));
 if(runtimeHash(bytes)!==identity.manifestSha256)throw new Error('runtime-manifest-changed');
 const manifest=JSON.parse(bytes.toString()) as RuntimeManifest;
 if(manifest.schemaVersion!==1||manifest.artifact!=='pixoo-runtime'||manifest.sourceRevision!==identity.sourceRevision||manifest.version!==identity.version)throw new Error('runtime-manifest-identity-mismatch');
 await verifyInventory(join(directory,'runtime'),manifest.inventory);
 if(await runtimeFileHash(join(directory,'runtime.tgz'),1024*1024*1024)!==identity.archiveSha256)throw new Error('runtime-archive-changed');
 const build=JSON.parse((await readRuntimeFile(join(directory,'runtime/apps/server/dist/build.json'),4096)).toString()) as {sourceRevision:unknown;version:unknown};
 if(build.sourceRevision!==identity.sourceRevision||build.version!==identity.version)throw new Error('runtime-build-identity-mismatch');
}
