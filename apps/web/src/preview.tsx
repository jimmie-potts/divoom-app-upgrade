import {useEffect,useState} from 'react';
import type {Rendition} from './api';
export function Preview({rendition,active=true}:{rendition:Rendition;active?:boolean}){
 const [frame,setFrame]=useState(0),[animate,setAnimate]=useState(false),[failed,setFailed]=useState(false);
 useEffect(()=>{setFrame(0);setFailed(false);},[rendition.id]);
 useEffect(()=>{
  if(!active||!animate||rendition.frames.length<2)return;
  const timer=window.setTimeout(()=>setFrame(n=>(n+1)%rendition.frames.length),rendition.frames[frame]?.delayMs??100);
  return ()=>window.clearTimeout(timer);
 },[frame,animate,rendition,active]);
 return <div className="preview">
  <img width="192" height="192" alt="Effective preview" src={`/api/renditions/${rendition.id}/frames/${Math.min(frame,rendition.frames.length-1)}.png`} onError={()=>setFailed(true)}/>
  {failed&&<p role="alert">Preview could not load. Reopen this media to retry.</p>}
  <p>64 × 64 · {rendition.frames.length} frame{rendition.frames.length===1?'':'s'}</p>
  {rendition.frames.length>1&&<><button type="button" onClick={()=>setAnimate(v=>!v)}>{animate?'Pause preview':'Animate preview'}</button><p>Effective loop: {rendition.effectiveDurationMs} ms. Preview timing is illustrative.</p></>}
  {rendition.warnings.map((w,i)=><p key={i}>Frame {w.frame+1}: {w.code}, normalized to {w.effectiveDelayMs} ms.</p>)}
 </div>;
}
