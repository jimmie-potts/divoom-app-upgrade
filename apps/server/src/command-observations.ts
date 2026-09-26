import type {PlayerCommand,IntegrationSnapshot} from '@pixoo/core';
import type {Request,Receipt} from '@jimmie-potts/device-contracts';
import type {ControlService} from './control-service.js';

// Observation metadata is independent of the bytes used to identify a replay.
export type ApplicationOperations={
 player:{input:PlayerCommand;result:ReturnType<ControlService['snapshot']>};
 display:{input:Parameters<ControlService['applyDisplay']>[0];result:Awaited<ReturnType<ControlService['applyDisplay']>>};
 integration:{input:undefined;result:IntegrationSnapshot};
 controller:{input:Request['command'];result:Receipt};
};
export type OperationMap=Record<string,{input:unknown;result:unknown}>;
export type CommandEvent<Operations extends OperationMap=ApplicationOperations>={
 [Kind in keyof Operations]:{requestId:string;kind:Kind;input:Operations[Kind]['input']}&(
  {phase:'pending'}|{phase:'complete';outcome:'success';result:Operations[Kind]['result']}|{phase:'complete';outcome:'failure';error:unknown}
 )
}[keyof Operations];
