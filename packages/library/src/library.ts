import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, realpath } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MediaError, MediaStore, type Rendition } from '@pixoo/media';
import { z } from 'zod';
import { LibraryError, hashSchema, idSchema, itemsSchema, nameSchema, revisionSchema, validate,
  type Asset, type ImportResult, type ItemInput, type Playlist, type PlaylistItem, type SessionReference } from './contracts.js';
import { acquireOwner, cleanup, databaseFile, recoverStaging } from './files.js';
import {checkpointSchema,createCheckpoint,readCheckpoint,saveCheckpoint,clearCheckpoint,type PlaybackCheckpoint} from './checkpoint.js';
import { APPLICATION_ID, MIGRATIONS, migrate, transaction } from './migrations.js';
import {snapshotFiles} from './snapshot.js';

type RenderOptions = NonNullable<Parameters<MediaStore['render']>[1]>;
type Row = Record<string, unknown>;
const optionsSchema = z.object({repeat:z.boolean().optional(), shuffle:z.boolean().optional()}).strict();
const json = <T>(value:unknown):T => JSON.parse(String(value)) as T;

/** One backend owner for a private catalog and its dedicated media directory. */
export class Library {
  private tail:Promise<unknown> = Promise.resolve();
  private closing = false;
  private closed?:Promise<void>;
  private constructor(private db:DatabaseSync, private owner:DatabaseSync, private media:MediaStore, private mediaDirectory:string) {}

  static async open(options:{directory:string;requireExisting?:boolean}):Promise<Library> {
    let db:DatabaseSync|undefined, owner:DatabaseSync|undefined;
    try {
      if(!options || typeof options.directory !== 'string') throw new LibraryError('invalid-input');
      if(options.requireExisting && !(await lstat(join(options.directory,'catalog.sqlite'))).isFile())throw new LibraryError('catalog-corrupt');
      const media = new MediaStore({directory:join(options.directory,'media')});
      await media.initialize();
      const mediaDirectory = await realpath(join(options.directory,'media'));
      const directory = dirname(mediaDirectory);
      owner = await acquireOwner(join(directory,'owner.sqlite'));
      const database = join(directory,'catalog.sqlite');
      await databaseFile(database);
      db = new DatabaseSync(database,{timeout:1000,enableForeignKeyConstraints:true,allowExtension:false});
      if(options.requireExisting){
        const app=db.prepare('PRAGMA application_id').get()!.application_id;
        const version=Number(db.prepare('PRAGMA user_version').get()!.user_version);
        if(app!==APPLICATION_ID || version<1 || version>MIGRATIONS.length)throw new LibraryError('catalog-corrupt');
      }
      db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA trusted_schema=OFF');
      migrate(db);
      await cleanup(db,mediaDirectory);
      await recoverStaging(mediaDirectory);
      return new Library(db,owner,media,mediaDirectory);
    } catch(error) {
      db?.close(); owner?.close();
      if(error instanceof LibraryError || error instanceof MediaError) throw error;
      throw new LibraryError('storage-error');
    }
  }

  private run<T>(action:()=>T|Promise<T>):Promise<T> {
    if(this.closing) return Promise.reject(new LibraryError('closed'));
    const result = this.tail.then(action).catch((error:unknown)=>{
      if(error instanceof LibraryError || error instanceof MediaError) throw error;
      throw new LibraryError('database-error');
    });
    this.tail = result.catch(()=>undefined);
    return result;
  }

  close():Promise<void> {
    this.closing = true;
    return this.closed ??= this.tail.then(()=>{try {this.db.close();} finally {this.owner.close();}});
  }

  /** Offline tooling keeps this owner open across inventory, snapshot and copying. */
  verifyStorage():Promise<string[]> {return this.run(()=>snapshotFiles(this.db,this.media));}
  snapshotDatabase(destination:string):Promise<void> {
    return this.run(()=>{this.db.prepare('VACUUM INTO ?').run(destination);});
  }

