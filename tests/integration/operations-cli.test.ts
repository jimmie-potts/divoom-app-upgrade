import {expect,it} from 'vitest';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Library} from '@pixoo/library';
import {createApp} from '../../apps/server/src/app.js';
const exec=promisify(execFile),entry=fileURLToPath(new URL('../../apps/server/dist/operations-cli.js',import.meta.url));
it('runs backup and restore from another cwd, reports errors and reads loopback diagnostics',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pixoo-ops-cli-')),source=join(root,'source'),bundle=join(root,'bundle'),target=join(root,'target');
 const library=await Library.open({directory:join(source,'library')});await library.createPlaylist('Kept by CLI');await library.close();
 const cli=(args:string[],port='0')=>exec(process.execPath,[entry,...args],{cwd:root,env:{...process.env,PIXOO_PORT:port},timeout:10000});
 let app:ReturnType<typeof createApp>|undefined;
 try{
  expect((await cli(['backup',source,bundle])).stdout).toContain('Backup verified');
  expect((await cli(['restore',bundle,target])).stdout).toContain('Restore verified');
  await expect(cli(['restore',bundle,target])).rejects.toMatchObject({code:1,stderr:expect.stringContaining('destination-exists')});
  await expect(cli(['backup'])).rejects.toMatchObject({code:1,stderr:expect.stringContaining('Usage:')});
  app=createApp({dataDir:target});const address=await app.listen({host:'127.0.0.1',port:0});
  expect(JSON.parse((await cli(['diagnostics'],new URL(address).port)).stdout)).toMatchObject({status:'ready',mode:'simulator'});
  expect(await(await fetch(address+'/api/playlists')).json()).toEqual(expect.arrayContaining([expect.objectContaining({name:'Kept by CLI'})]));
  await app.close();app=undefined;
  await expect(cli(['diagnostics'],new URL(address).port)).rejects.toMatchObject({code:1,stderr:expect.stringContaining('diagnostics-unavailable')});
 }finally{await app?.close();await rm(root,{recursive:true,force:true});}
},20000);
