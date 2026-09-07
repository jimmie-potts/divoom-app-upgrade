import {useCallback,useEffect,useRef,useState} from 'react';
import type {PlayerCommand} from '@pixoo/core';
import {request,RequestError,explain,type PlayerState,type Playlist} from './api';
export interface Snapshot {serverId:string;sampledAtMs:number;nextRequestId:string;player:PlayerState;session:{id:string;playlist:Playlist}|null}
type Pending={path:string;method:string;body:Record<string,unknown>};
export function useController(){
 const [sample,setSample]=useState<{value:Snapshot;received:number}|null>(null),[connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState<Pending|null>(null);
 const lock=useRef(false),serial=useRef(0),alive=useRef(true);
 const refresh=useCallback(async()=>{
  const version=++serial.current;
  const value=await request<Snapshot>('/player');
  if(!value?.serverId||!value.player||!Number.isFinite(value.sampledAtMs))throw new Error('Invalid player snapshot');
  if(alive.current&&version===serial.current)setSample({value,received:performance.now()});
  return value;
 },[]);
 useEffect(()=>{
  alive.current=true;const source=new EventSource('/api/events');let lastEpoch='',lastSequence=-1;
  const receive=(event:MessageEvent)=>{
   const match=/^(.+):(\d+)$/.exec(event.lastEventId);if(!match)return;
   const epoch=match[1]!,sequence=Number(match[2]);if(epoch===lastEpoch&&sequence<=lastSequence)return;
   lastEpoch=epoch;lastSequence=sequence;
   void refresh().then(()=>{if(alive.current)setConnected(source.readyState===EventSource.OPEN);},e=>{if(alive.current){setConnected(false);setError(explain(e));}});
  };
  source.addEventListener('state',receive);source.addEventListener('resync',receive);
  source.onopen=()=>{void refresh().then(()=>{if(alive.current)setConnected(source.readyState===EventSource.OPEN);},()=>{if(alive.current)setConnected(false);});};
  source.onerror=()=>{if(alive.current)setConnected(false);};
  void refresh().catch(e=>{if(alive.current)setError(explain(e));});
  return()=>{alive.current=false;serial.current++;source.close();};
 },[refresh]);
 async function execute(action:Pending){
  setPending(action);
  try{await request(action.path,action.method,action.body);setPending(null);await refresh();}
  catch(e){
   if(e instanceof RequestError){setPending(null);await refresh().catch(()=>setConnected(false));}
   setError(explain(e));
  }
 }
 async function guarded(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await work();}catch(e){setError(explain(e));}finally{lock.current=false;setBusy(false);}}
 function command(command:PlayerCommand['command'],playlistId?:string){
  if(pending||!connected)return;
  void guarded(async()=>{const latest=await refresh();await execute({path:'/player/commands',method:'POST',body:{command,requestId:latest.nextRequestId,...(command==='start'?{playlistId}:{})}});});
 }
 function display(value:{brightness:number}|{screenOn:boolean}){
  if(pending||!connected)return;
  void guarded(async()=>{const latest=await refresh();await execute({path:'/device/display',method:'PATCH',body:{...value,requestId:latest.nextRequestId}});});
 }
 return {sample,connected,busy,error,pending,command,display,
  retry:()=>{if(pending)void guarded(()=>execute(pending));},
  reconcile:()=>void guarded(async()=>{await refresh();setPending(null);}),
 };
}
export type Controller=ReturnType<typeof useController>;
