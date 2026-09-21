import {useCallback,useEffect,useRef,useState} from 'react';
import type {IntegrationAction,MonitorFilter,SessionIdentity} from '@pixoo/core';
import {request,RequestError,explain} from './api';
import {checkIntegration,integrationCommand,MonitorCursor,matchesMonitor,type MonitorRead,type MonitorSession} from './monitor-client';
const prefix='/integration/v1';
type Pending={path:string;body:unknown};
function useMonitor(enabled:boolean){
 const [view,setView]=useState<MonitorRead|null>(null),[error,setError]=useState(''),[connected,setConnected]=useState(false),[disabled,setDisabled]=useState(false),[busy,setBusy]=useState(false),[pending,setPending]=useState<Pending|null>(null),[attempt,setAttempt]=useState(0);
 const serial=useRef(0),alive=useRef(false),ready=useRef(false),lock=useRef(false);
 const refresh=useCallback(async()=>{
  const version=++serial.current;
  try{
   const value=await request<MonitorRead>(prefix+'/view');checkIntegration(value.integration);
   if(!alive.current||version!==serial.current)return null;
   setView(value);setDisabled(false);return value;
  }catch(e){if(alive.current&&version===serial.current){setError(explain(e));if(e instanceof RequestError&&e.code==='not-found')setDisabled(true);}throw e;}
 },[]);
 useEffect(()=>{
  if(!enabled)return;alive.current=true;let stopped=false,source:EventSource|null=null,timer:number|undefined,failures=0;
  const cursor=new MonitorCursor();
  const disconnect=()=>{ready.current=false;setConnected(false);serial.current++;};
  function connect(){
   if(stopped)return;const current=new EventSource('/api'+prefix+'/changes');source=current;
   const resync=()=>{void refresh().then(value=>{if(!stopped&&current===source&&value){failures=0;ready.current=true;setConnected(true);}}).catch(()=>{disconnect();});};
   current.onopen=resync;
   const receive=(event:MessageEvent)=>{if(!stopped&&source===current&&cursor.accept(event.lastEventId))resync();};
   current.addEventListener('state',receive);current.addEventListener('resync',receive);
   current.onerror=()=>{if(stopped||source!==current)return;disconnect();current.close();if(failures<3){timer=window.setTimeout(connect,500*2**failures);failures++;}else setError('Monitor connection stopped after three retries. Reconnect to read current state.');};
  }
  connect();void refresh().catch(()=>{});
  const poll=window.setInterval(()=>{if(ready.current)void refresh().catch(()=>{disconnect();});},1000);
  return()=>{stopped=true;alive.current=false;ready.current=false;serial.current++;window.clearInterval(poll);if(timer)window.clearTimeout(timer);source?.close();};
 },[enabled,refresh,attempt]);
 async function execute(action:Pending){
  setPending(action);
  try{
   const result=await request<{ok?:boolean;code?:string}>(action.path,'POST',action.body);
   if(result?.ok===false)throw new RequestError(result.code??'monitor-unavailable');setPending(null);await refresh();
  }catch(e){if(e instanceof RequestError){setPending(null);await refresh().catch(()=>{});}setError(explain(e));}
 }
 async function guarded(action:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await action();}catch(e){setError(explain(e));}finally{lock.current=false;setBusy(false);}}
 const send=(action:Pending)=>{if(!ready.current||pending)return;void guarded(()=>execute(action));};
 return {view,error,connected,disabled,busy,pending,refresh,
  change:(action:IntegrationAction)=>{if(view&&ready.current&&!pending)void guarded(()=>execute({path:prefix+'/commands',body:integrationCommand(view.integration,action)}));},
  shared:(action:Record<string,unknown>)=>{if(view?.source.nextRequestId)send({path:prefix+'/shared-actions',body:{...action,requestId:view.source.nextRequestId}});},
  retry:()=>{if(pending&&ready.current)void guarded(()=>execute(pending));},
  reconcile:()=>void guarded(async()=>{if(await refresh())setPending(null);}),
  reconnect:()=>{setError('');setAttempt(x=>x+1);},
 };
}
function Pixels({rgb}:{rgb:number[]}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const context=ref.current?.getContext('2d');if(!context||rgb.length!==12288)return;const image=context.createImageData(64,64);for(let i=0;i<4096;i++){image.data[i*4]=rgb[i*3]!;image.data[i*4+1]=rgb[i*3+1]!;image.data[i*4+2]=rgb[i*3+2]!;image.data[i*4+3]=255;}context.putImageData(image,0,0);},[rgb]);
 return <canvas ref={ref} width={64} height={64} className="monitor-pixels" aria-label="Exact monitor preview"/>;
}
function SessionRow({session,disabled,shared}:{session:MonitorSession;disabled:boolean;shared:(action:Record<string,unknown>)=>void}){
 const [label,setLabel]=useState(session.label??'');useEffect(()=>setLabel(session.label??''),[session.label]);
 const id=session.identity.sessionId;
 return <article className="monitor-session"><h3>{session.label??id}</h3><p>{session.identity.provider} · {session.activity} · {session.freshness} · {session.projectId??'No project'}</p>
 <p>{session.attention.length?session.attention.map(a=>a.kind).join(', '):'No attention request'} · Active subagents: {session.children.active}{session.children.uncertain?' · Some child state uncertain':''}</p>
 <p className="muted">Session: {id} · {session.identity.client} · {session.identity.hostId} / {session.identity.sourceId}</p>
 <p className="muted">Observed: {new Date(session.observedAtMs).toISOString()} · Last evidence: {new Date(session.lastEvidenceAtMs).toISOString()} · Observation age: {Math.floor(session.observationAgeMs/1000)} s</p>
 <label>Chosen label<input aria-label={`Label for ${id}`} maxLength={160} value={label} onChange={e=>setLabel(e.target.value)}/></label>
 <button disabled={disabled} aria-label={`Save label for ${id}`} onClick={()=>shared({operation:'label',identity:session.identity,label:label||null})}>Save label</button>
 {session.notices.filter(n=>!n.acknowledgedBy.includes('pixoo')).map(n=><button key={n.id} disabled={disabled} aria-label={`Dismiss notice for ${id}`} onClick={()=>shared({operation:'acknowledge',identity:session.identity,noticeId:n.id})}>Dismiss turn-ended notice</button>)}
 </article>;
}
export function MonitorPanel({active}:{active:boolean}){
 const monitor=useMonitor(active),{view}=monitor;
 const [filter,setFilter]=useState<MonitorFilter>({}),[cadence,setCadence]=useState(1000);
 const configuration=view?.integration.configuration,filterKey=JSON.stringify(configuration?.filter??{});
 useEffect(()=>{setFilter(JSON.parse(filterKey) as MonitorFilter);if(configuration)setCadence(configuration.cadenceMs);},[filterKey,configuration?.cadenceMs]);
 if(monitor.disabled)return <section className="panel"><h2>Agent monitor</h2><p>Agent monitoring is not enabled for this backend.</p><button onClick={monitor.reconnect}>Reconnect monitor</button></section>;
 const blocked=!monitor.connected||monitor.busy||!!monitor.pending;
 const sessions=view?.source.snapshot?.sessions??[],selected=sessions.filter(s=>matchesMonitor(s,configuration?.filter??{}));
 const projects=[...new Set(sessions.flatMap(s=>s.projectId?[s.projectId]:[]))].sort();
 const update=(key:'q'|'provider'|'projectId',value:string)=>setFilter(current=>{const next={...current};if(value)Object.assign(next,{[key]:value});else delete next[key];return next;});
 return <section className="panel monitor-panel"><h2>Agent monitor</h2>
 <p>{monitor.connected?'Monitor state connected':'Monitor state disconnected'}</p>
 {monitor.error&&<p role="alert">{monitor.error}</p>}
 {!monitor.connected&&<button onClick={monitor.reconnect}>Reconnect monitor</button>}
 {monitor.pending&&<div className="notice"><p>The command outcome is uncertain. Retry the original request or reconcile current state.</p><button disabled={monitor.busy||!monitor.connected} onClick={monitor.retry}>Retry monitor command</button><button disabled={monitor.busy} onClick={monitor.reconcile}>Reconcile monitor</button></div>}
 {view&&<><p>Selected mode: {configuration?.mode==='monitor'?'Monitor':'Media'}</p>
 <p>{view.integration.participating?'Monitor presentation active':'Monitor presentation inactive'}</p>
 {view.integration.pendingMode&&<p>Pending mode: {view.integration.pendingMode}</p>}
 <div className="actions"><button disabled={blocked} onClick={()=>monitor.change({operation:'mode',mode:'monitor'})}>Show monitor</button><button disabled={blocked} onClick={()=>monitor.change({operation:'mode',mode:'media'})}>Select Media</button></div>
 <p className="muted">Monitor pauses media. Selecting Media leaves it paused until you start or resume. Screen-on and reconnect do not activate monitoring.</p>
 <p>Source: {view.source.connection} · Collector: {view.source.snapshot?.collector??'unknown'}</p>
 {view.integration.lastOutcome&&<p>Last monitor transport: {view.integration.lastOutcome.status}. This does not prove visible output.</p>}
 <fieldset disabled={blocked}><legend>Monitor view</legend>
 <label>Session search<input aria-label="Session search" maxLength={120} value={filter.q??''} onChange={e=>update('q',e.target.value)}/></label>
 <label>Provider<select aria-label="Provider filter" value={filter.provider??''} onChange={e=>update('provider',e.target.value)}><option value="">All providers</option><option value="codex">Codex</option><option value="claude">Claude</option></select></label>
 <label>Project<select aria-label="Project filter" value={filter.projectId??''} onChange={e=>update('projectId',e.target.value)}><option value="">All projects</option>{[...new Set([...projects,...(filter.projectId?[filter.projectId]:[])])].map(p=><option key={p}>{p}</option>)}</select></label>
 <label>Session<select aria-label="Session filter" value={filter.session?JSON.stringify(filter.session):''} onChange={e=>setFilter(current=>{const next={...current};if(e.target.value)next.session=JSON.parse(e.target.value) as SessionIdentity;else delete next.session;return next;})}><option value="">All sessions</option>{sessions.map(s=><option key={JSON.stringify(s.identity)} value={JSON.stringify(s.identity)}>{s.label??s.identity.sessionId} · {s.identity.provider} · {s.identity.hostId}</option>)}</select></label>
 <label>Minimum update interval (ms)<input aria-label="Monitor cadence" type="number" min={1000} max={10000} step={1000} value={cadence} onChange={e=>setCadence(Number(e.target.value))}/></label>
 <button onClick={()=>monitor.change({operation:'view',filter,cadenceMs:cadence})}>Apply monitor view</button></fieldset>
 <p>Filters apply to the preview and display. Labels are assigned only when you save them. Dismissing a notice affects this monitor only.</p>
 {view.dashboard.rendition?<div className="monitor-preview"><Pixels rgb={view.dashboard.rendition.rgb}/><p>{view.dashboard.rendition.layout.matched} matching top-level sessions · Page {view.dashboard.rendition.layout.page+1} of {view.dashboard.rendition.layout.pages} · Attention total {view.dashboard.rendition.layout.attentionTotal}</p></div>:<p>Updating exact preview…</p>}
 {!selected.length&&<p>No sessions match this view.</p>}
 <div className="monitor-sessions">{selected.map(s=><SessionRow key={JSON.stringify(s.identity)} session={s} disabled={blocked||!view.source.nextRequestId} shared={monitor.shared}/>)}</div>
 </>}
 </section>;
}
