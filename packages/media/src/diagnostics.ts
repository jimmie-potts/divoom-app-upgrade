import {context,trace} from '@opentelemetry/api';
import type {HostDiagnostics} from '@jimmie-potts/bunny-observability/host';
export interface WorkerDiagnostics {tracing:boolean;samplingRatio:number;collectorOrigin?:string;traceparent?:string}
export interface MediaDiagnostics {runtime:HostDiagnostics;worker:WorkerDiagnostics}
export function workerDiagnostics(settings:WorkerDiagnostics):WorkerDiagnostics{
 const current=trace.getSpanContext(context.active());
 return {...settings,...(current&&trace.isSpanContextValid(current)?{traceparent:`00-${current.traceId}-${current.spanId}-${(current.traceFlags&1).toString(16).padStart(2,'0')}`}:{})};
}
