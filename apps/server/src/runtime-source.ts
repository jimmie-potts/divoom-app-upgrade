import {spawnSync} from 'node:child_process';
import {realpathSync} from 'node:fs';

const revision=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
export function runtimeGit(repository:string,args:string[]):string {
 const result=spawnSync('git',['--no-optional-locks',...args],{cwd:repository,encoding:'utf8',timeout:15000,maxBuffer:16*1024*1024,
  env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0'}});
 if(result.error||result.status!==0)throw new Error('runtime-source-unavailable');return result.stdout.trim();
}
export function runtimeRemoteMain(repository:string):string|null {
 try{const sha=runtimeGit(repository,['ls-remote','--exit-code','origin','refs/heads/main']).split(/\s/)[0];return revision(sha)?sha:null;}
 catch{return null;}
}
export interface RuntimeSource {
 repository:string;head:string;target:string;mergedMain:string;clean:true;
 comparison:{status:'complete'}|{status:'unknown';reason:string};
 commits:{sha:string;subject:string;pullRequests:number[]}[];
 removedCommits:{sha:string;subject:string;pullRequests:number[]}[];components:string[];
}

/** Inspect the whole change from the installed revision without fetching or changing a checkout. */
export function inspectRuntimeSource(repository:string,target:string,previous:string|null,
 remote:(repository:string)=>string|null=runtimeRemoteMain):RuntimeSource {
 if(!revision(target))throw new Error('full-runtime-revision-required');
 if(realpathSync(runtimeGit(repository,['rev-parse','--show-toplevel']))!==realpathSync(repository))throw new Error('runtime-source-root-mismatch');
 if(!/^(https:\/\/github\.com\/|git@github\.com:)jimmie-potts\/divoom-app-upgrade(?:\.git)?$/.test(runtimeGit(repository,['remote','get-url','origin'])))throw new Error('untrusted-runtime-source');
 if(runtimeGit(repository,['status','--porcelain=v1','--untracked-files=all']))throw new Error('dirty-runtime-source');
 const mergedMain=remote(repository);if(!revision(mergedMain))throw new Error('runtime-remote-unavailable');
 const head=runtimeGit(repository,['rev-parse','--verify','HEAD^{commit}']);
 try{
  runtimeGit(repository,['merge-base','--is-ancestor',target,mergedMain]);
  runtimeGit(repository,['merge-base','--is-ancestor',head,mergedMain]);
 }catch{throw new Error('unmerged-runtime-source');}
 const result:RuntimeSource={repository,head,target,mergedMain,clean:true,comparison:{status:'unknown',reason:'legacy-source-unknown'},commits:[],removedCommits:[],components:[]};
 if(previous!==null){
  if(!revision(previous))throw new Error('invalid-previous-runtime-revision');
  try{
   runtimeGit(repository,['cat-file','-e',previous+'^{commit}']);
   const history=(range:string)=>{
    const rows=runtimeGit(repository,['log','--reverse','--format=%H%x00%s',range,'--']);
    return rows?rows.split('\n').map(row=>{
     const [sha,...rest]=row.split('\0'),subject=rest.join('\0');if(!revision(sha))throw new Error('invalid-runtime-history');
     return {sha,subject,pullRequests:[...subject.matchAll(/\(#([1-9][0-9]*)\)/g)].map(match=>Number(match[1]))};
    }):[];
   };
   result.commits=history(previous+'..'+target);result.removedCommits=history(target+'..'+previous);
   result.components=runtimeGit(repository,['diff','--name-only',previous,target,'--']).split('\n').filter(Boolean);
   result.comparison={status:'complete'};
  }catch{throw new Error('runtime-source-comparison-unavailable');}
 }
 return result;
}
