import type {Library,PlaybackCheckpoint} from '@pixoo/library';
import {MediaError,type MediaProfile} from '@pixoo/media';
import type {PlaybackStore} from './contracts.js';
import {PlaybackError} from './contracts.js';
const owners=new WeakSet<Library>();
/** Shares the library's private storage and its existing exclusive process owner. */
export class LibraryPlaybackStore implements PlaybackStore {
  private readonly profile:Readonly<MediaProfile>|undefined;
  private readonly stillDelayMs:number;
  constructor(private library:Library,options:{profile?:Readonly<MediaProfile>;stillDelayMs?:number}={}){
    this.profile=options.profile?Object.freeze({...options.profile}):undefined;
    this.stillDelayMs=options.stillDelayMs??100;
    if(!Number.isSafeInteger(this.stillDelayMs)||this.stillDelayMs<1||this.stillDelayMs>655350)throw new MediaError('invalid-input');
  }
  claim():()=>void {if(owners.has(this.library))throw new PlaybackError('busy');owners.add(this.library);return ()=>{owners.delete(this.library);};}
  capture(id:string){return this.library.createPlaybackCheckpoint(id);}
  read(){return this.library.getPlaybackCheckpoint();}
  save(record:PlaybackCheckpoint){return this.library.savePlaybackCheckpoint(record);}
  clear(){return this.library.clearPlaybackCheckpoint();}
  async load(id:string,signal:AbortSignal){
    const {rendition,frames}=await this.library.readRendition(id,signal);
    const prepared=frames.map((rgb,index)=>({rgb,delayMs:rendition.source.format==='gif'?rendition.frames[index]!.delayMs??100:this.stillDelayMs}));
    const profile=this.profile;
    if(profile&&(prepared.length>profile.maxFrames||prepared.some(frame=>frame.delayMs<profile.minDelayMs||frame.delayMs>profile.maxDelayMs)||
      (profile.uniformTiming&&prepared.some(frame=>frame.delayMs!==prepared[0]?.delayMs))))throw new MediaError('profile-limit');
    return {frames:prepared};
  }
}
