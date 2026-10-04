import {expect,it} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {prepareRuntimeBundle} from '../../apps/server/src/runtime-upgrade.js';
import {type InstallPlan} from '../../apps/server/src/runtime-plan.js';

it('refuses a real failed native build without producing a selectable runtime bundle or changing source',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pixoo-failed-build-')),source=join(root,'source'),scratch=join(root,'staging');
 try{
  await mkdir(source);await mkdir(scratch);
  const manifest={name:'runtime-failed-build-fixture',version:'0.0.0',private:true,scripts:{build:'node -e "require(\'node:fs\').writeFileSync(\'build-attempted\',\'yes\');process.exit(23)"'}};
  await writeFile(join(source,'package.json'),JSON.stringify(manifest));
  await writeFile(join(source,'package-lock.json'),JSON.stringify({name:manifest.name,version:manifest.version,lockfileVersion:3,requires:true,packages:{'':{name:manifest.name,version:manifest.version}}}));
  const git=(...args:string[])=>execFileSync('git',args,{cwd:source,encoding:'utf8'}).trim();
  git('init','--quiet');git('config','user.email','fixture@example.invalid');git('config','user.name','Fixture');git('add','.');git('commit','--quiet','-m','Intentional build failure');
  const revision=git('rev-parse','HEAD'),plan={targetRevision:revision,config:{sourceRoot:source,node:process.execPath,npm:resolve(process.execPath,'../../lib/node_modules/npm/bin/npm-cli.js')}} as InstallPlan;
  await expect(prepareRuntimeBundle(plan,scratch)).rejects.toThrow('runtime-command-failed');
  expect(await readFile(join(scratch,'source/build-attempted'),'utf8')).toBe('yes');expect(await readdir(scratch)).not.toContain('bundle');
  expect(git('status','--porcelain')).toBe('');expect(git('rev-parse','HEAD')).toBe(revision);
 }finally{await rm(root,{recursive:true,force:true});}
},30000);
