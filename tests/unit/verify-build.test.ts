import {expect,it} from 'vitest';
import {buildFailure,runBuild} from '../../scripts/verify/build.ts';

// The core writes a prepare failure into the receipt, events and result line,
// so the message is fixed text and never carries build output.
it('reports a failed build with a fixed line that never echoes its output',async()=>{
 const noisy=`process.stdout.write('token sk-FAKE-TOKEN-1234\\n');process.stderr.write('private detail sk-FAKE-TOKEN-1234 at /home/owner/private/app.ts:3\\n');process.exit(2)`;
 const failure=await runBuild(process.cwd(),AbortSignal.timeout(10000),[process.execPath,'-e',noisy]).then(()=>undefined,(error:unknown)=>error as Error);
 expect(failure?.message).toBe('npm run build exited 2; run it in the checkout to see why');
 expect(failure?.message).not.toMatch(/sk-FAKE|\/home\/owner/);
 await expect(runBuild(process.cwd(),AbortSignal.timeout(10000),[process.execPath,'-e','process.exit(0)'])).resolves.toBeUndefined();
 expect(buildFailure(null,'SIGTERM')).toBe('npm run build ended by SIGTERM; run it in the checkout to see why');
 const missing=await runBuild(process.cwd(),AbortSignal.timeout(10000),['/nonexistent/private/npm-token-abc']).then(()=>undefined,(error:unknown)=>error as Error);
 expect(missing?.message).toBe('npm run build could not start');
});
