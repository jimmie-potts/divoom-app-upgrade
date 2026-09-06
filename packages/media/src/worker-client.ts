import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MediaError, type MediaLimits, type MediaProfile, type Transform } from './contracts.js';
export interface WorkerRequest { input: string; output: string; sourceHash: string; id: string; transform: Transform; profile: MediaProfile; limits: MediaLimits }
export function signalError(signal: AbortSignal): MediaError { return new MediaError(signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError' ? 'timeout' : 'cancelled'); }
export function runWorker(request: WorkerRequest, signal: AbortSignal, entry = new URL('./worker.js', import.meta.url)): Promise<void> {
  if (signal.aborted) return Promise.reject(signalError(signal));
  return new Promise((resolve,reject) => {
    const child = fork(fileURLToPath(entry), { stdio:['ignore','ignore','ignore','ipc'], execArgv:['--max-old-space-size=256'], env:{PATH:process.env.PATH, SystemRoot:process.env.SystemRoot}, serialization:'advanced' });
    let success = false, failure: MediaError | undefined;
    const abort = () => { failure = signalError(signal); child.kill('SIGKILL'); };
    signal.addEventListener('abort',abort,{once:true});
    child.on('message', message => {
      const m = message as {ok?:boolean;code?:string};
      if (m?.ok === true) success = true;
      else {
        const codes = ['invalid-input','unsupported','upload-limit','pixel-limit','profile-limit','decode-failed'];
        failure = new MediaError(codes.includes(m?.code ?? '') ? m.code as MediaError['code'] : 'decode-failed');
      }
    });
    child.once('error',() => { failure ??= new MediaError('decode-failed'); });
    child.once('close',code => { // Reap the process before releasing the caller's slot or staging.
      signal.removeEventListener('abort',abort);
      if (failure) reject(failure); else if (code === 0 && success) resolve(); else reject(new MediaError('decode-failed'));
    });
    child.send(request,error => { if (error) { failure ??= new MediaError('decode-failed'); child.kill('SIGKILL'); } });
  });
}
