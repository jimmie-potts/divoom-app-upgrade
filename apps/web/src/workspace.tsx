import {useState} from 'react';
import type {Health} from '@pixoo/core';
import type {Asset,Rendition,Playlist} from './api';
import {MediaLibrary} from './library';
import {PlaylistEditor} from './playlists';
import type {Controller} from './controller';
import {PlayerPanel} from './player';
import {MonitorPanel} from './monitor';
import {Settings} from './settings';
export function Workspace({mode,controller}:{mode:Health['mode'];controller:Controller}){
 const [selected,setSelected]=useState<Playlist|null>(null);
 const [tab,setTab]=useState('Library'),[chosen,setChosen]=useState<{asset:Asset;rendition:Rendition}|null>(null);
 return <div className="workspace"><div className="player-summary"><div><p><strong>{controller.sample?.value.session?.playlist.name??'Ready for a playlist'}</strong></p><p className="muted">{controller.sample?.value.player.state??'Loading player…'} · {mode==='device'?'Physical adapter selected':'Simulator only'}</p></div><p>{controller.connected?'Live state connected':'Live state disconnected. Reconnecting…'}</p></div>
 {controller.error&&<p role="alert">{controller.error}</p>}{controller.pending&&!controller.busy&&<div className="notice"><p>Command outcome uncertain. Retry the original command or reconcile current state before choosing a new action.</p><div className="actions"><button disabled={controller.busy||!controller.connected} onClick={controller.retry}>Retry command</button><button disabled={controller.busy} onClick={controller.reconcile}>Reconcile and discard</button></div></div>}
 <nav aria-label="Controller views">{['Library','Playlists','Player','Monitor','Settings'].map(name=><button key={name} aria-current={tab===name?'page':undefined} onClick={()=>setTab(name)}>{name}</button>)}</nav>
 <div hidden={tab!=='Library'}><MediaLibrary active={tab==='Library'} onChoose={(asset,rendition)=>{setChosen({asset,rendition});setTab('Playlists');}}/></div>
 <div hidden={tab!=='Playlists'}><PlaylistEditor chosen={chosen} onBrowse={()=>setTab('Library')} onSaved={setSelected}/></div>
 <div hidden={tab!=='Monitor'}><MonitorPanel active={tab==='Monitor'}/></div>
 <div hidden={tab!=='Player'}><PlayerPanel mode={mode} active={tab==='Player'} controller={controller} selected={selected}/></div><div hidden={tab!=='Settings'}><Settings controller={controller}/></div></div>;
}
