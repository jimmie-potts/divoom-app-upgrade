import {it,expect} from 'vitest';
import {createServer} from 'node:http';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createApp} from '../../apps/server/src/app.js';
import {createDiagnostics} from '../../apps/server/src/diagnostics.js';
import {multipart} from '../helpers/http-api.js';
import {gifFixture} from '../helpers/media-fixtures.js';
import {validateRecord,type DiagnosticRecord} from '@jimmie-potts/bunny-observability';

it('verifies installed package bytes against the accepted archive receipt',async()=>{
 const root='node_modules/@jimmie-potts/bunny-observability';
 const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
 const receipt=JSON.parse(await readFile('vendor/observability-1.1.0-source-receipt.json','utf8'));
 expect(digest(await readFile('vendor/jimmie-potts-bunny-observability-1.1.0.tgz'))).toBe(receipt.sha256);
 const manifestBytes=await readFile(join(root,'manifest.json'));expect(digest(manifestBytes)).toBe(receipt.manifestSha256);
 const fixtures=JSON.parse(await readFile(join(root,'fixtures/records.json'),'utf8')) as {cases:Array<{name:string;record:unknown;valid:boolean}>};
 for(const fixture of fixtures.cases)expect(validateRecord(fixture.record).ok,fixture.name).toBe(fixture.valid);
 const manifest=JSON.parse(manifestBytes.toString());expect(manifest.version).toBe('1.1.0');
 for(const [path,hash] of Object.entries(manifest.files))expect(digest(await readFile(join(root,path))),path).toBe(hash);
});

it('correlates authenticated concurrent uploads through real owned workers',async()=>{
 const received:Array<{resourceLogs?:Array<{resource:{attributes:Array<{key:string;value:{stringValue?:string}}>};scopeLogs:Array<{logRecords:Array<{traceId?:string;spanId?:string}>}>}>;resourceSpans?:Array<{scopeSpans:Array<{spans:Array<{traceId:string;spanId:string}>}>}>}>=[];
 const collector=createServer((req,res)=>{let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{received.push(JSON.parse(body));res.writeHead(200,{'content-type':'application/json'});res.end('{}');});});
 await new Promise<void>(resolve=>collector.listen(0,'127.0.0.1',resolve));
 const address=collector.address();if(!address||typeof address==='string')throw new Error('missing collector');
 const local:DiagnosticRecord[]=[];
 const diagnostics=await createDiagnostics({PIXOO_OBSERVABILITY_ENABLED:'1',PIXOO_OBSERVABILITY_TRACING:'1',PIXOO_OBSERVABILITY_SAMPLE_RATIO:'1',PIXOO_OBSERVABILITY_COLLECTOR:`http://127.0.0.1:${address.port}`},line=>{local.push(JSON.parse(line));});
 const root=await mkdtemp(join(tmpdir(),'pixoo-observability-'));
 const app=createApp({dataDir:root,diagnostics,authenticate:request=>request.headers.authorization==='Bearer synthetic'});
 try{
  const denied=await app.inject({url:'/api/health',headers:{traceparent:`00-${'9'.repeat(32)}-${'3'.repeat(16)}-01`}});
  expect(denied.statusCode).toBe(401);
  const ids=['1'.repeat(32),'2'.repeat(32)];
  const results=await Promise.all(ids.map((id,index)=>{
   const upload=multipart(gifFixture(1,1,[{width:1,height:1,pixels:[index+1]}]));
   return app.inject({method:'POST',url:'/api/assets',...upload,headers:{...upload.headers,authorization:'Bearer synthetic',traceparent:`00-${id}-${'3'.repeat(16)}-01`}});
  }));
  expect(results.map(result=>result.statusCode)).toEqual([201,201]);
  await app.close();
  for(const record of local)expect(validateRecord(record).ok).toBe(true);
  const workers=local.filter(record=>record.resource['service.name']==='pixoo-media-worker');
  expect(workers.map(record=>record.trace_id).sort()).toEqual(ids);
  for(const worker of workers)expect(local.some(record=>record.scope.name==='bunny.queue'&&record.trace_id===worker.trace_id&&record.span_id===worker.span_id)).toBe(true);
  const exported=received.flatMap(batch=>(batch.resourceLogs??[]).filter(group=>group.resource.attributes.some(attribute=>attribute.key==='service.name'&&attribute.value.stringValue==='pixoo-media-worker')).flatMap(group=>group.scopeLogs.flatMap(scope=>scope.logRecords)));
  const spans=received.flatMap(batch=>(batch.resourceSpans??[]).flatMap(group=>group.scopeSpans.flatMap(scope=>scope.spans)));
  expect(exported.map(record=>record.traceId).sort()).toEqual(ids);
  for(const record of exported)expect(spans.some(span=>span.traceId===record.traceId&&span.spanId===record.spanId)).toBe(true);
  expect(local.filter(record=>record.scope.name==='bunny.queue')).toHaveLength(2);
 }finally{await app.close();await diagnostics.runtime.shutdown();await rm(root,{recursive:true,force:true});await new Promise<void>(resolve=>collector.close(()=>resolve()));}
},15000);

