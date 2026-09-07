import {useEffect,useState} from 'react';
import type {Health} from '@pixoo/core';
import {request,type Playlist,type Rendition} from './api';
import type {Controller} from './controller';
import {Preview} from './preview';
export function PlayerPanel({controller,selected,active,mode}:{active:boolean;controller:Controller;selected:Playlist|null;mode:Health['mode']}){
 const {sample,busy,connected,pending,command}=controller;
 const [now,setNow]=useState(performance.now()),[rendition,setRendition]=useState<Rendition|null>(null);
 const state=sample?.value.player,session=sample?.value.session;
 const item=session?.playlist.items.find(item=>item.id===state?.itemId);
 useEffect(()=>{const timer=window.setInterval(()=>setNow(performance.now()),250);return()=>window.clearInterval(timer);},[]);
 useEffect(()=>{let active=true;setRendition(null);if(item)void request<Rendition>(`/renditions/${item.renditionId}`).then(r=>{if(active)setRendition(r);},()=>{});return()=>{active=false;};},[item?.renditionId]);
 const remaining=sample&&state?.state==='playing'&&state.dwellDeadlineMs!==null?Math.max(0,state.dwellDeadlineMs-sample.value.sampledAtMs-Math.max(0,now-sample.received)):null;
 const disabled=busy||!connected||!!pending;
 return <section aria-label="Player controls"><p className="eyebrow">Now playing</p><h2>Player</h2>
 <div className="editor-layout"><div className="panel"><h3>{session?.playlist.name??'Nothing playing'}</h3>
 {session?<><p>{session.source?.kind==='media'?'Temporary media session':`Session revision ${session.playlist.revision}${selected?.id===session.playlist.id?` · Saved revision ${selected.revision}`:''}`}</p><p>Item {session.playlist.items.findIndex(i=>i.id===state?.itemId)+1} of {session.playlist.items.length}</p></>:<p>No active session.</p>}
 {state&&<><p>Playback: <strong>{state.state}</strong> · Intent: {state.intent}</p><p>{mode==='device'?'Device transport':'Simulator adapter'}: {state.availability}</p><p>Requested screen: {state.requestedScreenOn?'on':'off'}</p>
 <p aria-live="off">{state.state==='loading'?'Loading frames; dwell has not started.':remaining!==null?`Estimated remaining: ${(remaining/1000).toFixed(1)} seconds`:'Estimated remaining: unavailable while not playing.'}</p>
 {state.lastError&&<p role="alert">Player error: {state.lastError.code}. {mode==='device'&&state.lastError.priorEffects==='possible'?'The device may have applied part of the operation. Playback is paused. Explicit resume restarts the current item from its beginning.':'Check the media, skip it, or explicitly resume to retry.'}</p>}</>}
 {selected&&session?.playlist.id===selected.id&&selected.revision!==session.playlist.revision&&<p className="notice">Saved changes are waiting for the next session. Restart with changes applies them now.</p>}
 <div className="actions"><button disabled={disabled||!selected?.items.length} onClick={()=>command('start',selected?.id)}>Play playlist</button><button disabled={disabled||!session} onClick={()=>command('pause')}>Pause playlist</button><button disabled={disabled||!session} onClick={()=>command('resume')}>Resume</button><button disabled={disabled} onClick={()=>command('stop')}>Stop</button></div>
 <div className="actions"><button className="quiet" disabled={disabled||!session} onClick={()=>command('previous')}>Previous</button><button className="quiet" disabled={disabled||!session} onClick={()=>command('next')}>Next</button><button className="quiet" disabled={disabled||!session||session.source?.kind==='media'} onClick={()=>command('restart-with-changes')}>Restart with changes</button><button className="quiet" disabled={disabled} onClick={()=>command('clear')}>Clear session</button></div>
 <p className="muted">Selected saved playlist: {selected?.name??'Choose one in Playlists'}. Play uses saved items.</p>
 </div><aside className="panel">{rendition?<Preview key={rendition.id} rendition={rendition} active={active}/>:<p className="empty">No active preview</p>}<p className="muted">Pause stops playlist advancement. Resume restarts the item from its beginning. Stop leaves the last content. Preview and timing are estimates, not physical telemetry.</p></aside></div></section>;
}
