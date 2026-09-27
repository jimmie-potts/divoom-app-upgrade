import {expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import type {StepContext} from '../../scripts/verify/capture-steps.ts';

// A capture check must throw or reject on a mismatch. A predicate-style check
// that resolves `false` is not an assertion, so the step type refuses it; the
// typecheck fails if either line below stops being an error.
export function refusedChecks(t:StepContext):void {
 // @ts-expect-error A boolean result is not an assertion.
 void t.expect('predicate',async()=>t.page.getByText('Item 2 of 3').isVisible());
 // @ts-expect-error A synchronous boolean is not an assertion either.
 void t.expect('predicate',()=>false);
}

it('writes every capture check as a block that throws on a mismatch',async()=>{
 for(const file of ['scripts/verify/capture-steps.ts','scripts/verify/controls.ts']){
  const source=await readFile(file,'utf8');
  const checks=[...source.matchAll(/t\.expect\((?:`[^`]*`|'[^']*'),(.{0,12})/g)].map(match=>match[1]!);
  for(const opening of checks)expect(opening,file).toMatch(/^async\(\)=>\{/);
  if(file.endsWith('capture-steps.ts'))expect(checks.length).toBeGreaterThan(20);
 }
});
