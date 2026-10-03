import {expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {validateInstallReceipt} from '@jimmie-potts/install-contracts';

const root=fileURLToPath(new URL('../../',import.meta.url));
const directory=join(root,'node_modules/@jimmie-potts/install-contracts');
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const corpus=JSON.parse(await readFile(join(directory,'fixtures/install-receipt-v1.json'),'utf8')) as {cases:{id:string;value:unknown;valid:boolean}[]};

it('pins the released installer contract without replacing the controller contract',async()=>{
 const receipt=JSON.parse(await readFile(join(root,'vendor/device-contracts-1.2.0-receipt.json'),'utf8'));
 expect(receipt.sourceRevision).toBe('96710bba52054c381035a6afabe8348d2b9bbd93');
 expect(receipt.sha256).toBe('f05b326b88833086abf1af596569448e409645486e7bef482f74e9a6998ced7e');
 expect(hash(await readFile(join(root,'vendor',receipt.filename)))).toBe(receipt.sha256);
 const bytes=await readFile(join(directory,'manifest.json'));
 expect(hash(bytes)).toBe(receipt.manifestSha256);
 const manifest=JSON.parse(bytes.toString()) as {files:Record<string,string>};
 for(const [path,expected] of Object.entries(manifest.files))expect(hash(await readFile(join(directory,path))),path).toBe(expected);
 expect(corpus.cases).toHaveLength(80);
 const controller=JSON.parse(await readFile(join(root,'node_modules/@jimmie-potts/device-contracts/package.json'),'utf8'));
 expect(controller.version).toBe('1.0.0');
});

for(const item of corpus.cases)it(`installer receipt semantics: ${item.id}`,()=>{
 const before=structuredClone(item.value);
 expect(validateInstallReceipt(item.value)).toBe(item.valid);
 expect(item.value).toEqual(before);
});
