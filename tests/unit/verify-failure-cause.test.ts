import {expect,it} from 'vitest';
import {failureCause} from '../../scripts/verify/readiness.ts';

// The core appends this line to a failed start's receipt. It must name known
// Pixoo start failures with fixed text and never echo stderr content.
it('names known start failures with fixed lines and returns nothing else',()=>{
 const guard=`node:internal/modules/esm/loader:123\nError: Pixoo transport guard: a verification run requires PIXOO_MODE=simulator\n    at file:///x/scripts/verify/transport-guard.ts:15:36`;
 expect(failureCause(guard)).toBe('pixoo-transport-guard: simulator mode required');
 expect(failureCause('Error: Pixoo transport guard: APP_VERIFY_TRANSPORT_LOG is required')).toBe('pixoo-transport-guard: transport log required');
 expect(failureCause('PIXOO_DATA_DIR must be outside source control\n')).toBe('pixoo-start-failed: data directory inside source control');
 expect(failureCause('listen EADDRINUSE: address already in use 127.0.0.1:40123\n')).toBe('pixoo-start-failed: port in use');
 expect(failureCause("ENOENT: no such file or directory, access '/home/owner/checkout/apps/web/dist/index.html'\n")).toBe('pixoo-start-failed: web build missing');
 for(const text of ['','Bearer AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcdefg','Startup failed','some other error at /home/owner/private'])expect(failureCause(text),text).toBeUndefined();
});

it('reports the latest known failure when stderr holds several',()=>{
 expect(failureCause('listen EADDRINUSE: address already in use 127.0.0.1:1\nPIXOO_DATA_DIR must be outside source control\n')).toBe('pixoo-start-failed: data directory inside source control');
});
