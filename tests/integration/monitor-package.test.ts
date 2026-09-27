import {expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../node_modules/@jimmie-potts/agent-state/',import.meta.url));
it('consumes the verified release and its complete upstream Node conformance suite',async()=>{
 const receipt=JSON.parse(await readFile(new URL('../../vendor/agent-state-3.3.0-source-receipt.json',import.meta.url),'utf8'));
 expect(receipt).toMatchObject({artifact:'@jimmie-potts/agent-state',version:'3.3.0',sourceRevision:'9d0b78d8f89ab8911339ac982a6dd02357e93843',sha256:'b539d5296a627dece9da4f9a3713e288c3f2247c84a8e2179ff13cbcec70bd7d',apiVersions:['1.0','1.1','1.2']});
 const archive=await readFile(new URL('../../vendor/jimmie-potts-agent-state-3.3.0.tgz',import.meta.url));
 expect(createHash('sha256').update(archive).digest('hex')).toBe('b539d5296a627dece9da4f9a3713e288c3f2247c84a8e2179ff13cbcec70bd7d');
 const manifestBytes=await readFile(join(root,'manifest.json'));
 expect(createHash('sha256').update(manifestBytes).digest('hex')).toBe('f6609c0ece30edf0c2f1c8d2a81d2cde3877eb0338102b36658a64e6b47c7433');
 const manifest=JSON.parse(manifestBytes.toString()) as {files:Record<string,string>};
 for(const [path,hash]of Object.entries(manifest.files))expect(createHash('sha256').update(await readFile(join(root,path))).digest('hex'),path).toBe(hash);
 for(const name of ['approvals','core','current-status','hook','metadata','migration','provider-metadata','providers','retention','session-retirement','snapshot','storage','subscriptions']){
  // Invoking each entry directly avoids Node test discovery excluding node_modules.
  const result=spawnSync(process.execPath,[join(root,'tests',name+'.test.mjs')],{encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
  expect(result.status,`${name}: ${result.stdout}\n${result.stderr}`).toBe(0);
 }
},60000);
