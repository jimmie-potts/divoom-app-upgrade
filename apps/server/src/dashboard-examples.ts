import type {SessionSnapshot} from '@jimmie-potts/agent-state';
import type {MonitorView} from './monitor-source.js';
import {DashboardPager} from './agent-dashboard.js';
import {renderDashboard} from './dashboard-pixels.js';
import type {DashboardRendition} from './dashboard-service.js';
export function syntheticDashboardViews():Array<{name:string;view:MonitorView;atMs:number}>{
 const sessions:SessionSnapshot[]=Array.from({length:6},(_,i)=>({
  identity:{provider:i%2?'claude':'codex',client:i%2?'code':'cli',hostId:'synthetic',sourceId:'example',sessionId:`s${i}`},
  turn:{status:'known',id:'t1'},parent:{status:'top-level'},label:['Build','Review','Docs','résumé-long','Test','Ship'][i]!,
  activity:i===4?'unknown':'active',attention:i<2?[{kind:i===0?'approval':'question',id:{status:'known',id:'a'},turn:{status:'known',id:'t1'}}]:[],
  notices:i===2?[{id:'notice',kind:'turn-ended',turn:{status:'known',id:'t0'},acknowledgedBy:[]}]:[],
  read:'unknown',unavailable:[],ordering:{status:'known',epoch:'e',sequence:1},lastEvidenceAtMs:1000,observedAtMs:1000,observationAgeMs:0,freshness:'current',restartUncertain:false,children:{active:0,uncertain:0}
 }));
 const base:MonitorView={apiVersion:'1.0',ownerId:'synthetic',connection:'current',admissionRejected:0,nextRequestId:null,snapshot:{apiVersion:'1.0',revision:1,asOfMs:1000,collector:'running',lossCount:0,sessions}};
 const stale=structuredClone(base);stale.connection='stale';
 const empty=structuredClone(base);empty.snapshot!.sessions=[];
 return [{name:'Attention first',view:base,atMs:0},{name:'Overflow after ten seconds',view:base,atMs:10000},{name:'Stale source, running collector',view:stale,atMs:11000},{name:'Empty',view:empty,atMs:12000}];
}
export function syntheticDashboardRenditions():Array<{name:string;rendition:DashboardRendition}>{
 const pager=new DashboardPager();
 return syntheticDashboardViews().map(({name,view,atMs},index)=>{
  const layout=pager.layout(view,atMs);
  return {name,rendition:{version:1,generation:index,width:64,height:64,format:'rgb888',layout,rgb:Array.from(renderDashboard(layout))}};
 });
}