it.each(['absent','stalled'] as const)('keeps simulator operations unchanged with %s collection',async mode=>{
 const collector=createServer(req=>req.resume());
 await new Promise<void>(resolve=>collector.listen(0,'127.0.0.1',resolve));
 const address=collector.address();if(!address||typeof address==='string')throw new Error('missing collector');
 if(mode==='absent')await new Promise<void>(resolve=>collector.close(()=>resolve()));
 const diagnostics=await createDiagnostics({PIXOO_OBSERVABILITY_ENABLED:'1',PIXOO_OBSERVABILITY_COLLECTOR:`http://127.0.0.1:${address.port}`},()=>{});
 const root=await mkdtemp(join(tmpdir(),'pixoo-observability-failure-'));
 const app=createApp({dataDir:root,diagnostics});
 try{
  const result=await app.inject({method:'POST',url:'/api/assets',...multipart()});
  expect(result.statusCode).toBe(201);
  expect((await app.inject('/api/assets')).json().total).toBe(1);
  const bad=await app.inject({method:'POST',url:'/api/assets',...multipart(Buffer.from('invalid'))});
  expect(bad.statusCode).toBe(415);
  expect((await app.inject('/api/assets')).json().total).toBe(1);
  const status=(await app.inject('/api/player')).json();
  const command={method:'PATCH' as const,url:'/api/device/display',headers:{'x-pixoo-request':'1'},payload:{requestId:status.nextRequestId,brightness:42}};
  const first=await app.inject(command),replay=await app.inject(command);
  expect(first.statusCode).toBe(200);expect(replay.json()).toEqual(first.json());
  expect((await app.inject('/api/device/simulator')).json().writer.setBrightness).toEqual({admitted:1,succeeded:1});
  const started=performance.now();await app.close();expect(performance.now()-started).toBeLessThan(2000);
  const counts=diagnostics.runtime.counts() as {logs:{queued:number;dropped:number;failed:number};transport:Array<{failed:number}>};
  expect(counts.logs.queued).toBe(0);expect(counts.transport.some(item=>item.failed>0)).toBe(true);
 }finally{await app.close();await diagnostics.runtime.shutdown();collector.closeAllConnections();await new Promise<void>(resolve=>collector.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
},15000);

it.each(['0','1'])('normal executable keeps startup separate with enablement %s',async enabled=>{
 const {spawn}=await import('node:child_process');
 const root=await mkdtemp(join(tmpdir(),'pixoo-observability-start-'));
 const child=spawn(process.execPath,['apps/server/dist/main.js'],{env:{PATH:process.env.PATH,PIXOO_DATA_DIR:root,PIXOO_PORT:'0',PIXOO_MODE:'simulator',PIXOO_OBSERVABILITY_ENABLED:enabled},stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
 const closed=new Promise<number|null>(resolve=>child.once('close',resolve));
 try{
  await new Promise<void>((resolve,reject)=>{
   const deadline=setTimeout(()=>reject(new Error('server did not become ready')),10000);
   child.stdout.on('data',()=>{if(stdout.includes('Pixoo simulator listening on http://127.0.0.1:')){clearTimeout(deadline);resolve();}});
   child.once('exit',()=>{clearTimeout(deadline);reject(new Error('server exited before readiness'));});
  });
  child.kill('SIGTERM');expect(await closed).toBe(0);
  expect(stdout.trim()).toMatch(/^Pixoo simulator listening on http:\/\/127\.0\.0\.1:\d+$/);
  const records=stderr.split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
  expect(records.map(record=>record.event_name)).toEqual(enabled==='1'?['process.started','process.stopped']:[]);
 }finally{child.kill('SIGKILL');await closed;await rm(root,{recursive:true,force:true});}
},15000);