  private asset(row:Row|undefined):Asset {
    if(!row) throw new LibraryError('not-found');
    return {id:String(row.id),name:String(row.name),contentHash:String(row.content_hash),source:json(row.source_json),createdAt:String(row.created_at)};
  }
  private manifest(id:string):Rendition {
    const row = this.db.prepare('SELECT manifest_json FROM renditions WHERE id=?').get(id);
    if(!row) throw new LibraryError('not-found',{renditionId:id});
    return json(row.manifest_json);
  }
  async getAsset(id:string):Promise<Asset> {
    validate(idSchema,id);
    return this.run(()=>this.asset(this.db.prepare('SELECT * FROM assets WHERE id=?').get(id)));
  }
  listAssets():Promise<Asset[]> {
    return this.run(()=>this.db.prepare('SELECT * FROM assets ORDER BY created_at,id').all().map(row=>this.asset(row)));
  }
  async listRenditions(assetId:string):Promise<Rendition[]> {
    validate(idSchema,assetId);
    return this.run(()=>{
      this.asset(this.db.prepare('SELECT * FROM assets WHERE id=?').get(assetId));
      return this.db.prepare('SELECT manifest_json FROM renditions WHERE asset_id=? ORDER BY id').all(assetId).map(row=>json<Rendition>(row.manifest_json));
    });
  }
  async getRendition(id:string):Promise<Rendition> {
    validate(hashSchema,id);
    return this.run(async()=>{
      const stored = this.manifest(id), actual = await this.media.getRendition(id);
      if(JSON.stringify(stored)!==JSON.stringify(actual)) throw new LibraryError('catalog-corrupt');
      return actual;
    });
  }
  async readRendition(id:string,signal?:AbortSignal):Promise<{rendition:Rendition;frames:Buffer[]}> {
    validate(hashSchema,id);
    return this.run(async()=>{
      const stored=this.manifest(id),loaded=await this.media.readFrames(id,signal);
      if(JSON.stringify(stored)!==JSON.stringify(loaded.rendition))throw new LibraryError('catalog-corrupt');
      return loaded;
    });
  }
  async readFrame(id:string,index:number,format:'rgb'|'png'):Promise<Buffer> {
    validate(hashSchema,id);
    return this.run(()=>{this.manifest(id);return this.media.readFrame(id,index,format);});
  }
  private async register(input:AsyncIterable<Uint8Array>,name:string,options:RenderOptions):Promise<ImportResult> {
    await cleanup(this.db,this.mediaDirectory);
    const rendition = await this.media.render(input,options);
    return transaction(this.db,()=>{
      let row = this.db.prepare('SELECT * FROM assets WHERE content_hash=?').get(rendition.sourceHash);
      const now = new Date().toISOString();
      if(!row) {
        const id = randomUUID();
        this.db.prepare('INSERT INTO assets VALUES (?,?,?,?,?)').run(id,rendition.sourceHash,name,JSON.stringify(rendition.source),now);
        row = this.db.prepare('SELECT * FROM assets WHERE id=?').get(id);
      }
      const asset = this.asset(row);
      const existing = this.db.prepare('SELECT asset_id,manifest_json FROM renditions WHERE id=?').get(rendition.id);
      if(existing && (existing.asset_id!==asset.id || existing.manifest_json!==JSON.stringify(rendition))) throw new LibraryError('catalog-corrupt');
      if(!existing) this.db.prepare('INSERT INTO renditions VALUES (?,?,?,?)').run(rendition.id,asset.id,JSON.stringify(rendition),now);
      return {asset,rendition};
    });
  }
  private renderOptions(options:RenderOptions):RenderOptions {
    // Snapshot mutable settings before waiting for another operation. Keep the live abort signal.
    try {
      const {signal,...settings} = options;
      return {...structuredClone(settings),...(signal ? {signal} : {})};
    } catch {throw new LibraryError('invalid-input');}
  }
  async importMedia(input:AsyncIterable<Uint8Array>,name:string,options:RenderOptions={}):Promise<ImportResult> {
    name = validate(nameSchema,name); options = this.renderOptions(options);
    return this.run(()=>this.register(input,name,options));
  }
  async renderAsset(id:string,options:RenderOptions={}):Promise<ImportResult> {
    validate(idSchema,id); options = this.renderOptions(options);
    return this.run(async()=>{
      const asset = this.asset(this.db.prepare('SELECT * FROM assets WHERE id=?').get(id));
      const row = this.db.prepare('SELECT id FROM renditions WHERE asset_id=? LIMIT 1').get(id);
      if(!row) throw new LibraryError('catalog-corrupt');
      await this.media.getRendition(String(row.id));
      return this.register(createReadStream(join(this.mediaDirectory,'originals',asset.contentHash)),asset.name,options);
    });
  }

