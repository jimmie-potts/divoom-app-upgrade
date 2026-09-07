import {useCallback,useEffect,useRef,useState} from 'react';
import {healthSchema,type DeviceConfiguration,type PlayerCommand} from '@pixoo/core';
import {request,RequestError,explain,type PlayerState,type Playlist,type Rendition} from './api';
export interface Snapshot {serverId:string;sampledAtMs:number;nextRequestId:string;player:PlayerState;session:{id:string;playlist:Playlist;source?:{kind:'playlist'}|{kind:'media';assetId:string;renditionId:string}}|null}
export interface Device {mode:'simulator'|'device';connected:boolean|null;availability:'unknown'|'available'|'offline';configuration:DeviceConfiguration|null;activeConfiguration:DeviceConfiguration|null;restartRequired:boolean;activeProfile:Rendition['profile'];profiles:Rendition['profile'][]}
type Runtime={serverId:string;device:Device};
type Pending={path:string;method:string;body:Record<string,unknown>};
async function readSnapshot(){
 const value=await request<Snapshot>('/player');
 if(!value?.serverId||!value.player||!Number.isFinite(value.sampledAtMs))throw new Error('Invalid player snapshot');
 return value;
}
export function useController(enabled=true){
 const [sample,setSample]=useState<{value:Snapshot;received:number}|null>(null),[runtime,setRuntime]=useState<Runtime|null>(null),[connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState<Pending|null>(null);
 const lock=useRef(false),serial=useRef(0),alive=useRef(true),sourceRef=useRef<EventSource|null>(null),runtimeRef=useRef<Runtime|null>(null),ready=useRef(false);
 const refresh=useCallback(async(forceRuntime=false)=>{
  const version=++serial.current;
  const current=()=>alive.current&&version===serial.current;
  try{
   let value=await readSnapshot();
   if(!current())return null;
   if(forceRuntime||runtimeRef.current?.serverId!==value.serverId){
    ready.current=false;setConnected(false);
    const [healthResponse,device]=await Promise.all([request('/health'),request<Device>('/device')]);
    const health=healthSchema.parse(healthResponse);
    if(device.mode!==health.mode||!device.activeProfile?.name||!Array.isArray(device.profiles))throw new Error('Invalid runtime settings');
    const confirmed=await readSnapshot();
    if(!current())return null;
    if(confirmed.serverId!==value.serverId)throw new Error('Server changed while reading runtime settings');
    value=confirmed;
    const next={serverId:value.serverId,device};runtimeRef.current=next;setRuntime(next);
   }
   if(!current())return null;
   setSample({value,received:performance.now()});
   ready.current=sourceRef.current?.readyState===EventSource.OPEN;
   setConnected(ready.current);
   return value;
  }catch(e){
   if(current()){ready.current=false;setConnected(false);setError(explain(e));}
   throw e;
  }
 },[]);
 useEffect(()=>{
  if(!enabled)return;
  alive.current=true;let active=true,source:EventSource,reconnectTimer:number|undefined;let lastEpoch='',lastSequence=-1;
  const receive=(event:MessageEvent)=>{
   if(!active||event.currentTarget!==source)return;
   const match=/^(.+):(\d+)$/.exec(event.lastEventId);if(!match)return;
   const epoch=match[1]!,sequence=Number(match[2]);if(epoch===lastEpoch&&sequence<=lastSequence)return;
   lastEpoch=epoch;lastSequence=sequence;
   void refresh().catch(()=>{});
  };
  function connect(){
   const current=new EventSource('/api/events');source=current;sourceRef.current=current;
   current.addEventListener('state',receive);current.addEventListener('resync',receive);
   current.onopen=()=>{if(active&&source===current)void refresh().catch(()=>{});};
   current.onerror=()=>{
    if(!active||source!==current)return;
    serial.current++;ready.current=false;setConnected(false);
    // HTTP errors can close EventSource permanently instead of scheduling its native retry.
    if(current.readyState===EventSource.CLOSED&&reconnectTimer===undefined){
     current.close();runtimeRef.current=null;
     reconnectTimer=window.setTimeout(()=>{reconnectTimer=undefined;if(active)connect();},3000);
    }
   };
  }
  connect();void refresh().catch(()=>{});
  return()=>{active=false;alive.current=false;serial.current++;ready.current=false;sourceRef.current=null;if(reconnectTimer!==undefined)window.clearTimeout(reconnectTimer);source.close();};
 },[enabled,refresh]);
 async function execute(action:Pending){
  setPending(action);
  try{await request(action.path,action.method,action.body);setPending(null);await refresh();}
  catch(e){
   if(e instanceof RequestError){setPending(null);await refresh().catch(()=>{});}
   setError(explain(e));
  }
 }
 async function guarded(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await work();}catch(e){setError(explain(e));}finally{lock.current=false;setBusy(false);}}
 // Action reads do not compete with SSE reads for presentation ownership.
 async function actionSnapshot(serverId:string|undefined){
  const latest=await readSnapshot();
  if(latest.serverId!==serverId||runtimeRef.current?.serverId!==serverId){await refresh();return null;}
  return latest;
 }
 function currentAction(value:Snapshot|null,serverId:string|undefined):value is Snapshot{
  return !!value&&alive.current&&ready.current&&value.serverId===serverId&&runtimeRef.current?.serverId===serverId;
 }
 function command(command:PlayerCommand['command'],playlistId?:string){
  if(pending||!ready.current)return;
  const serverId=runtimeRef.current?.serverId;
  void guarded(async()=>{const latest=await actionSnapshot(serverId);if(!currentAction(latest,serverId))return;await execute({path:'/player/commands',method:'POST',body:{command,requestId:latest.nextRequestId,...(command==='start'?{playlistId}:{})}});});
 }
 function display(value:{brightness:number}|{screenOn:boolean}){
  if(pending||!ready.current)return;
  const serverId=runtimeRef.current?.serverId;
  void guarded(async()=>{const latest=await actionSnapshot(serverId);if(!currentAction(latest,serverId))return;await execute({path:'/device/display',method:'PATCH',body:{...value,requestId:latest.nextRequestId}});});
 }
 async function probe(){
  if(!ready.current||pending)return false;
  const serverId=runtimeRef.current?.serverId;
  const latest=await actionSnapshot(serverId);
  if(!currentAction(latest,serverId))return false;
  await request('/device/probe','POST',{});
  await refresh(true);
  return true;
 }
 return {sample,runtime,connected,busy,error,pending,command,display,probe,refresh,
  retry:()=>{if(pending&&ready.current)void guarded(()=>execute(pending));},
  reconcile:()=>void guarded(async()=>{if(await refresh())setPending(null);}),
 };
}
export type Controller=ReturnType<typeof useController>;
