import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runtimeEnvironment,runtimeControllerToken,type InstallConfig} from '../../apps/server/src/runtime-config.js';
import {registerCredential} from '../../apps/server/src/mcp-config.js';
it('binds the declared data root and refuses environment code loading or unknown variables',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pixoo-env-'));
 try{await mkdir(join(root,'data'));const environmentFile=join(root,'service.env');
  const config={environmentFile,dataDirectory:join(root,'data')} as InstallConfig;
  await writeFile(environmentFile,`PIXOO_DATA_DIR=${config.dataDirectory}\nPIXOO_MODE=device\n`);
  expect((await runtimeEnvironment(config)).PIXOO_MODE).toBe('device');
  await writeFile(environmentFile,`PIXOO_DATA_DIR=${config.dataDirectory}\nNODE_OPTIONS=--import=/foreign\n`);
  await expect(runtimeEnvironment(config)).rejects.toThrow('node-options');
  await writeFile(environmentFile,'PIXOO_DATA_DIR=/foreign');await expect(runtimeEnvironment(config)).rejects.toThrow('target-mismatch');
 }finally{await rm(root,{recursive:true,force:true});}
});
it('reuses only the matching existing controller registration and enabled read principal',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pixoo-controller-reference-'));
 try{
  const file=join(root,'host.json'),token='A'.repeat(43);await registerCredential(root,'fixture',token,['read']);
  const controller={id:'pixoo',kind:'pixoo',controllerId:'pixoo-controller',deviceId:'pixoo-local',endpoint:'http://127.0.0.1:8787/controller/v1',token};
  await writeFile(file,JSON.stringify({controllers:[controller]}),{mode:0o600});
  const config={dataDirectory:root,controllerTokenFile:null,controllerRegistration:{file,id:'pixoo'}} as InstallConfig;
  expect(await runtimeControllerToken(config,{})).toBe(token);
  await writeFile(file,JSON.stringify({controllers:[{...controller,endpoint:'http://127.0.0.1:9999/controller/v1'}]}));
  await expect(runtimeControllerToken(config,{})).rejects.toThrow('target-mismatch');
  await writeFile(file,JSON.stringify({controllers:[{...controller,token:'B'.repeat(43)}]}));await registerCredential(root,'control-only','B'.repeat(43),['control']);
  await expect(runtimeControllerToken(config,{})).rejects.toThrow('read-credential-unqualified');
 }finally{await rm(root,{recursive:true,force:true});}
});
