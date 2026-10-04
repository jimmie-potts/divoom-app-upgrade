import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,symlink,chmod,rm,link} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runtimeInventory,verifyInventory} from '../../apps/server/src/runtime-release.js';

it('accepts fully inventoried internal npm hardlinks but refuses an unowned external alias',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pixoo-hardlinks-'));
 try{const program=join(root,'program');await mkdir(program);await writeFile(join(program,'binary'),'same inode');await link(join(program,'binary'),join(program,'npm-alias'));
  expect((await runtimeInventory(program)).entries).toHaveLength(2);
  await link(join(program,'binary'),join(root,'outside'));await expect(runtimeInventory(program)).rejects.toThrow('unsafe-runtime-hardlink');
 }finally{await rm(root,{recursive:true,force:true});}
});

it('binds the complete release bytes, modes and internal dependency links',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pixoo-release-'));
 try{
  await mkdir(join(root,'bin'));await writeFile(join(root,'bin/server.js'),'export {};\n');
  await symlink('bin/server.js',join(root,'entry'));
  const inventory=await runtimeInventory(root);
  await verifyInventory(root,inventory);
  await writeFile(join(root,'bin/server.js'),'changed\n');
  await expect(verifyInventory(root,inventory)).rejects.toThrow('runtime-inventory-changed');
  await writeFile(join(root,'bin/server.js'),'export {};\n');await chmod(join(root,'bin/server.js'),0o700);
  await expect(verifyInventory(root,inventory)).rejects.toThrow('runtime-inventory-changed');
 }finally{await rm(root,{recursive:true,force:true});}
});

it('rejects escaping links and unexpected added files',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pixoo-release-'));
 try{
  await writeFile(join(root,'main.js'),'export {};\n');const inventory=await runtimeInventory(root);
  await writeFile(join(root,'unexpected.js'),'extra');
  await expect(verifyInventory(root,inventory)).rejects.toThrow('runtime-inventory-changed');
  await symlink('../outside',join(root,'escape'));
  await expect(runtimeInventory(root)).rejects.toThrow('unsafe-runtime-link');
 }finally{await rm(root,{recursive:true,force:true});}
});
