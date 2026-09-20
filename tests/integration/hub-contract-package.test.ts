import {expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {validate,evaluate,type ReferenceInput} from '@jimmie-potts/device-contracts';
const root=fileURLToPath(new URL('../../',import.meta.url));
const directory=join(root,'node_modules/@jimmie-potts/device-contracts');
const corpus=JSON.parse(await readFile(join(directory,'fixtures/controller-v1.json'),'utf8')) as {schemaCases:{id:string;definition:string;value:unknown;valid:boolean}[];semanticCases:{id:string;input:ReferenceInput;expected:unknown}[]};
it('verifies the immutable released archive and every installed manifest hash',async()=>{
 const receipt=JSON.parse(await readFile(join(root,'vendor/device-contracts-1.0.0-receipt.json'),'utf8'));
 expect(receipt.sourceRevision).toBe('589846bcbe6a4a06ef6aaec9d2952c9f9d58dac3');
 expect(createHash('sha256').update(await readFile(join(root,'vendor',receipt.filename))).digest('hex')).toBe(receipt.sha256);
 const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
 for(const [path,hash]of Object.entries(manifest.files))expect(createHash('sha256').update(await readFile(join(directory,path))).digest('hex'),path).toBe(hash);
 expect(corpus.schemaCases.length+corpus.semanticCases.length).toBe(220);
});
for(const item of corpus.schemaCases)it(`shared schema ${item.id}`,()=>{expect(validate(item.definition,item.value)).toBe(item.valid);});
for(const item of corpus.semanticCases)it(`shared semantics ${item.id}`,()=>{const before=structuredClone(item.input);expect(evaluate(item.input)).toEqual(item.expected);expect(item.input).toEqual(before);});
