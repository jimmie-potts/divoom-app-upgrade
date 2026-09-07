import {expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {verifyArchiveChecksum,verifyInstalledMcpPackage,MCP_PROTOCOL_VERSIONS} from '@jimmie-potts/device-mcp';
it('verifies the pinned shared archive, installed inventory and qualification receipt',async()=>{
 const root=fileURLToPath(new URL('../../',import.meta.url));
 const receipt=JSON.parse(await readFile(resolve(root,'vendor/device-mcp-1.0.0-receipt.json'),'utf8'));
 await verifyArchiveChecksum(resolve(root,'vendor',receipt.filename),receipt.sha256);
 await verifyInstalledMcpPackage(resolve(root,'node_modules/@jimmie-potts/device-mcp'));
 expect(receipt.protocolVersions).toEqual([...MCP_PROTOCOL_VERSIONS]);
 expect(receipt.sdk).toEqual({name:'@modelcontextprotocol/sdk',version:'1.30.0',license:'MIT'});
});
