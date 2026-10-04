import {z} from 'zod';
import {basename,dirname,isAbsolute,join,sep} from 'node:path';
import {lstat} from 'node:fs/promises';
import {runtimeAssert,runtimeOwned,runtimeJson,runtimeExists} from './runtime-files.js';
import {readRuntimeFile,runtimeFileHash,runtimeHash,canonicalRuntime} from './runtime-release.js';
import {privatePath} from './config.js';
import {authenticateCredential} from './mcp-config.js';

const path=z.string().min(1).refine(value=>isAbsolute(value)&&!/[\0\r\n\\"'`$%]/.test(value));
export const runtimeConfigSchema=z.object({schemaVersion:z.literal(1),owner:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.@-]{0,127}$/),
 runtimeRoot:path,sourceRoot:path,unitFile:path,environmentFile:path,dataDirectory:path,node:path,npm:path,
 evidenceRoot:path,controllerTokenFile:path.nullable(),controllerRegistration:z.object({file:path,id:z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)}).strict().nullable(),
 inactiveStartReason:z.string().min(1).max(500).nullable(),transitionReserveSeconds:z.number().int().min(600).max(3600)}).strict().refine(value=>!(value.controllerTokenFile&&value.controllerRegistration));
export type InstallConfig=z.infer<typeof runtimeConfigSchema>;
export async function readInstallConfig(file:string):Promise<InstallConfig>{
 await runtimeOwned(file,false,true);const config=runtimeConfigSchema.parse(await runtimeJson(file));
 runtimeAssert(basename(config.unitFile)==='pixoo-playlist-controller.service','unsupported-runtime-unit');
 for(const field of ['runtimeRoot','sourceRoot','dataDirectory','evidenceRoot'] as const)await runtimeOwned(config[field],true,field!=='sourceRoot');
 await runtimeOwned(dirname(config.unitFile),true);await runtimeOwned(config.unitFile);await runtimeOwned(config.environmentFile,false,true);
 await runtimeOwned(config.node);await runtimeOwned(config.npm);if(config.controllerTokenFile)await runtimeOwned(config.controllerTokenFile,false,true);
 if(config.controllerRegistration)await runtimeOwned(config.controllerRegistration.file,false,true);
 runtimeAssert((await lstat(config.node)).mode&0o111,'runtime-node-not-executable');
 for(const left of ['runtimeRoot','dataDirectory','sourceRoot','evidenceRoot'] as const){
  for(const right of ['runtimeRoot','dataDirectory','sourceRoot','evidenceRoot'] as const){
   if(left!==right)runtimeAssert(config[left]!==config[right]&&!config[left].startsWith(config[right]+sep),'overlapping-runtime-roots');
  }
 }
 runtimeAssert(!config.node.startsWith(config.runtimeRoot+sep)&&!config.npm.startsWith(config.runtimeRoot+sep),'external-node-required');
 runtimeAssert(!config.runtimeRoot.startsWith('/mnt/')&&!config.dataDirectory.startsWith('/mnt/'),'linux-local-runtime-required');
 await privatePath(config.runtimeRoot);await privatePath(config.dataDirectory);
 return config;
}

const KEYS=new Set(['PIXOO_DATA_DIR','PIXOO_PORT','PIXOO_MODE','PIXOO_MONITOR_ENABLED','PIXOO_MCP_ENABLED','PIXOO_CONTROLLER_ENABLED',
 'PIXOO_CONTROLLER_DEVICE_ID','PIXOO_CONTROLLER_ID','PIXOO_CONTROLLER_SOURCE_ID','PIXOO_OBSERVABILITY_ENABLED',
 'PIXOO_OBSERVABILITY_TRACING','PIXOO_OBSERVABILITY_SAMPLE_RATIO','PIXOO_OBSERVABILITY_COLLECTOR','BUNNY_OBSERVABILITY_BASE_URL','BUNNY_OBSERVABILITY_TOKEN','BUNNY_SERVICE_INSTANCE_ID','NODE_USE_ENV_PROXY','HTTP_PROXY','HTTPS_PROXY','NO_PROXY',
 'http_proxy','https_proxy','no_proxy','NODE_OPTIONS']);
