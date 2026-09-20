import {DatabaseSync} from 'node:sqlite';
import {mkdir,lstat,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {LIMITS,validateExport,type Storage,type StorageLease,type DurableState,type Commit} from '@jimmie-potts/agent-state';
import {privatePath} from './config.js';

/** Host storage only. The shared package owns all lifecycle interpretation. */
export class MonitorStorage implements Storage {
 constructor(private directory:string){}
 async acquire(_ownerId:string,signal:AbortSignal):Promise<StorageLease>{
  const directory=await privatePath(this.directory);
  if(process.platform==='linux'&&/^\/mnt\//.test(directory))throw new Error('local-storage-required');
  await mkdir(directory,{recursive:true,mode:0o700});
  const paths=['owner.sqlite','state.sqlite'].map(name=>join(directory,name));
  for(const path of paths){try{if(!(await lstat(path)).isFile())throw new Error('invalid-store');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
  let lock:DatabaseSync|undefined,db:DatabaseSync|undefined,released=false;
  const check=(abort?:AbortSignal)=>{if(released||abort?.aborted)throw new Error('storage-unavailable');};
  try{
   check(signal);lock=new DatabaseSync(paths[0]!);lock.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE');
   check(signal);db=new DatabaseSync(paths[1]!);await Promise.all(paths.map(path=>chmod(path,0o600)));
   if(db.prepare('PRAGMA journal_mode=WAL').get()?.journal_mode!=='wal')throw new Error('wal-unavailable');
   db.exec('PRAGMA busy_timeout=0; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (identity TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS journal (revision INTEGER PRIMARY KEY, atMs INTEGER NOT NULL, body TEXT NOT NULL)');
   await Promise.all(paths.map(path=>chmod(path,0o600)));check(signal);
   const database=db;
   const load=():DurableState|null=>{
    const row=database.prepare('SELECT body FROM state WHERE id=1').get();
    if(!row)return null;
    if(typeof row.body!=='string'||Buffer.byteLength(row.body)>16*1024*1024)throw new Error('invalid-store');
    const value=JSON.parse(row.body);
    value.sessions=database.prepare('SELECT body FROM sessions ORDER BY rowid').all().map(row=>JSON.parse(String(row.body)));
    value.journal=database.prepare('SELECT body FROM journal ORDER BY revision').all().map(row=>JSON.parse(String(row.body)));
    const checked=validateExport(value);if(!checked.ok)throw new Error('invalid-store');return checked.value;
   };
   return {
    load:async abort=>{check(abort);return load();},
    commit:async(change:Commit,abort)=>{
     check(abort);database.exec('BEGIN IMMEDIATE');
     try{
      const prior=database.prepare('SELECT revision,body FROM state WHERE id=1').get();
      if((prior?.revision??null)!==change.expectedRevision)throw new Error('revision-conflict');
      const key=(session:DurableState['sessions'][number])=>JSON.stringify([session.identity.provider,session.identity.client,session.identity.hostId,session.identity.sourceId,session.identity.sessionId]);
      const putSession=database.prepare('INSERT INTO sessions VALUES(?,?) ON CONFLICT(identity) DO UPDATE SET body=excluded.body');
      const putJournal=database.prepare('INSERT INTO journal VALUES(?,?,?)');
      let metadata:Omit<DurableState,'sessions'|'journal'>;
      if(change.replace){
       const {sessions,journal,...rest}=change.replace;metadata={...rest};
       database.exec('DELETE FROM sessions; DELETE FROM journal');
       for(const session of sessions)putSession.run(key(session),JSON.stringify(session));
       for(const row of journal)putJournal.run(row.revision,row.atMs,JSON.stringify(row));
      }else{
       if(!prior)throw new Error('uninitialized-store');metadata=JSON.parse(String(prior.body));
      }
      if(change.session)putSession.run(key(change.session),JSON.stringify(change.session));
      if(change.journal)putJournal.run(change.journal.revision,change.journal.atMs,JSON.stringify(change.journal));
      database.prepare('DELETE FROM journal WHERE atMs<=?').run(change.pruneBeforeMs);
      database.prepare('DELETE FROM journal WHERE revision NOT IN (SELECT revision FROM journal ORDER BY revision DESC LIMIT ?)').run(LIMITS.journalEvents);
      metadata.revision=change.revision;metadata.lastCommitAtMs=change.atMs;
      check(abort);database.prepare('INSERT INTO state VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,body=excluded.body').run(change.revision,JSON.stringify(metadata));
      check(abort);database.exec('COMMIT');
     }catch(error){database.exec('ROLLBACK');throw error;}
    },
    release:async()=>{if(released)return;released=true;try{database.close();}finally{lock!.close();}}
   };
  }catch{try{db?.close();}finally{lock?.close();}throw new Error('storage-unavailable');}
 }
}
