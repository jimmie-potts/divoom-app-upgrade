import type {Identity, SessionSnapshot} from '@jimmie-potts/agent-state';
import type {MonitorView} from './monitor-source.js';

export type DashboardFilter = {q?:string; provider?:'codex'|'claude'};
export type DashboardRow = {
 identity:Identity; label:string; shortLabel:string; activity:SessionSnapshot['activity'];
 attention:'approval'|'input'|'question'|'none'; uncertain:boolean;
 activeChildren:number; childrenUncertain:boolean; noticeIds:string[];
 observedAtMs:number; lastEvidenceAtMs:number; freshness:SessionSnapshot['freshness']; unavailable:SessionSnapshot['unavailable'];
};
export type DashboardLayout = {
 version:1; ownerId:string; revision:number|null; asOfMs:number|null;
 connection:MonitorView['connection']; collector:NonNullable<MonitorView['snapshot']>['collector']|'unknown';
 total:number; matched:number; attentionTotal:number; page:number; pages:number;
 rows:DashboardRow[];
};
const key=(identity:Identity)=>JSON.stringify([identity.provider,identity.client,identity.hostId,identity.sourceId,identity.sessionId]);
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
export function shortLabel(label:string):string {
 const chars=Array.from(label).map(char=>/^[a-z]$/.test(char)?char.toUpperCase():char).map(char=>/^[A-Z0-9 ._+!?/-]$/.test(char)?char:'?');
 return chars.length>6?chars.slice(0,5).join('')+'+':chars.join('');
}
function attention(session:SessionSnapshot):DashboardRow['attention'] {
 for(const kind of ['approval','input','question'] as const)if(session.attention.some(item=>item.kind===kind))return kind;
 return 'none';
}
function notices(session:SessionSnapshot,consumer:string):string[]{return session.notices.filter(n=>!n.acknowledgedBy.includes(consumer)).map(n=>n.id);}
function rank(session:SessionSnapshot,consumer:string):number {
 const kind=attention(session);return kind==='approval'||kind==='input'?0:kind==='question'?1:notices(session,consumer).length?2:3;
}
export class DashboardPager {
 private page=0;
 private membership='';
 private deadline=0;
 private lastNow=0;
 constructor(private readonly consumer='pixoo'){}
 layout(view:MonitorView,nowMs:number,filter:DashboardFilter={}):DashboardLayout {
  if(!Number.isFinite(nowMs)||nowMs<0)throw new Error('invalid-dashboard-clock');
  const now=Math.max(this.lastNow,nowMs);this.lastNow=now;
  const all=view.snapshot?.sessions??[];
  const top=all.filter(s=>s.parent.status!=='known'||s.unavailable.some(u=>u.dimension==='parent'&&u.reason==='ambiguous'));
  const ordered=top.filter(s=>(!filter.provider||s.identity.provider===filter.provider)&&(!filter.q||(s.label??s.identity.sessionId).toLowerCase().includes(filter.q.toLowerCase())))
   .sort((a,b)=>rank(a,this.consumer)-rank(b,this.consumer)||compare(key(a.identity),key(b.identity)));
  const pages=Math.max(1,Math.ceil(ordered.length/4));
  const membership=JSON.stringify([view.ownerId,filter.q??'',filter.provider??'',ordered.map(s=>key(s.identity))]);
  if(membership!==this.membership){this.membership=membership;this.page=Math.min(this.page,pages-1);this.deadline=now+10000;}
  else if(now>=this.deadline){const steps=Math.floor((now-this.deadline)/10000)+1;this.page=(this.page+steps)%pages;this.deadline+=steps*10000;}
  const unknownChildren=all.some(s=>s.parent.status==='unknown'||s.unavailable.some(u=>u.dimension==='parent'));
  return {version:1,ownerId:view.ownerId,revision:view.snapshot?.revision??null,asOfMs:view.snapshot?.asOfMs??null,connection:view.connection,collector:view.snapshot?.collector??'unknown',
   total:top.length,matched:ordered.length,attentionTotal:top.filter(s=>attention(s)!=='none').length,page:this.page,pages,
   rows:ordered.slice(this.page*4,this.page*4+4).map(s=>({identity:{...s.identity},label:s.label??s.identity.sessionId,shortLabel:shortLabel(s.label??s.identity.sessionId),activity:s.activity,attention:attention(s),
    uncertain:view.connection!=='current'||s.freshness==='uncertain'||s.unavailable.length>0||s.activity==='unknown'||s.parent.status==='unknown'||s.ordering.status==='unknown',
    activeChildren:s.children.active,childrenUncertain:unknownChildren||s.children.uncertain>0||view.connection!=='current',noticeIds:notices(s,this.consumer),observedAtMs:s.observedAtMs,lastEvidenceAtMs:s.lastEvidenceAtMs,freshness:s.freshness,unavailable:structuredClone(s.unavailable)}))};
 }
}
