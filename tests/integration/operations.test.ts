import {afterEach,expect,it} from 'vitest';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile,symlink,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {Library} from '@pixoo/library';
import {createApp} from '../../apps/server/src/app.js';
import {backupData,restoreData,INCOMPLETE} from '../../apps/server/src/operations.js';
import {gifFixture} from '../helpers/media-fixtures.js';

const roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'pixoo-operations-'));roots.push(root);
 const source=join(root,'source'),bundle=join(root,'backup'),target=join(root,'restored');
 const library=await Library.open({directory:join(source,'library')});
 const bytes=gifFixture(1,1,[{width:1,height:1,pixels:[1]}]);
 const imported=await library.importMedia((async function*(){yield bytes;})(),'private-media.gif');
 let playlist=await library.createPlaylist('Private playlist',{shuffle:true});
 playlist=await library.replaceItems(playlist.id,playlist.revision,[{renditionId:imported.rendition.id}]);
 const checkpoint=await library.createPlaybackCheckpoint(playlist.id);
 await library.close();
 const settings={version:1,configuration:{ip:'10.255.0.1',profile:'simulator-v1'}};
 await writeFile(join(source,'device.json'),JSON.stringify(settings));
 return {root,source,bundle,target,imported,playlist,checkpoint,settings};
}

it('backs up committed WAL data and restores catalog, media, settings and paused context',async()=>{
 const f=await fixture();
 // Leave committed content in WAL while the app owner is stopped.
 const reader=new DatabaseSync(join(f.source,'library','catalog.sqlite'));
 reader.exec('PRAGMA wal_autocheckpoint=0');
 reader.prepare('UPDATE playlists SET name=? WHERE id=?').run('Committed in WAL',f.playlist.id);
 await writeFile(join(f.source,'unrelated.txt'),'not part of backup');
 try{
  await backupData(f.source,f.bundle);
  expect(await readdir(f.bundle)).toEqual(expect.arrayContaining(['manifest.json','library','device.json']));
  expect(await readdir(f.bundle)).not.toContain('unrelated.txt');
  expect(await readdir(join(f.bundle,'library'))).not.toContain('owner.sqlite');
  await restoreData(f.bundle,f.target);
 }finally{reader.close();}
 const restored=await Library.open({directory:join(f.target,'library')});
 try{
  expect(await restored.getPlaylist(f.playlist.id)).toEqual({...f.playlist,name:'Committed in WAL'});
  expect(await restored.getRendition(f.imported.rendition.id)).toEqual(f.imported.rendition);
  expect(await restored.getPlaybackCheckpoint()).toEqual(f.checkpoint);
 }finally{await restored.close();}
 expect(JSON.parse(await readFile(join(f.target,'device.json'),'utf8'))).toEqual(f.settings);
 const app=await createApp({dataDir:f.target});
 try{expect((await app.inject('/api/player')).json()).toMatchObject({player:{state:'paused',sessionId:f.checkpoint.sessionId}});}finally{await app.close();}
});

it('refuses incomplete and backup directories at startup without claiming their catalog',async()=>{
 const f=await fixture();await backupData(f.source,f.bundle);
 for(const path of [f.bundle,f.target]){
  if(path===f.target){await mkdir(path);await writeFile(join(path,INCOMPLETE),'interrupted');}
  const app=createApp({dataDir:path});
  try{await expect(app.ready()).rejects.toThrow('incomplete-or-backup-directory');}finally{await app.close();}
  await expect(stat(join(path,'library','owner.sqlite'))).rejects.toMatchObject({code:'ENOENT'});
 }
});

it('refuses a live owner, missing source and occupied or overlapping destination',async()=>{
 const f=await fixture(),owner=await Library.open({directory:join(f.source,'library')});
 try{await expect(backupData(f.source,f.bundle)).rejects.toMatchObject({code:'busy'});}finally{await owner.close();}
 await expect(stat(f.bundle)).rejects.toMatchObject({code:'ENOENT'});
 await expect(backupData(join(f.root,'missing'),f.bundle)).rejects.toThrow();
 await expect(stat(join(f.root,'missing'))).rejects.toMatchObject({code:'ENOENT'});
 await expect(backupData(f.source,join(f.source,'backup'))).rejects.toThrow('overlapping');
 await backupData(f.source,f.bundle);await mkdir(f.target);await writeFile(join(f.target,'keep'),'preserve');
 await expect(restoreData(f.bundle,f.target)).rejects.toThrow('destination-exists');
 expect(await readFile(join(f.target,'keep'),'utf8')).toBe('preserve');
});

