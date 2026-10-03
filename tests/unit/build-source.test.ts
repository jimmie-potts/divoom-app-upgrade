import {afterEach,expect,it} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const {sourceRevision,writeBuildIdentity}=await import(new URL('../../scripts/build.mjs',import.meta.url).href);
const roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'pixoo-build-'));roots.push(root);
 await mkdir(join(root,'apps/server/dist'),{recursive:true});
 await writeFile(join(root,'.gitignore'),'apps/server/dist/\n');
 await writeFile(join(root,'apps/server/package.json'),JSON.stringify({version:'0.0.0'}));
 const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 const commit=()=>{git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture');return git('rev-parse','HEAD');};
 return {root,git,commit};
}
it('stamps only a clean known root and refuses dirty, untracked and archive provenance',async()=>{
 const {root,git,commit}=await fixture();
 expect(sourceRevision(root)).toBe('unknown');
 git('init','-q');expect(sourceRevision(root)).toBe('unknown');
 const head=commit();expect(sourceRevision(root)).toBe(head);
 expect(writeBuildIdentity(root,head)).toEqual({sourceRevision:head,version:'0.0.0'});
 expect(JSON.parse(await readFile(join(root,'apps/server/dist/build.json'),'utf8'))).toEqual({sourceRevision:head,version:'0.0.0'});
 await writeFile(join(root,'new-source'),'untracked');expect(sourceRevision(root)).toBe('unknown');
 git('add','new-source');expect(sourceRevision(root)).toBe('unknown');
 commit();await writeFile(join(root,'new-source'),'changed');expect(sourceRevision(root)).toBe('unknown');
 const archive=join(root,'apps/server/dist/unpacked');await mkdir(archive);
 expect(sourceRevision(archive)).toBe('unknown');
});
it('does not stamp a different or dirty revision that appeared during the build',async()=>{
 const {root,git,commit}=await fixture();git('init','-q');const before=commit();
 await writeFile(join(root,'new-source'),'next');const after=commit();expect(after).not.toBe(before);
 expect(writeBuildIdentity(root,before).sourceRevision).toBe('unknown');
 await writeFile(join(root,'new-source'),'dirty');
 expect(writeBuildIdentity(root,after).sourceRevision).toBe('unknown');
});
