import {spawnSync} from 'node:child_process';
import {realpathSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

/** An exported archive must never borrow its enclosing checkout's identity. */
export function sourceRevision(root){
 try{
  const git=args=>{
   const result=spawnSync('git',args,{cwd:root,encoding:'utf8',timeout:10000,maxBuffer:1024*1024});
   if(result.error||result.status!==0)throw new Error('unknown-source');
   return result.stdout.trim();
  };
  if(realpathSync(git(['rev-parse','--show-toplevel']))!==realpathSync(root))return 'unknown';
  const head=git(['rev-parse','--verify','HEAD^{commit}']);
  return /^[a-f0-9]{40}$/.test(head)&&!git(['status','--porcelain=v1','--untracked-files=all'])?head:'unknown';
 }catch{return 'unknown';}
}

export function writeBuildIdentity(root,before){
 const after=sourceRevision(root);
 const version=JSON.parse(readFileSync(join(root,'apps/server/package.json'),'utf8')).version;
 const build={sourceRevision:before===after?after:'unknown',version};
 writeFileSync(join(root,'apps/server/dist/build.json'),JSON.stringify(build)+'\n');
 return build;
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const root=fileURLToPath(new URL('..',import.meta.url)),before=sourceRevision(root);
 // Compilation may overwrite an older release's output, even if it later fails.
 rmSync(join(root,'apps/server/dist/build.json'),{force:true});
 if(process.argv[2]==='--types'){
  const result=spawnSync('tsc',['-b'],{cwd:root,stdio:'inherit'});
  process.exit(result.error?1:result.status??1);
 }
 for(const args of [['run','build:types'],['run','build','--workspace','@pixoo/web']]){
  const result=spawnSync('npm',args,{cwd:root,stdio:'inherit'});
  if(result.error||result.status!==0)process.exit(result.status??1);
 }
 writeBuildIdentity(root,before);
}
