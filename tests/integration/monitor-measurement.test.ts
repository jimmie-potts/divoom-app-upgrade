import {expect,it} from 'vitest';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
it('returns a failed measurement receipt when the hook process cannot spawn',()=>{
 const preload=`import {createRequire,syncBuiltinESMExports} from 'node:module';import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';const require=createRequire(import.meta.url);require('node:child_process').spawn=()=>{const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>false;process.nextTick(()=>child.emit('error',Object.assign(new Error('spawn failed'),{code:'EAGAIN'})));return child;};syncBuiltinESMExports();`;
 // createRequire needs a file URL even though the preload itself uses a data URL.
 const mock=preload.replace('createRequire(import.meta.url)',`createRequire(${JSON.stringify(import.meta.url)})`);
 const result=spawnSync(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(mock),fileURLToPath(new URL('../../scripts/measure-monitor.mjs',import.meta.url))],{encoding:'utf8',timeout:10000});
 expect(result.error).toBeUndefined();expect(result.status).toBe(1);
 expect(JSON.parse(result.stdout)).toMatchObject({passed:false,failure:'measurement-failed',profiles:[]});
},15000);