  private playlist(id:string):Playlist {
    const row = this.db.prepare('SELECT * FROM playlists WHERE id=?').get(id);
    if(!row) throw new LibraryError('not-found',{playlistId:id});
    const items = this.db.prepare('SELECT * FROM items WHERE playlist_id=? ORDER BY position').all(id).map(item=>({
      id:String(item.id),renditionId:String(item.rendition_id),playback:json<PlaylistItem['playback']>(item.policy_json),
    }));
    return {id,name:String(row.name),revision:Number(row.revision),repeat:row.repeat===1,shuffle:row.shuffle===1,
      createdAt:String(row.created_at),updatedAt:String(row.updated_at),items};
  }
  private expected(id:string,revision:number):Playlist {
    const playlist = this.playlist(id);
    if(playlist.revision!==revision) throw new LibraryError('revision-conflict',{playlistId:id,expectedRevision:revision,actualRevision:playlist.revision});
    return playlist;
  }
  private bump(id:string):Playlist {
    this.db.prepare('UPDATE playlists SET revision=revision+1,updated_at=? WHERE id=?').run(new Date().toISOString(),id);
    return this.playlist(id);
  }
  private newPlaylist(name:string,options:z.infer<typeof optionsSchema>):Playlist {
    const id = randomUUID(), now = new Date().toISOString();
    this.db.prepare('INSERT INTO playlists VALUES (?,?,?,?,?,?,?)').run(id,name,1,Number(options.repeat??true),Number(options.shuffle??false),now,now);
    return this.playlist(id);
  }
  async createPlaylist(name:string,options:z.infer<typeof optionsSchema>={}):Promise<Playlist> {
    name = validate(nameSchema,name); options = validate(optionsSchema,options);
    return this.run(()=>transaction(this.db,()=>this.newPlaylist(name,options)));
  }
  async getPlaylist(id:string):Promise<Playlist> {validate(idSchema,id);return this.run(()=>this.playlist(id));}
  listPlaylists():Promise<Playlist[]> {
    return this.run(()=>this.db.prepare('SELECT id FROM playlists ORDER BY created_at,id').all().map(row=>this.playlist(String(row.id))));
  }
  private validateEdit(id:string,revision:number):void {validate(idSchema,id);validate(revisionSchema,revision);}
  async renamePlaylist(id:string,revision:number,name:string):Promise<Playlist> {
    this.validateEdit(id,revision); name = validate(nameSchema,name);
    return this.run(()=>transaction(this.db,()=>{this.expected(id,revision);this.db.prepare('UPDATE playlists SET name=? WHERE id=?').run(name,id);return this.bump(id);}));
  }
  async setPlaylistOptions(id:string,revision:number,options:z.infer<typeof optionsSchema>):Promise<Playlist> {
    this.validateEdit(id,revision); options = validate(optionsSchema,options);
    return this.run(()=>transaction(this.db,()=>{
      const previous = this.expected(id,revision);
      this.db.prepare('UPDATE playlists SET repeat=?,shuffle=? WHERE id=?').run(Number(options.repeat??previous.repeat),Number(options.shuffle??previous.shuffle),id);
      return this.bump(id);
    }));
  }
  private writeItems(id:string,items:PlaylistItem[]):void {
    this.db.prepare('DELETE FROM items WHERE playlist_id=?').run(id);
    const insert = this.db.prepare('INSERT INTO items VALUES (?,?,?,?,?)');
    items.forEach((item,position)=>insert.run(item.id,id,position,item.renditionId,JSON.stringify(item.playback)));
  }
  async replaceItems(id:string,revision:number,input:ItemInput[]):Promise<Playlist> {
    this.validateEdit(id,revision); input = validate(itemsSchema,input);
    return this.run(()=>transaction(this.db,()=>{
      const previous = this.expected(id,revision), seen = new Set<string>();
      const items = input.map(item=>{
        const rendition = this.manifest(item.renditionId);
        if(item.id && !previous.items.some(old=>old.id===item.id) || item.id && seen.has(item.id)) throw new LibraryError('invalid-input');
        const itemId = item.id??randomUUID(); seen.add(itemId);
        const animated = rendition.frames.length>1;
        const playback = item.playback??(animated ? {mode:'plays' as const,totalPlays:3} : {mode:'duration' as const,durationMs:30000});
        if(playback.mode==='plays' && !animated) throw new LibraryError('invalid-input');
        return {id:itemId,renditionId:item.renditionId,playback};
      });
      this.writeItems(id,items); return this.bump(id);
    }));
  }
  async reorderItems(id:string,revision:number,itemIds:string[]):Promise<Playlist> {
    this.validateEdit(id,revision); itemIds = validate(z.array(idSchema).max(1000),itemIds);
    return this.run(()=>transaction(this.db,()=>{
      const previous = this.expected(id,revision), byId = new Map(previous.items.map(item=>[item.id,item]));
      if(itemIds.length!==byId.size || new Set(itemIds).size!==byId.size || itemIds.some(item=>!byId.has(item))) throw new LibraryError('invalid-input');
      this.writeItems(id,itemIds.map(item=>byId.get(item)!));return this.bump(id);
    }));
  }
  async duplicatePlaylist(id:string,revision:number,name:string):Promise<Playlist> {
    this.validateEdit(id,revision);name = validate(nameSchema,name);
    return this.run(()=>transaction(this.db,()=>{
      const previous = this.expected(id,revision), duplicate = this.newPlaylist(name,previous);
      this.writeItems(duplicate.id,previous.items.map(item=>({...item,id:randomUUID()})));
      return this.playlist(duplicate.id);
    }));
  }
  async deletePlaylist(id:string,revision:number):Promise<void> {
    this.validateEdit(id,revision);
    return this.run(()=>transaction(this.db,()=>{this.expected(id,revision);this.db.prepare('DELETE FROM playlists WHERE id=?').run(id);}));
  }

