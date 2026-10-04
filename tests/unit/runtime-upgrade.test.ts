import {expect,it} from 'vitest';
import {mkdtemp,mkdir,readFile,rm,writeFile,chmod,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runtimeFence,runtimeWrite,withRuntimeLock} from '../../apps/server/src/runtime-files.js';

it('persists a private record, rejects a second writer and restores exact fenced directory mode',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pixoo-upgrade-'));
 try{
  const program=join(root,'program'),record=join(root,'fence.json');await mkdir(program,{mode:0o751});await writeFile(join(program,'main.js'),'export {};');
  await runtimeWrite(join(root,'record.json'),{value:'retained'});
  expect(JSON.parse(await readFile(join(root,'record.json'),'utf8'))).toEqual({value:'retained'});
  await withRuntimeLock(root,async()=>{await expect(withRuntimeLock(root,async()=>{})).rejects.toThrow();});
  await runtimeFence([program],record,async()=>{await expect(readFile(join(program,'main.js'))).rejects.toMatchObject({code:'EACCES'});});
  expect(await readFile(join(program,'main.js'),'utf8')).toBe('export {};');
  expect(JSON.parse(await readFile(record,'utf8'))[0].mode).toBe(0o751);
 }finally{await chmod(join(root,'program'),0o700).catch(()=>{});await rm(root,{recursive:true,force:true});}
});
it('refuses a link in the durable record path without replacing its target',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pixoo-record-'));
 try{await writeFile(join(root,'target'),'preserve');await symlink('target',join(root,'record.json'));
  await expect(runtimeWrite(join(root,'record.json'),{})).rejects.toThrow();expect(await readFile(join(root,'target'),'utf8')).toBe('preserve');
 }finally{await rm(root,{recursive:true,force:true});}
});
