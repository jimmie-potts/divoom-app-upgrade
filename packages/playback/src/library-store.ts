import type {Library,PlaybackCheckpoint} from '@pixoo/library';
import type {PlaybackStore} from './contracts.js';
import {PlaybackError} from './contracts.js';
const owners=new WeakSet<Library>();
/** Shares the library's private storage and its existing exclusive process owner. */
export class LibraryPlaybackStore implements PlaybackStore {
  constructor(private library:Library){}
  claim():()=>void {if(owners.has(this.library))throw new PlaybackError('busy');owners.add(this.library);return ()=>{owners.delete(this.library);};}
  capture(id:string){return this.library.createPlaybackCheckpoint(id);}
  read(){return this.library.getPlaybackCheckpoint();}
  save(record:PlaybackCheckpoint){return this.library.savePlaybackCheckpoint(record);}
  clear(){return this.library.clearPlaybackCheckpoint();}
  async load(id:string,signal:AbortSignal){
    const {rendition,frames}=await this.library.readRendition(id,signal);
    return {frames:frames.map((rgb,index)=>({rgb,delayMs:rendition.frames[index]!.delayMs??100}))};
  }
}
