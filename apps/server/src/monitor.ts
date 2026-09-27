import {join} from 'node:path';
import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {Events} from './events.js';
import {ApiError,rejectedMonitorRequests} from './security.js';
import {authenticateCredential,validateMcpConfiguration} from './mcp-config.js';
import {loadMonitorConfig,createSessionSource,monitorCommand,type SessionSource} from './monitor-source.js';
import {MonitorPresentation,defaultPresentation,defaultNowPlaying} from './monitor-presentation.js';
import {loadPlaybackConfig,PlaybackReader} from './now-playing-source.js';
import {nowPlayingRequest,nowPlayingSetting,presentationConfiguration,sharedMonitorAction,type NowPlayingState} from '@pixoo/core';
import {readMonitorJson,writeMonitorJson} from './monitor-source.js';
import type {ControlService} from './control-service.js';
import {parse} from './validation.js';
const prefix='/api/monitor/v1';
export async function registerMonitor(app:FastifyInstance,dataDir:string,service:ControlService,cadenceMs=1000):Promise<()=>Promise<void>>{
 const directory=join(dataDir,'agent-monitor');
 await validateMcpConfiguration(directory);
 const config=await loadMonitorConfig(directory);
 const settingsPath=join(directory,'presentation.json');
 let configuration=defaultPresentation;
 try{configuration=presentationConfiguration.parse(await readMonitorJson(settingsPath));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw new Error('Invalid monitor presentation configuration',{cause:error});}
 const nowPlayingPath=join(directory,'now-playing.json');
 let nowPlaying=defaultNowPlaying;
 try{nowPlaying=nowPlayingSetting.parse(await readMonitorJson(nowPlayingPath));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw new Error('Invalid now-playing setting',{cause:error});}
 // Opt-in: without playback.json nothing reads the hub's playback snapshot.
 const playbackConfig=await loadPlaybackConfig(directory);
 const dashboard=new MonitorPresentation(service.player,{configuration,renderCadenceMs:cadenceMs,save:value=>writeMonitorJson(settingsPath,value),nowPlaying,saveNowPlaying:value=>writeMonitorJson(nowPlayingPath,value)});
 service.monitor=dashboard;
 const playback=playbackConfig?new PlaybackReader(playbackConfig):undefined;
 const readPlayback=async()=>{if(!playback)return;await playback.refresh();dashboard.submitPlayback(playback.status());};
 const nowPlayingState=():NowPlayingState=>({configured:playback!==undefined,...dashboard.nowPlayingStatus()});
 const source:SessionSource=await createSessionSource(directory,config).catch(async error=>{playback?.close();await dashboard.close();throw error;});
 let timer:ReturnType<typeof setInterval>|undefined,renderTimer:ReturnType<typeof setInterval>|undefined,playbackTimer:ReturnType<typeof setInterval>|undefined,events:Events|undefined,presentationEvents:Events|undefined,closed=false;
 const close=async()=>{if(closed)return;closed=true;clearInterval(timer);clearInterval(renderTimer);clearInterval(playbackTimer);playback?.close();await dashboard.close();events?.close();presentationEvents?.close();await source.close();};
 try{
  await source.refresh();dashboard.submit(source.view());
  events=new Events(()=>{const view=source.view();return {apiVersion:view.apiVersion,ownerId:view.ownerId,connection:view.connection,admissionRejected:view.admissionRejected+rejectedMonitorRequests(app),revision:view.snapshot?.revision??null,lossCount:view.snapshot?.lossCount??null,collector:view.snapshot?.collector??null,uncertain:view.snapshot?.sessions.filter(session=>session.freshness==='uncertain').length??null};});
  const delivery=events;
  let notificationPending=false;
  // Snapshot delivery is independent of producer response completion. Coalesce
  // one event-loop burst; clients fetch current state, not replayed effects.
  const publish=()=>{dashboard.submit(source.view());if(notificationPending)return;notificationPending=true;setImmediate(()=>{notificationPending=false;if(!closed)delivery.publish();});};
  await app.register(async monitor=>{
   monitor.addHook('onRequest',async request=>{
    const auth=request.headers.authorization;
    const principal=await authenticateCredential(directory,typeof auth==='string'&&auth.startsWith('Bearer ')?auth.slice(7):'');
    if(!principal)throw new ApiError('unauthorized',401);
    if(!['GET','HEAD'].includes(request.method)&&!principal.credential.scopes.includes('control'))throw new ApiError('forbidden',403);
   });
   monitor.get(`${prefix}/sessions`,async request=>{
    const filter=z.object({q:z.string().max(120).optional(),provider:z.enum(['codex','claude']).optional(),snapshotVersion:z.enum(['1.0','1.1','1.2']).default('1.0')}).strict().safeParse(request.query);
    if(!filter.success)throw new ApiError('invalid-input');
    await source.refresh();const view=source.view(filter.data.snapshotVersion);view.admissionRejected+=rejectedMonitorRequests(app);
    const matches=view.snapshot?.sessions.filter(session=>(!filter.data.provider||session.identity.provider===filter.data.provider)&&(!filter.data.q||[session.label,session.title?.value,session.project,session.identity.sessionId].some(value=>value?.toLowerCase().includes(filter.data.q!.toLowerCase())))).map(session=>session.identity)??[];
    return {...view,matches};
   });
   monitor.get(`${prefix}/rendition`,async(request,reply)=>{
    if(Object.keys(request.query as object).length)throw new ApiError('invalid-input');
    await source.refresh();dashboard.submit(source.view());
    reply.header('cache-control','no-store');return dashboard.rendition();
   });
   monitor.post(`${prefix}/events`,{bodyLimit:2048},async request=>{const result=await source.ingest(request.body);publish();return result;});
   monitor.post(`${prefix}/commands`,async request=>{
    const checked=monitorCommand.safeParse(request.body);if(!checked.success)throw new ApiError('invalid-input');
    const result=await source.command(checked.data);await source.refresh();publish();return result;
   });
   delivery.register(monitor,`${prefix}/changes`);
  });
  const browserPrefix='/api/integration/v1';
  presentationEvents=new Events(service.integrationSnapshot);
  const uiEvents=presentationEvents;dashboard.onChange=()=>uiEvents.publish();
  app.get(`${browserPrefix}/snapshot`,service.integrationSnapshot);
  app.post(`${browserPrefix}/commands`,request=>service.integration(request.body).finally(()=>uiEvents.publish()));
  app.get(`${browserPrefix}/view`,async()=>{await Promise.all([source.refresh(),readPlayback()]);publish();return {integration:service.integrationSnapshot(),source:source.view(),dashboard:dashboard.rendition(),nowPlaying:nowPlayingState()};});
  app.post(`${browserPrefix}/now-playing`,async request=>{const body=parse(nowPlayingRequest,request.body);await dashboard.setNowPlaying(body.media);uiEvents.publish();return nowPlayingState();});
  app.get(`${browserPrefix}/sessions`,async()=>{await source.refresh();publish();return source.view();});
  app.get(`${browserPrefix}/rendition`,async()=>{await source.refresh();publish();return dashboard.rendition();});
  app.post(`${browserPrefix}/shared-actions`,async request=>{
   const body=parse(sharedMonitorAction,request.body);
   const result=await source.command(body.operation==='acknowledge'?{...body,consumerId:'pixoo'}:body);await source.refresh();publish();return result;
  });
  uiEvents.register(app,`${browserPrefix}/changes`);
  renderTimer=setInterval(()=>dashboard.tick(),100);renderTimer.unref();
  if(playback){playbackTimer=setInterval(()=>{void readPlayback().then(()=>{if(!closed)uiEvents.publish();}).catch(()=>{});},2000);playbackTimer.unref();}
  timer=setInterval(()=>{void source.refresh().then(()=>{if(!closed)publish();}).catch(()=>{});},1000);timer.unref();
  // Owner decision on #77: device startup restores a saved Monitor selection.
  // Simulator startup stays passive.
  if(service.mode==='device')await dashboard.restore();
  app.addHook('preClose',close);return close;
 }catch(error){await close();throw error;}
}
