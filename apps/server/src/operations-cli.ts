import {LibraryError} from '@pixoo/library';
import {MediaError} from '@pixoo/media';
import {diagnosticsSchema} from '@pixoo/core';
import {backupData,restoreData,OperationsError} from './operations.js';

const usage='Usage: npm run backup -- <absolute-data-dir> <new-absolute-bundle-dir>\n       npm run restore -- <absolute-bundle-dir> <new-absolute-data-dir>\n       npm run diagnostics';
async function diagnostics():Promise<void>{
 try{
  const port=process.env.PIXOO_PORT??'8787';
  if(!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535)throw new Error();
  const response=await fetch(`http://127.0.0.1:${Number(port)}/api/diagnostics`,{signal:AbortSignal.timeout(5000),redirect:'error'});
  if(!response.ok||!response.body)throw new Error();
  let text='';
  for await(const chunk of response.body){text+=Buffer.from(chunk).toString('utf8');if(text.length>8192)throw new Error();}
  console.log(JSON.stringify(diagnosticsSchema.parse(JSON.parse(text)),null,2));
 }catch{throw new OperationsError('diagnostics-unavailable');}
}
try{
 const [command,source,destination,...extra]=process.argv.slice(2);
 if(command==='diagnostics'&&!source)await diagnostics();
 else if((command==='backup'||command==='restore')&&source&&destination&&!extra.length){
  if(command==='backup'){await backupData(source,destination);console.log('Backup verified. Keep this bundle private.');}
  else{await restoreData(source,destination);console.log('Restore verified. Set PIXOO_DATA_DIR to the new directory before startup.');}
 }else{console.error(usage);process.exitCode=1;}
}catch(error){
 const code=error instanceof OperationsError||error instanceof LibraryError||error instanceof MediaError?error.code:'storage-error';
 console.error(`Pixoo operation failed: ${code}`);process.exitCode=1;
}
