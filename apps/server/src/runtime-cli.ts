import {parseArgs} from 'node:util';
import {readInstallConfig} from './runtime-config.js';
import {runtimeAssert,runtimeJson,runtimeOwned,runtimeWrite} from './runtime-files.js';
import {canonicalRuntime} from './runtime-release.js';
import {parseRuntimePlan,planRuntime} from './runtime-plan.js';
import {operateRuntime,RuntimeFinalizationFailure} from './runtime-upgrade.js';
import {statusRuntimePlan} from './runtime-status.js';
import {executeRuntimeRequest,runtimeRequestJson} from './runtime-adapter.js';

try{
 const args=parseArgs({allowPositionals:true,options:{config:{type:'string'},plan:{type:'string'},output:{type:'string'},rollback:{type:'boolean'}}});
 const [command,target,...extra]=args.positionals;runtimeAssert(args.values.config&&!extra.length,'runtime-command-usage');
 const config=await readInstallConfig(args.values.config),guard=async()=>{runtimeAssert(canonicalRuntime(config)===canonicalRuntime(await readInstallConfig(args.values.config!)),'trusted-configuration-changed');};
 if(command==='adapter'&&!target&&!args.values.plan&&!args.values.output&&!args.values.rollback){
  let bytes=Buffer.alloc(0);for await(const chunk of process.stdin){runtimeAssert(bytes.length+chunk.length<=65536,'installation-request-too-large');bytes=Buffer.concat([bytes,chunk]);}
  console.log(JSON.stringify(await executeRuntimeRequest(config,runtimeRequestJson(bytes.toString()),guard)));
 }else if(command==='plan'&&target&&!args.values.plan){
  const plan=await planRuntime(config,target,args.values.rollback?'rollback':'upgrade');await guard();
  if(args.values.output)await runtimeWrite(args.values.output,plan);console.log(JSON.stringify(plan,null,2));
 }else{
  runtimeAssert(args.values.plan&&!args.values.output&&!args.values.rollback,'exact-runtime-plan-required');await runtimeOwned(args.values.plan,false,true);
  const plan=parseRuntimePlan(await runtimeJson(args.values.plan),config);await guard();
  if(command==='status'&&!target){console.log(JSON.stringify(await statusRuntimePlan(config,plan),null,2));}
  else{runtimeAssert((command==='upgrade'||command==='rollback')&&plan.operation===command&&target===plan.requestedTarget,'native-plan-command-mismatch');
   const receipt=await operateRuntime(plan,guard);console.log(JSON.stringify(receipt,null,2));if(receipt.outcome!=='succeeded')process.exitCode=1;
  }
 }
}catch(error){
 const reason=error instanceof Error&&/^(runtime|unknown|unsupported|controller|unresolved|foreign|linked|unsafe|unselected|external|overlapping|linux|invalid|partial|durable|source|target|remote|full|clean|native|exact|plan|trusted)-[a-z0-9-]+$/.test(error.message)?error.message:'runtime-command-refused';
 console.log(JSON.stringify(error instanceof RuntimeFinalizationFailure?error.receipt:{schemaVersion:1,status:'uncertain',reason}));process.exitCode=1;
}
