import {it,expect} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {inspectRuntimeSource} from '../../apps/server/src/runtime-source.js';

it('requires clean exact source and reports the full prior-to-target comparison',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pixoo-source-'));
 const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 try{
  git('init','--quiet');git('config','user.email','fixture@example.invalid');git('config','user.name','Fixture');
  git('remote','add','origin','git@github.com:jimmie-potts/divoom-app-upgrade.git');
  await writeFile(join(root,'first.txt'),'first');git('add','.');git('commit','--quiet','-m','Initial fixture');const before=git('rev-parse','HEAD');
  await writeFile(join(root,'second.txt'),'second');git('add','.');git('commit','--quiet','-m','Second fixture (#12)');const target=git('rev-parse','HEAD');
  const source=inspectRuntimeSource(root,target,before,()=>target);
  expect(source.commits).toEqual([{sha:target,subject:'Second fixture (#12)',pullRequests:[12]}]);
  expect(source.components).toEqual(['second.txt']);expect(source.comparison.status).toBe('complete');
  await writeFile(join(root,'second.txt'),'dirty');
  expect(()=>inspectRuntimeSource(root,target,before,()=>target)).toThrow('dirty-runtime-source');
 }finally{await rm(root,{recursive:true,force:true});}
});

it('refuses unknown remote state, unmerged source and arbitrary target expressions',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pixoo-source-'));
 const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 try{
  git('init','--quiet');git('config','user.email','fixture@example.invalid');git('config','user.name','Fixture');
  git('remote','add','origin','https://github.com/jimmie-potts/divoom-app-upgrade.git');
  await writeFile(join(root,'first.txt'),'first');git('add','.');git('commit','--quiet','-m','Initial fixture');const main=git('rev-parse','HEAD');
  expect(()=>inspectRuntimeSource(root,'HEAD',null,()=>main)).toThrow('full-runtime-revision-required');
  expect(()=>inspectRuntimeSource(root,main,null,()=>null)).toThrow('runtime-remote-unavailable');
  await writeFile(join(root,'second.txt'),'second');git('add','.');git('commit','--quiet','-m','Unmerged');const branch=git('rev-parse','HEAD');
  expect(()=>inspectRuntimeSource(root,branch,null,()=>main)).toThrow('unmerged-runtime-source');
 }finally{await rm(root,{recursive:true,force:true});}
});
