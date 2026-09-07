import {mkdir} from 'node:fs/promises';
import {privatePath} from './config.js';
import {provisionCredential,revokeCredential} from './mcp-config.js';
try{
 const [command,directory,id,access,...extra]=process.argv.slice(2);
 if(!directory||!id||extra.length||!['add','revoke'].includes(command??'')||(command==='add'&&!['read','control'].includes(access??''))||(command==='revoke'&&access))throw new Error();
 const path=await privatePath(directory);await mkdir(path,{recursive:true});
 if(command==='add')console.log(await provisionCredential(path,id,access==='control'?['read','control']:['read']));
 else{await revokeCredential(path,id);console.log('Credential revoked.');}
}catch{console.error('MCP credential operation failed. Usage: npm run mcp:credentials -- add <absolute-private-data-dir> <neutral-id> <read|control>, or revoke <absolute-private-data-dir> <neutral-id>.');process.exitCode=1;}
