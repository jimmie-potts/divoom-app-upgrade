import {expect,it} from 'vitest';
import type {SessionSnapshot} from '@jimmie-potts/agent-state';
import type {MonitorView} from '../../apps/server/src/monitor-source.js';
import {DashboardPager} from '../../apps/server/src/agent-dashboard.js';

export function session(id:string,patch:Partial<SessionSnapshot>={}):SessionSnapshot {
 return {identity:{provider:'codex',client:'cli',hostId:'h',sourceId:'s',sessionId:id},turn:{status:'unknown'},parent:{status:'top-level'},activity:'active',attention:[],notices:[],read:'unknown',unavailable:[],ordering:{status:'unknown'},lastEvidenceAtMs:1000,observedAtMs:1000,observationAgeMs:0,freshness:'current',restartUncertain:false,children:{active:0,uncertain:0},...patch};
}
export function view(sessions:SessionSnapshot[]):MonitorView {
 return {apiVersion:'1.0',ownerId:'owner',connection:'current',admissionRejected:0,nextRequestId:null,snapshot:{apiVersion:'1.0',revision:1,asOfMs:1000,collector:'running',lossCount:0,sessions}};
}
it('prioritizes blocking attention before continuing questions, keeps stable rows and excludes known children',()=>{
 const attention=(kind:'input'|'question')=>[{kind,id:{status:'unknown'} as const,turn:{status:'unknown'} as const}];
 const sessions=[session('z'),session('b',{attention:attention('question')}),session('c',{attention:attention('input')}),session('a'),session('child',{parent:{status:'known',identity:session('a').identity}})];
 const pager=new DashboardPager();
 const layout=pager.layout(view(sessions),0);
 expect(layout.rows.map(row=>row.identity.sessionId)).toEqual(['c','b','a','z']);
 expect(layout.rows[1]).toMatchObject({activity:'active',attention:'question'});
 expect(layout.attentionTotal).toBe(2);
 expect(pager.layout(view(sessions.reverse()),1).rows).toEqual(layout.rows);
});

it('rotates at ten seconds, skips elapsed intervals and clamps when filters or sessions change',()=>{
 const pager=new DashboardPager(),state=view(Array.from({length:9},(_,i)=>session(String(i))));
 expect(pager.layout(state,0).page).toBe(0);
 expect(pager.layout(state,9999).page).toBe(0);
 expect(pager.layout(state,10000).rows[0]?.identity.sessionId).toBe('4');
 expect(pager.layout(state,20000).rows).toHaveLength(1);
 expect(pager.layout(state,40000).page).toBe(1);
 expect(pager.layout(state,41000,{q:'0'})).toMatchObject({page:0,pages:1,matched:1,total:9});
 expect(pager.layout(view([]),42000)).toMatchObject({page:0,pages:1,rows:[]});
});
it('keeps notices consumer-specific, full labels and timestamps, and health dimensions separate',()=>{
 const state=view([session('a',{label:'résumé-long',notices:[{id:'n',kind:'turn-ended',turn:{status:'unknown'},acknowledgedBy:['other']}],children:{active:2,uncertain:1}})]);
 state.connection='stale';const layout=new DashboardPager().layout(state,0);
 expect(layout).toMatchObject({connection:'stale',collector:'running'});
 expect(layout.rows[0]).toMatchObject({label:'résumé-long',shortLabel:'R?SUM+',noticeIds:['n'],activeChildren:2,childrenUncertain:true,uncertain:true,observedAtMs:1000});
 state.snapshot!.sessions[0]!.notices[0]!.acknowledgedBy.push('pixoo');
 expect(new DashboardPager().layout(state,0).rows[0]?.noticeIds).toEqual([]);
});
it('renders exact RGB pixels and different state shapes, independently of caller mutation',async()=>{
 const {renderDashboard}=await import('../../apps/server/src/dashboard-pixels.js');
 const layout=new DashboardPager().layout(view([session('a')]),0);
 const rgb=renderDashboard(layout);
 expect(rgb).toHaveLength(12288);
 expect(rgb).toEqual(renderDashboard(layout));
 rgb.fill(0);expect(renderDashboard(layout).some(v=>v!==0)).toBe(true);
 const shapes=new Set<string>();
 for(const activity of ['unknown','active','idle','interrupted','ended'] as const){
  layout.rows[0]!.activity=activity;
  const frame=renderDashboard(layout),bits=[];
  for(let y=14;y<19;y++)for(let x=4;x<7;x++)bits.push(frame[(y*64+x)*3]!==0);
  shapes.add(JSON.stringify(bits));
 }
 expect(shapes.size).toBe(5);
});
it('matches the synthetic RGB fixture hashes and retains attention total on overflow',async()=>{
 const {createHash}=await import('node:crypto');
 const {syntheticDashboardRenditions}=await import('../../apps/server/src/dashboard-examples.js');
 const cases=syntheticDashboardRenditions();
 expect(cases.map(c=>createHash('sha256').update(new Uint8Array(c.rendition.rgb)).digest('hex'))).toEqual([
  'b8839439245323c57262fdddb2c9ecea1f883495a86f69a8c502fd51029b0047',
  '900bf69b32e7305224e6729dc5ca8eb76e8526fa31aaa810780e47801591ef1d',
  '5c5556a05f1d8d95901a75565991093dfc2364d447e8400de82c0b84758827af',
  'e9525a027c180a9cd5897fe2a16984972d902dd7a4e42aec73b7899cc222ced4'
 ]);
 expect(cases[0]!.rendition.layout.attentionTotal).toBe(2);
 expect(cases[1]!.rendition.layout.attentionTotal).toBe(2);
});
