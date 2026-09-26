import type {NowPlayingState} from '@pixoo/core';
import {integrationRequest,presentationConfiguration,type IntegrationAction,type IntegrationSnapshot,type SessionIdentity} from '@pixoo/core';
export function integrationCommand(snapshot:IntegrationSnapshot,action:IntegrationAction){
 if(snapshot.apiVersion!=='pixoo-integration/1.0'||!snapshot.capabilities.modes.includes(action.operation==='mode'?action.mode:snapshot.configuration.mode))throw new Error('Unsupported integration');
 if(action.operation==='view'&&(Object.keys(action.filter).some(key=>!snapshot.capabilities.filters.includes(key as keyof typeof action.filter))||action.cadenceMs<snapshot.capabilities.minimumCadenceMs||action.cadenceMs>snapshot.capabilities.maximumCadenceMs))throw new Error('Unsupported integration view');
 return integrationRequest.parse({apiVersion:snapshot.apiVersion,requestId:snapshot.nextRequestId,expectedConfigurationRevision:snapshot.configurationRevision,expectedGeneration:snapshot.generation,action});
}
export function checkIntegration(value:IntegrationSnapshot):IntegrationSnapshot{
 if(value?.apiVersion!=='pixoo-integration/1.0'||!value.serverId||!value.nextRequestId?.startsWith(value.serverId+':')||!Number.isSafeInteger(value.configurationRevision)||!Number.isSafeInteger(value.generation)||!Array.isArray(value.capabilities?.modes)||typeof value.participating!=='boolean')throw new Error('Invalid integration snapshot');
 presentationConfiguration.parse(value.configuration);return value;
}
export class MonitorCursor {
 private epoch='';private sequence=-1;private retired:string[]=[];
 accept(id:string):boolean{
  const match=/^([^:]+):(0|[1-9][0-9]*)$/.exec(id);if(!match)return false;
  const epoch=match[1]!,sequence=Number(match[2]);if(!Number.isSafeInteger(sequence)||this.retired.includes(epoch))return false;
  if(epoch===this.epoch&&sequence<=this.sequence)return false;
  if(epoch!==this.epoch){if(this.epoch)this.retired=[...this.retired.slice(-7),this.epoch];this.epoch=epoch;}
  this.sequence=sequence;return true;
 }
}
export interface MonitorSession {
 identity:SessionIdentity;label?:string;title?:{value:string;source:'provider'|'user'};project?:string;projectId?:string;activity:string;freshness:string;
 observedAtMs:number;lastEvidenceAtMs:number;observationAgeMs:number;parent:{status:string};
 children:{active:number;uncertain:number};attention:Array<{kind:string}>;
 notices:Array<{id:string;acknowledgedBy:string[]}>;
}
export interface MonitorRead {
 integration:IntegrationSnapshot;
 source:{connection:string;ownerId:string;nextRequestId:string|null;snapshot:null|{asOfMs:number;collector:string;sessions:MonitorSession[]}};
 dashboard:{state:string;rendition:null|{generation:number;rgb:number[];frames:number[][];frameDelayMs:number;layout:{matched:number;total:number;page:number;pages:number;attentionTotal:number}}};
 nowPlaying?:NowPlayingState;
}
export function matchesMonitor(session:MonitorSession,view:IntegrationSnapshot['configuration']['filter']){
 return (!view.provider||session.identity.provider===view.provider)&&(!view.projectId||session.projectId===view.projectId)&&(!view.q||[session.label,session.title?.value,session.project,session.identity.sessionId].some(value=>value?.toLowerCase().includes(view.q!.toLowerCase())))&&(!view.session||Object.entries(view.session).every(([key,value])=>session.identity[key as keyof SessionIdentity]===value));
}
