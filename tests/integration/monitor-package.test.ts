import {expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../node_modules/@jimmie-potts/agent-state/',import.meta.url));
it('consumes the verified release and its complete upstream Node conformance suite',async()=>{
 const archive=await readFile(new URL('../../vendor/jimmie-potts-agent-state-1.0.0.tgz',import.meta.url));
 expect(createHash('sha256').update(archive).digest('hex')).toBe('ae589d311e282c3356579c85507a3aa973ab7990e06e062143aeb08d8d2dcc99');
 const manifestBytes=await readFile(join(root,'manifest.json'));
 expect(createHash('sha256').update(manifestBytes).digest('hex')).toBe('1a85664c3f600ae2e50a80789264598ed6a11afcd0ca740b33d0fe4fbedfa834');
 const manifest=JSON.parse(manifestBytes.toString()) as {files:Record<string,string>};
 for(const [path,hash]of Object.entries(manifest.files))expect(createHash('sha256').update(await readFile(join(root,path))).digest('hex'),path).toBe(hash);
 for(const name of ['core','hook','migration','providers','snapshot','storage','subscriptions']){
  // Invoking each entry directly avoids Node test discovery excluding node_modules.
  const result=spawnSync(process.execPath,[join(root,'tests',name+'.test.mjs')],{encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
  expect(result.status,`${name}: ${result.stdout}\n${result.stderr}`).toBe(0);
 }
},60000);
