import type {DatabaseSync} from 'node:sqlite';
import type {MediaStore} from '@pixoo/media';
import {readCheckpoint} from './checkpoint.js';
import {hashSchema,idSchema,itemsSchema,LibraryError,nameSchema,revisionSchema} from './contracts.js';

/** Verify the live catalog and return only files owned by catalog references. */
export async function snapshotFiles(db:DatabaseSync,media:MediaStore):Promise<string[]> {
 const fail=()=>{throw new LibraryError('catalog-corrupt');};
 if(db.prepare('PRAGMA integrity_check').all().some(row=>row.integrity_check!=='ok') ||
    db.prepare('PRAGMA foreign_key_check').all().length)fail();
 readCheckpoint(db);
 const files=new Set<string>();
 for(const asset of db.prepare('SELECT * FROM assets').all()){
  idSchema.parse(asset.id);nameSchema.parse(asset.name);hashSchema.parse(asset.content_hash);
  const rows=db.prepare('SELECT * FROM renditions WHERE asset_id=? ORDER BY id').all(asset.id!);
  if(!rows.length)fail();
  for(const row of rows){
   const id=hashSchema.parse(row.id),actual=await media.getRendition(id);
   if(actual.sourceHash!==asset.content_hash || JSON.stringify(actual)!==String(row.manifest_json) ||
      JSON.stringify(actual.source)!==String(asset.source_json))fail();
   files.add(`media/originals/${actual.sourceHash}`);
   files.add(`media/renditions/${id}/manifest.json`);
   for(const frame of actual.frames)for(const extension of ['rgb','png'])files.add(`media/renditions/${id}/${frame.index}.${extension}`);
  }
 }
 for(const playlist of db.prepare('SELECT * FROM playlists').all()){
  idSchema.parse(playlist.id);nameSchema.parse(playlist.name);revisionSchema.parse(playlist.revision);
  if(![0,1].includes(Number(playlist.repeat)) || ![0,1].includes(Number(playlist.shuffle)))fail();
  const rows=db.prepare('SELECT * FROM items WHERE playlist_id=? ORDER BY position').all(playlist.id!);
  itemsSchema.parse(rows.map((row,index)=>{
   if(row.position!==index)fail();
   return {id:row.id,renditionId:row.rendition_id,playback:JSON.parse(String(row.policy_json)) as unknown};
  }));
 }
 return [...files].sort();
}
