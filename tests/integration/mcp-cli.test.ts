import {expect,it} from 'vitest';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {authenticateCredential} from '../../apps/server/src/mcp-config.js';
it('runs explicit local provisioning and revocation through the built CLI',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pixoo-mcp-cli-')),cli=fileURLToPath(new URL('../../apps/server/dist/mcp-cli.js',import.meta.url));
 try{
  const {stdout}=await promisify(execFile)(process.execPath,[cli,'add',directory,'fixture','read']);const token=stdout.trim();
  expect(await authenticateCredential(directory,token)).toMatchObject({id:'fixture',credential:{scopes:['read']}});
  await promisify(execFile)(process.execPath,[cli,'revoke',directory,'fixture']);expect(await authenticateCredential(directory,token)).toBeNull();
  await expect(promisify(execFile)(process.execPath,[cli,'add',directory,'fixture','all'])).rejects.toMatchObject({code:1});
 }finally{await rm(directory,{recursive:true,force:true});}
});
