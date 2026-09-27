import {expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,readdir,realpath} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RECEIPT_VERSION,VERSION,definePlugin,runCaptureStep,runCli,validateReceipt} from '@jimmie-potts/app-verify';

// The shared verification core is vendored from its Hub release
// (app-verify-v1.1.0). Pin the archive, its source receipt and every installed
// file, so a changed or partially installed core fails before a run uses it.
const root=fileURLToPath(new URL('../../',import.meta.url));
const installed=join(root,'node_modules','@jimmie-potts','app-verify');
const archive='jimmie-potts-app-verify-1.1.0.tgz';
const digest='1a0447ec6324f815bc89c3f671207ef452cde120c329b5318fd68711e06a3281';
const sha256=(bytes:Uint8Array):string=>createHash('sha256').update(bytes).digest('hex');

async function inventory(directory:string,prefix=''):Promise<string[]> {
 const result:string[]=[];
 for(const entry of await readdir(join(directory,prefix),{withFileTypes:true})){
  if(!prefix&&entry.name==='node_modules'&&entry.isDirectory())continue;
  const relative=prefix?`${prefix}/${entry.name}`:entry.name;
  if(entry.isDirectory())result.push(...await inventory(directory,relative));
  else{expect(entry.isFile(),`Unexpected package entry: ${relative}`).toBe(true);result.push(relative);}
 }
 return result.sort();
}

it('verifies the released app-verify archive, source receipt and installed inventory',async()=>{
 const receipt=JSON.parse(await readFile(join(root,'vendor','app-verify-1.1.0-source-receipt.json'),'utf8')) as Record<string,unknown>;
 expect(receipt).toMatchObject({
  artifact:'@jimmie-potts/app-verify',version:'1.1.0',filename:archive,sha256:digest,
  sourceRevision:'917d06f75bfe91dd161024a51c0582b5b7ceccde',reviewedHead:'213fe4168bb4be7374d3407ced8231fffe18910e',
  pr:'https://github.com/jimmie-potts/agent-device-hub/pull/554',issue:'https://github.com/jimmie-potts/agent-device-hub/issues/495',
 });
 expect(sha256(await readFile(join(root,'vendor',archive)))).toBe(digest);
 expect(await readFile(join(root,'vendor',`${archive}.sha256`),'utf8')).toBe(`${digest}  ${archive}\n`);
 const importedUrl=execFileSync(process.execPath,['--input-type=module','-e','process.stdout.write(import.meta.resolve("@jimmie-potts/app-verify"))'],{cwd:root,encoding:'utf8'});
 expect(await realpath(dirname(dirname(fileURLToPath(importedUrl))))).toBe(await realpath(installed));
 const manifestBytes=await readFile(join(installed,'manifest.json'));
 expect(sha256(manifestBytes)).toBe('caf073e7e78ceabc18c41f9a646e3b2923c43d3e564870c011ab5a689e48f1cb');
 const manifest=JSON.parse(manifestBytes.toString('utf8')) as {artifact:string;version:string;receiptVersion:string;files:Record<string,string>};
 expect(manifest).toMatchObject({artifact:'@jimmie-potts/app-verify',version:'1.1.0',receiptVersion:'app-verification/1'});
 expect(await inventory(installed)).toEqual([...Object.keys(manifest.files),'manifest.json'].sort());
 for(const [name,expected] of Object.entries(manifest.files))expect(sha256(await readFile(join(installed,name))),name).toBe(expected);
 expect([VERSION,RECEIPT_VERSION]).toEqual(['1.1.0','app-verification/1']);
 expect([typeof runCli,typeof runCaptureStep,typeof definePlugin,validateReceipt({}).ok]).toEqual(['function','function','function',false]);
});