  async createPlaybackCheckpoint(playlistId:string):Promise<PlaybackCheckpoint> {
    validate(idSchema,playlistId);
    return this.run(()=>transaction(this.db,()=>createCheckpoint(this.db,this.playlist(playlistId))));
  }
  getPlaybackCheckpoint():Promise<PlaybackCheckpoint|undefined> {return this.run(()=>readCheckpoint(this.db));}
  async savePlaybackCheckpoint(record:PlaybackCheckpoint):Promise<void> {
    record=validate(checkpointSchema,record);
    return this.run(()=>transaction(this.db,()=>saveCheckpoint(this.db,record)));
  }
  clearPlaybackCheckpoint():Promise<void> {return this.run(()=>transaction(this.db,()=>clearCheckpoint(this.db)));}

  async retainSession(renditionIds:string[]):Promise<SessionReference> {
    renditionIds = validate(z.array(hashSchema).min(1).max(1000),renditionIds);
    return this.run(()=>transaction(this.db,()=>{
      const session = {id:randomUUID(),renditionIds:[...new Set(renditionIds)],createdAt:new Date().toISOString()};
      session.renditionIds.forEach(id=>this.manifest(id));
      this.db.prepare('INSERT INTO sessions VALUES (?,?)').run(session.id,session.createdAt);
      const insert = this.db.prepare('INSERT INTO session_refs VALUES (?,?)');
      session.renditionIds.forEach(id=>insert.run(session.id,id));
      session.renditionIds.sort();return session;
    }));
  }
  listSessions():Promise<SessionReference[]> {
    return this.run(()=>this.db.prepare('SELECT * FROM sessions ORDER BY created_at,id').all().map(row=>({
      id:String(row.id),createdAt:String(row.created_at),renditionIds:this.db.prepare('SELECT rendition_id FROM session_refs WHERE session_id=? ORDER BY rendition_id').all(String(row.id)).map(ref=>String(ref.rendition_id)),
    })));
  }
  async releaseSession(id:string):Promise<void> {
    validate(idSchema,id);
    return this.run(()=>{
      if(this.db.prepare('SELECT slot FROM playback_checkpoint WHERE session_id=?').get(id))throw new LibraryError('checkpoint-owned');
      this.db.prepare('DELETE FROM sessions WHERE id=?').run(id);
    });
  }
  async deleteAsset(id:string):Promise<void> {
    validate(idSchema,id);
    return this.run(async()=>{
      transaction(this.db,()=>{
        const asset = this.asset(this.db.prepare('SELECT * FROM assets WHERE id=?').get(id));
        const playlistIds = this.db.prepare('SELECT DISTINCT i.playlist_id FROM items i JOIN renditions r ON r.id=i.rendition_id WHERE r.asset_id=? ORDER BY i.playlist_id').all(id).map(row=>String(row.playlist_id));
        const sessionIds = this.db.prepare('SELECT DISTINCT s.session_id FROM session_refs s JOIN renditions r ON r.id=s.rendition_id WHERE r.asset_id=? ORDER BY s.session_id').all(id).map(row=>String(row.session_id));
        if(playlistIds.length || sessionIds.length) throw new LibraryError('asset-referenced',{assetId:id,playlistIds,sessionIds});
        const renditionIds = this.db.prepare('SELECT id FROM renditions WHERE asset_id=?').all(id).map(row=>String(row.id));
        this.db.prepare('INSERT INTO cleanup_jobs VALUES (?,?,?)').run(id,asset.contentHash,JSON.stringify(renditionIds));
        this.db.prepare('DELETE FROM renditions WHERE asset_id=?').run(id);
        this.db.prepare('DELETE FROM assets WHERE id=?').run(id);
      });
      await cleanup(this.db,this.mediaDirectory);
    });
  }
  retryCleanup():Promise<void> {return this.run(()=>cleanup(this.db,this.mediaDirectory));}
}
