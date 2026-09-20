import {join} from 'node:path';
import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {Events} from './events.js';
import {ApiError,rejectedMonitorRequests} from './security.js';
import {authenticateCredential,validateMcpConfiguration} from './mcp-config.js';
import {loadMonitorConfig,createSessionSource,monitorCommand,type SessionSource} from './monitor-source.js';
const prefix='/api/monitor/v1';
export async function registerMonitor(app:FastifyInstance,dataDir:string):Promise<()=>Promise<void>>{
 const directory=join(dataDir,'agent-monitor');
 await validateMcpConfiguration(directory);
 const config=await loadMonitorConfig(directory);
 const source:SessionSource=await createSessionSource(directory,config);
 let timer:ReturnType<typeof setInterval>|undefined,events:Events|undefined,closed=false;
 const close=async()=>{if(closed)return;closed=true;clearInterval(timer);events?.close();await source.close();};
 try{
  await source.refresh();
  events=new Events(()=>{const view=source.view();return {apiVersion:view.apiVersion,ownerId:view.ownerId,connection:view.connection,admissionRejected:view.admissionRejected+rejectedMonitorRequests(app),revision:view.snapshot?.revision??null,collector:view.snapshot?.collector??null,uncertain:view.snapshot?.sessions.filter(session=>session.freshness==='uncertain').length??null};});
  const delivery=events;
  await app.register(async monitor=>{
   monitor.addHook('onRequest',async request=>{
    const auth=request.headers.authorization;
    const principal=await authenticateCredential(directory,typeof auth==='string'&&auth.startsWith('Bearer ')?auth.slice(7):'');
    if(!principal)throw new ApiError('unauthorized',401);
    if(!['GET','HEAD'].includes(request.method)&&!principal.credential.scopes.includes('control'))throw new ApiError('forbidden',403);
   });
   monitor.get(`${prefix}/sessions`,async request=>{
    const filter=z.object({q:z.string().max(120).optional(),provider:z.enum(['codex','claude']).optional()}).strict().safeParse(request.query);
    if(!filter.success)throw new ApiError('invalid-input');
    await source.refresh();const view=source.view();view.admissionRejected+=rejectedMonitorRequests(app);
    if(view.snapshot&&(filter.data.q!==undefined||filter.data.provider!==undefined))view.snapshot={...view.snapshot,sessions:view.snapshot.sessions.filter(session=>(!filter.data.provider||session.identity.provider===filter.data.provider)&&(!filter.data.q||(session.label??session.identity.sessionId).toLowerCase().includes(filter.data.q.toLowerCase())))};
    return view;
   });
   monitor.post(`${prefix}/events`,{bodyLimit:2048},async request=>{const result=await source.ingest(request.body);delivery.publish();return result;});
   monitor.post(`${prefix}/commands`,async request=>{
    const checked=monitorCommand.safeParse(request.body);if(!checked.success)throw new ApiError('invalid-input');
    const result=await source.command(checked.data);await source.refresh();delivery.publish();return result;
   });
   delivery.register(monitor,`${prefix}/changes`);
  });
  timer=setInterval(()=>{void source.refresh().then(()=>{if(!closed)delivery.publish();}).catch(()=>{});},1000);timer.unref();
  app.addHook('preClose',close);return close;
 }catch(error){await close();throw error;}
}
