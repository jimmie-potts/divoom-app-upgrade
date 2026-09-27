import {expect,it} from 'vitest';
import {mkdtemp,rm,writeFile,readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {provisionCredential,registerCredential,revokeCredential,authenticateCredential,validateMcpConfiguration} from '../../apps/server/src/mcp-config.js';
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
it('registers a caller-supplied token by its digest only, and refuses malformed tokens and reused ids or tokens',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pixoo-mcp-auth-'));
 try{
  const token='Hub-controller_token-0123456789abcdefghijkl';
  await registerCredential(directory,'hub',token,['read','control']);
  const path=join(directory,'mcp-credentials.json'),stored=await readFile(path,'utf8');
  expect(stored).not.toContain(token);
  expect(JSON.parse(stored)).toEqual({version:1,principals:[{id:'hub',enabled:true,digest:createHash('sha256').update(token).digest('hex'),scopes:['read','control']}]});
  expect((await stat(path)).mode&0o777).toBe(0o600);
  expect(await authenticateCredential(directory,token)).toMatchObject({id:'hub',credential:{status:'active',scopes:['read','control']}});
  for(const malformed of ['short',`${token.slice(0,42)}=`,`${token}A`,`${token.slice(0,42)}\n`])
   await expect(registerCredential(directory,'other',malformed,['read'])).rejects.toThrow('MCP credential configuration');
  await expect(registerCredential(directory,'hub','J'.repeat(43),['read'])).rejects.toThrow('MCP credential configuration');
  await expect(registerCredential(directory,'other',token,['read'])).rejects.toThrow('MCP credential configuration');
  expect(JSON.parse(await readFile(path,'utf8')).principals).toHaveLength(1);
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
