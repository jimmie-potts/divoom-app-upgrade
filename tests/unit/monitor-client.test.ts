import {expect,it} from 'vitest';
import type {IntegrationSnapshot} from '@pixoo/core';
import {checkIntegration,integrationCommand,MonitorCursor,matchesMonitor,type MonitorSession} from '../../apps/web/src/monitor-client.js';
const snapshot:IntegrationSnapshot={apiVersion:'pixoo-integration/1.0',serverId:'9c8a19f1-f2c2-42ac-bb0d-73fbb3366821',nextRequestId:'9c8a19f1-f2c2-42ac-bb0d-73fbb3366821:1',configurationRevision:4,generation:3,configuration:{version:1,mode:'media',filter:{projectId:'project'},cadenceMs:1000},capabilities:{modes:['monitor','media'],filters:['provider','projectId','session','q'],minimumCadenceMs:1000,maximumCadenceMs:10000},pendingMode:'monitor',participating:false,inFlight:0,lastOutcome:null,sourceRevision:1,sourceConnection:'current',renditionGeneration:1};
it('preserves current and pending mode and emits capability-checked guarded filter requests',()=>{
 expect(checkIntegration(snapshot)).toMatchObject({configuration:{mode:'media'},pendingMode:'monitor',participating:false});
 expect(integrationCommand(snapshot,{operation:'view',filter:{provider:'codex',projectId:'project'},cadenceMs:2000})).toMatchObject({requestId:snapshot.nextRequestId,expectedConfigurationRevision:4,expectedGeneration:3,action:{filter:{provider:'codex',projectId:'project'}}});
 expect(()=>integrationCommand({...snapshot,capabilities:{...snapshot.capabilities,modes:['media']}},{operation:'mode',mode:'monitor'})).toThrow('Unsupported');
 expect(()=>integrationCommand(snapshot,{operation:'view',filter:{},cadenceMs:1})).toThrow();
 expect(()=>checkIntegration({...snapshot,nextRequestId:'old:1'})).toThrow();
});
it('rejects duplicate, stale, malformed and retired-epoch SSE notifications',()=>{
 const cursor=new MonitorCursor();expect(cursor.accept('one:2')).toBe(true);expect(cursor.accept('one:1')).toBe(false);expect(cursor.accept('one:2')).toBe(false);
 expect(cursor.accept('two:0')).toBe(true);expect(cursor.accept('one:3')).toBe(false);expect(cursor.accept('two:01')).toBe(false);expect(cursor.accept('two:9007199254740992')).toBe(false);expect(cursor.accept('two:1')).toBe(true);
});
it('uses the full session identity alongside project, provider and explicit label search',()=>{
 const identity={provider:'codex',client:'cli',hostId:'host',sourceId:'source',sessionId:'session'} as const;
 const session={identity,projectId:'project',label:'My label',title:{value:'Résumé title',source:'provider'},project:'Divoom upgrade'} as MonitorSession;
 expect(matchesMonitor(session,{projectId:'project',provider:'codex',q:'LABEL',session:identity})).toBe(true);
 expect(matchesMonitor(session,{q:'résumé'})).toBe(true);expect(matchesMonitor(session,{q:'upgrade'})).toBe(true);
 expect(matchesMonitor(session,{session:{...identity,hostId:'another'}})).toBe(false);expect(matchesMonitor(session,{projectId:'other'})).toBe(false);
});