it.each(['altered','missing','extra','traversal','duplicate','unsupported','unlisted-reference','invalid-settings'])('rejects %s backup data and preserves the original library',async mode=>{
 const f=await fixture();await backupData(f.source,f.bundle);
 const manifestPath=join(f.bundle,'manifest.json');
 const m=JSON.parse(await readFile(manifestPath,'utf8')) as {version:number;files:{path:string;size:number;sha256:string}[]};
 const original=m.files.find(entry=>entry.path.includes('/originals/'))!;
 if(mode==='altered')await writeFile(join(f.bundle,original.path),'corrupt');
 if(mode==='missing')await rm(join(f.bundle,original.path));
 if(mode==='extra')await writeFile(join(f.bundle,'unexpected'),'extra');
 if(mode==='traversal')original.path='../outside';
 if(mode==='duplicate')m.files.push({...original});
 if(mode==='unsupported')m.version=2;
 if(mode==='unlisted-reference'){m.files=m.files.filter(entry=>entry!==original);await rm(join(f.bundle,original.path));}
 if(mode==='invalid-settings')await writeFile(join(f.bundle,'device.json'),'{}');
 await writeFile(manifestPath,JSON.stringify(m));
 await expect(restoreData(f.bundle,f.target)).rejects.toThrow();
 const library=await Library.open({directory:join(f.source,'library')});
 try{expect(await library.getRendition(f.imported.rendition.id)).toEqual(f.imported.rendition);}finally{await library.close();}
});

it('rejects symlinked bundle directories and corrupt source media',async()=>{
 const f=await fixture();await backupData(f.source,f.bundle);
 const directory=join(f.bundle,'library','media');
 await rm(directory,{recursive:true});
 await symlink(join(f.source,'library','media'),directory,process.platform==='win32'?'junction':'dir');
 await expect(restoreData(f.bundle,f.target)).rejects.toThrow();
 await writeFile(join(f.source,'library','media','originals',f.imported.asset.contentHash),'bad');
 await expect(backupData(f.source,join(f.root,'bad-backup'))).rejects.toThrow();
});

it.each(['foreign-key','settings','empty-catalog'])('verifies %s contents beyond transport checksums and leaves failures incomplete',async mode=>{
 const f=await fixture();await backupData(f.source,f.bundle);
 const changed=mode==='settings'?'device.json':'library/catalog.sqlite',path=join(f.bundle,changed);
 if(mode==='settings')await writeFile(path,JSON.stringify({version:1,configuration:{ip:'not-an-ip'}}));
 else if(mode==='empty-catalog')await writeFile(path,'');
 else{
  const db=new DatabaseSync(path,{enableForeignKeyConstraints:false});
  try{db.exec('DELETE FROM assets');}finally{db.close();}
 }
 const bytes=await readFile(path),manifestPath=join(f.bundle,'manifest.json');
 const m=JSON.parse(await readFile(manifestPath,'utf8')) as {files:{path:string;size:number;sha256:string}[]};
 const file=m.files.find(entry=>entry.path===changed)!;file.size=bytes.length;file.sha256=createHash('sha256').update(bytes).digest('hex');
 await writeFile(manifestPath,JSON.stringify(m));
 await expect(restoreData(f.bundle,f.target)).rejects.toThrow();
 if(mode!=='empty-catalog')expect(await readFile(join(f.target,INCOMPLETE),'utf8')).toContain('Incomplete');
});

it('rejects nonzero uninitialized SQLite catalogs without initializing the source',async()=>{
 const f=await fixture();await backupData(f.source,f.bundle);
 const empty=join(f.root,'uninitialized');await mkdir(join(empty,'library'),{recursive:true});
 const catalog=join(empty,'library','catalog.sqlite'),db=new DatabaseSync(catalog);
 db.exec('VACUUM');db.close();const original=await readFile(catalog);expect(original.length).toBeGreaterThan(100);
 await expect(backupData(empty,join(f.root,'wrong-backup'))).rejects.toThrow();
 expect(await readFile(catalog)).toEqual(original);
 await writeFile(join(f.bundle,'library','catalog.sqlite'),original);
 const manifestPath=join(f.bundle,'manifest.json'),m=JSON.parse(await readFile(manifestPath,'utf8')) as {files:{path:string;size:number;sha256:string}[]};
 const file=m.files.find(entry=>entry.path==='library/catalog.sqlite')!;file.size=original.length;file.sha256=createHash('sha256').update(original).digest('hex');
 await writeFile(manifestPath,JSON.stringify(m));
 await expect(restoreData(f.bundle,f.target)).rejects.toThrow();
 expect(await readFile(join(f.target,INCOMPLETE),'utf8')).toContain('Incomplete');
});

it.each(['created_at','updated_at'])('rejects invalid playlist %s during backup and restore',async column=>{
 const f=await fixture();await backupData(f.source,f.bundle);
 for(const root of [f.source,f.bundle]){
  const path=join(root,'library','catalog.sqlite'),db=new DatabaseSync(path);
  try{db.exec(`UPDATE playlists SET ${column}='damaged-date'`);}finally{db.close();}
 }
 await expect(backupData(f.source,join(f.root,'invalid-dates'))).rejects.toThrow();
 const bytes=await readFile(join(f.bundle,'library','catalog.sqlite')),manifestPath=join(f.bundle,'manifest.json');
 const m=JSON.parse(await readFile(manifestPath,'utf8')) as {files:{path:string;size:number;sha256:string}[]};
 const file=m.files.find(entry=>entry.path==='library/catalog.sqlite')!;file.size=bytes.length;file.sha256=createHash('sha256').update(bytes).digest('hex');
 await writeFile(manifestPath,JSON.stringify(m));
 await expect(restoreData(f.bundle,f.target)).rejects.toThrow();
});
