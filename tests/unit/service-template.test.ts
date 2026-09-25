import {afterEach,expect,it} from 'vitest';
import {mkdtemp,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadConfig} from '../../apps/server/src/config.js';
const examples=join(import.meta.dirname,'../../examples/systemd');
const temporary:string[]=[];
afterEach(async()=>{await Promise.all(temporary.splice(0).map(path=>rm(path,{recursive:true,force:true})));});
// Systemd EnvironmentFile syntax as the template uses it: KEY=value, # comments.
function environment(text:string){
 return Object.fromEntries(text.split('\n').map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')).map(line=>{const at=line.indexOf('=');return [line.slice(0,at),line.slice(at+1)];}));
}
function directives(text:string){
 const result=new Map<string,string>();
 for(const line of text.split('\n')){const match=/^([A-Za-z]+)=(.*)$/.exec(line.trim());if(match)result.set(match[1]!,match[2]!);}
 return result;
}
it('example service settings select device mode, monitoring and the controller identity',async()=>{
 const env=environment(await readFile(join(examples,'pixoo-playlist-controller.env'),'utf8'));
 expect(env.PIXOO_DATA_DIR).toMatch(/^\/home\/<user>\//);
 const base=await realpath(await mkdtemp(join(tmpdir(),'pixoo-service-')));temporary.push(base);
 const dataDir=join(base,'data'),root=join(base,'source');
 await loadConfig({PIXOO_DATA_DIR:dataDir},{root,home:base});
 await writeFile(join(dataDir,'device.json'),JSON.stringify({version:1,configuration:{ip:'192.168.50.20',profile:'pixoo64-smoke-2026-09-06'}}));
 const config=await loadConfig({...env,PIXOO_DATA_DIR:dataDir},{root,home:base});
 expect(config).toMatchObject({mode:'device',port:8787,monitorEnabled:true,controllerEnabled:true,
  controllerIdentity:{deviceId:'pixoo-local',controllerId:'pixoo-controller',sourceId:'pixoo'}});
});
it('service template restarts on failure and stops with SIGTERM after the transport deadline',async()=>{
 const unit=directives(await readFile(join(examples,'pixoo-playlist-controller.service'),'utf8'));
 expect(Object.fromEntries(['Type','EnvironmentFile','UMask','Restart','KillSignal','WantedBy'].map(key=>[key,unit.get(key)]))).toEqual({
  Type:'simple',EnvironmentFile:'%h/.config/pixoo-playlist-controller/service.env',UMask:'0077',Restart:'on-failure',KillSignal:'SIGTERM',WantedBy:'default.target'});
 expect(Number(unit.get('TimeoutStopSec'))).toBeGreaterThan(5);
 expect(Number(unit.get('StartLimitBurst'))).toBeGreaterThan(0);
 const entry=unit.get('ExecStart')!.split(' ')[1]!.replace('<absolute-installed-checkout>/','');
 expect(entry).toBe('apps/server/dist/main.js');
});
