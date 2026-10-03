import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,symlink,chmod,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runtimeInventory,verifyInventory} from '../../apps/server/src/runtime-release.js';

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
