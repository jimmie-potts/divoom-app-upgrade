import {expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startHub} from '@jimmie-potts/hub';
import {createSessionSource} from '../../apps/server/src/monitor-source.js';

it('reads title/project snapshot 1.2 from the released Hub owner without local storage',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pixoo-hub-metadata-'));
 await mkdir(join(directory,'hub'),{mode:0o700});
 const token='a'.repeat(43),identity={provider:'codex',client:'cli',hostId:'fixture',sourceId:'fixture',sessionId:'titled-session'} as const;
 const hub=await startHub({directory:join(directory,'hub'),ownerId:'owner',consumers:[{id:'pixoo',clearOnNewTurn:true}],controllers:[],port:0,clock:()=>1000,credentials:[{id:'fixture',digest:createHash('sha256').update(token).digest('hex'),scopes:['read','ingest','control'],devices:[]}]});
 const source=await createSessionSource(join(directory,'unused'),{version:1,mode:'remote',ownerId:'owner',endpoint:hub.url+'/api/monitor/v1',token});
 try{
  const response=await fetch(hub.url+'/api/monitor/v1/events',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json','x-pixoo-request':'1'},body:JSON.stringify({apiVersion:'1.1',identity,title:{value:'Résumé monitor',source:'provider'},project:'DIVOOM-APP-UPGRADE',turn:{status:'known',id:'turn'},parent:{status:'top-level'},event:{kind:'session.started'},observedAtMs:1000,ordering:{status:'known',epoch:'epoch',sequence:1}})});
  expect(response.status).toBe(200);expect(await response.json()).toMatchObject({ok:true});
  await source.refresh();expect(source.view()).toMatchObject({connection:'current',snapshot:{apiVersion:'1.2',sessions:[{identity,title:{value:'Résumé monitor',source:'provider'},project:'DIVOOM-APP-UPGRADE'}]}});
  expect(await source.command({operation:'label',requestId:source.view().nextRequestId!,identity,label:'Owner choice'})).toMatchObject({ok:true});
  await source.refresh();expect(source.view().snapshot?.sessions[0]).toMatchObject({label:'Owner choice',labelOrigin:'user',title:{value:'Résumé monitor'},project:'DIVOOM-APP-UPGRADE'});
  expect(source.view('1.0').snapshot?.sessions[0]).not.toHaveProperty('title');
  expect(await readdir(directory)).toEqual(['hub']);
 }finally{await source.close();await hub.close();await rm(directory,{recursive:true,force:true});}
});

it('pins the released Hub archive, source receipt and installed manifest',async()=>{
 const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
 const archive=await readFile(new URL('../../vendor/jimmie-potts-hub-0.4.0.tgz',import.meta.url));
 expect(sha(archive)).toBe('4a54488cc1bb850afa33f993fad4ff2a2302280540ac269ec9c86b9b29474341');
 const receipt=JSON.parse(await readFile(new URL('../../vendor/hub-0.4.0-source-receipt.json',import.meta.url),'utf8'));
 expect(receipt).toMatchObject({version:'0.4.0',sourceRevision:'38b47e3259e3f19f65d0f82234efcce7c48167b9',sha256:'4a54488cc1bb850afa33f993fad4ff2a2302280540ac269ec9c86b9b29474341'});
 const root=new URL('../../node_modules/@jimmie-potts/hub/',import.meta.url);
 const manifestBytes=await readFile(new URL('manifest.json',root));
 expect(sha(manifestBytes)).toBe('85309b8c5d5b656b5ad8638c2373fd508c9e7846d70b96e8be178da43ab4e3b1');
 const manifest=JSON.parse(manifestBytes.toString()) as {version:string;files:Record<string,string>};
 expect(manifest.version).toBe('0.4.0');
 for(const [path,hash]of Object.entries(manifest.files))expect(sha(await readFile(new URL(path,root))),path).toBe(hash);
});
