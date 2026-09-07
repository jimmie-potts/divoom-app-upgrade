import {apiErrorSchema} from '@pixoo/core';
export type {Asset,Playlist,PlaylistItem} from '@pixoo/library';
export type {Rendition,Transform} from '@pixoo/media';
export type {PlayerState} from '@pixoo/playback';
export class RequestError extends Error {
 constructor(readonly code:string,readonly details?:Record<string,unknown>){super(code);}
}
export async function request<T>(path:string,method='GET',body?:unknown):Promise<T>{
 const controller=new AbortController();
 const timer=window.setTimeout(()=>controller.abort(),45000);
 try{
  const form=body instanceof FormData;
  const response=await fetch(`/api${path}`,{method,cache:'no-store',signal:controller.signal,
   headers:{'X-Pixoo-Request':'1',...(!form&&body!==undefined?{'Content-Type':'application/json'}:{})},
   ...(body!==undefined?{body:form?body:JSON.stringify(body)}:{})});
  if(!response.ok){
   const parsed=apiErrorSchema.safeParse(await response.json().catch(()=>null));
   throw new RequestError(parsed.success?parsed.data.error.code:`http-${response.status}`,parsed.success?parsed.data.error.details:undefined);
  }
  return response.status===204?undefined as T:await response.json() as T;
 }finally{window.clearTimeout(timer);}
}
export function explain(error:unknown):string{
 if(!(error instanceof RequestError))return 'The server response was interrupted. Check the connection and retry.';
 const hints:Record<string,string>={
  'revision-conflict':'This playlist changed in another window. Your draft is preserved. Reload the saved playlist before editing again.',
  'asset-referenced':'This media is used by a playlist or saved player session. Remove those references and clear the session before deleting.',
  'invalid-input':'Check the fields. Use positive whole-number timing, a name up to 120 characters, and a private IPv4 address for device settings.',
  unsupported:'Choose a PNG, JPEG or GIF file.', 'upload-limit':'Choose a file smaller than 10 MiB.',
  'decode-failed':'The file could not be decoded. Try another PNG, JPEG or GIF.',
  'profile-limit':'This animation exceeds the rendering profile. Use fewer frames or supported frame delays.',
  busy:'The server is busy. Wait for current work to finish, then retry.',
  'screen-off':'Turn the screen on, then explicitly resume.',
  'request-conflict':'Another controller used this command identity. Reconcile state, then choose your next action.',
  'request-expired':'This command identity expired or the server restarted. Reconcile state before choosing a new action.',
  'request-order':'Command state is out of date. Reconcile state before choosing a new action.',
  'no-context':'Choose a nonempty playlist and press Play playlist.',
 };
 return `${hints[error.code]??'The operation failed. Reload current data and retry.'} (${error.code})`;
}
