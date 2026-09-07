import {expect,it} from 'vitest';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {provisionCredential,revokeCredential,authenticateCredential,validateMcpConfiguration} from '../../apps/server/src/mcp-config.js';
it('provisions only explicitly and revokes current credentials without exposing tokens in storage',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pixoo-mcp-auth-'));
 try{
  await expect(validateMcpConfiguration(directory)).rejects.toThrow('MCP credential configuration');
  const token=await provisionCredential(directory,'codex',['read','control']);
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(await readFile(join(directory,'mcp-credentials.json'),'utf8')).not.toContain(token);
  expect(await authenticateCredential(directory,token)).toMatchObject({id:'codex'});
  expect(await authenticateCredential(directory,'invalid')).toBeNull();
  await revokeCredential(directory,'codex');expect(await authenticateCredential(directory,token)).toBeNull();
 }finally{await rm(directory,{recursive:true,force:true});}
});
it('fails closed for oversized or malformed private credential files',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pixoo-mcp-auth-'));
 try{for(const body of ['{"version":1,"principals":[],"unknown":true}',' '.repeat(65537)]){
  await writeFile(join(directory,'mcp-credentials.json'),body);
  expect(await authenticateCredential(directory,'fixture')).toBeNull();
  await expect(validateMcpConfiguration(directory)).rejects.toThrow('MCP credential configuration');
 }}finally{await rm(directory,{recursive:true,force:true});}
});
it('rejects nonregular credential paths without treating them as valid state',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pixoo-mcp-auth-'));
 try{
  const {mkdir}=await import('node:fs/promises');await mkdir(join(directory,'mcp-credentials.json'));
  await expect(validateMcpConfiguration(directory)).rejects.toThrow('MCP credential configuration');
  expect(await authenticateCredential(directory,'a'.repeat(43))).toBeNull();
 }finally{await rm(directory,{recursive:true,force:true});}
});