export async function runtimeEnvironment(config:InstallConfig):Promise<Record<string,string>>{
 const result:Record<string,string>={};const source=(await readRuntimeFile(config.environmentFile,16384)).toString();
 for(const raw of source.split('\n')){
  const line=raw.trim();if(!line||line.startsWith('#'))continue;
  const match=/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);runtimeAssert(match,'unsupported-runtime-environment');
  const key=match[1]!,rawValue=match[2]!;let value=rawValue;
  if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
  runtimeAssert(KEYS.has(key)&&result[key]===undefined&&!/[\\\r\n\0]/.test(value),'unsupported-runtime-environment');result[key]=value;
 }
 runtimeAssert(result.PIXOO_DATA_DIR===config.dataDirectory&&/^\d+$/.test(result.PIXOO_PORT??'8787')&&Number(result.PIXOO_PORT??8787)>0&&Number(result.PIXOO_PORT??8787)<65536,'runtime-environment-target-mismatch');
 runtimeAssert(['simulator','device'].includes(result.PIXOO_MODE??'simulator'),'unsupported-runtime-mode');
 runtimeAssert(result.NODE_OPTIONS===undefined||result.NODE_OPTIONS==='--use-env-proxy','unsupported-node-options');
 return result;
}
export const ROOT_CONFIG=['device.json','hosted-gif.json','mcp-credentials.json','monitor-operator-token'];
export const MONITOR_CONFIG=['config.json','mcp-credentials.json','playback.json','import.json','quiesced.json'];
export async function runtimeControllerToken(config:InstallConfig,environment:Record<string,string>):Promise<string>{
 let token:unknown;
 if(config.controllerTokenFile)token=(await readRuntimeFile(config.controllerTokenFile,128)).toString().trim();
 else if(config.controllerRegistration){
  const source=await runtimeJson(config.controllerRegistration.file) as {controllers?:unknown};runtimeAssert(Array.isArray(source.controllers),'invalid-controller-registration');
  const matches=source.controllers.filter(item=>item&&typeof item==='object'&&item.id===config.controllerRegistration!.id) as Record<string,unknown>[];
  runtimeAssert(matches.length===1,'invalid-controller-registration');const value=matches[0]!;
  runtimeAssert(value.kind==='pixoo'&&value.controllerId===(environment.PIXOO_CONTROLLER_ID??'pixoo-controller')&&value.deviceId===(environment.PIXOO_CONTROLLER_DEVICE_ID??'pixoo-local')&&value.endpoint==='http://127.0.0.1:'+(environment.PIXOO_PORT??'8787')+'/controller/v1','controller-registration-target-mismatch');token=value.token;
 }
 runtimeAssert(typeof token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(token),'controller-read-token-required');
 const principal=await authenticateCredential(config.dataDirectory,token);runtimeAssert(principal?.credential.scopes.includes('read'),'controller-read-credential-unqualified');return token;
}
export async function runtimeConfigurationFacts(config:InstallConfig):Promise<Record<string,string>>{
 const result:Record<string,string>={configuration:runtimeHash(canonicalRuntime(config)),environment:await runtimeFileHash(config.environmentFile),node:await runtimeFileHash(config.node)};
 if(config.controllerTokenFile)result.controllerToken=await runtimeFileHash(config.controllerTokenFile);
 if(config.controllerRegistration)result.controllerRegistration=await runtimeFileHash(config.controllerRegistration.file);
 for(const relative of [...ROOT_CONFIG,...MONITOR_CONFIG.map(name=>'agent-monitor/'+name)]){
  const file=join(config.dataDirectory,relative);if(await runtimeExists(file))result[relative]=await runtimeFileHash(file);
 }
 return result;
}
