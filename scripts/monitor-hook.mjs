#!/usr/bin/env node
import {createReadStream} from 'node:fs';
import {request} from 'node:http';
// Source example, invoked explicitly. Never changes provider configuration.
const finish=()=>process.exit(0);
process.on('uncaughtException',finish);process.on('unhandledRejection',finish);
setTimeout(finish,Math.max(1,2900-performance.now()));
async function read(stream,maximum){
 const parts=[];let size=0;
 for await(const part of stream){size+=part.length;if(size>maximum){stream.destroy();throw new Error('limit');}parts.push(part);}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)));
}
try{
 if(process.argv.length!==3)finish();
 const config=await read(createReadStream(process.argv[2]),8192);
 if(!config||config.enabled!==true||config.qualified!==true||typeof config.token!=='string'||! /^[A-Za-z0-9_-]{43}$/.test(config.token))finish();
 if(Object.keys(config).some(key=>!['enabled','qualified','source','endpoint','token'].includes(key)))finish();
 const url=new URL(config.endpoint);
 if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||url.username||url.password||url.search||url.hash||url.pathname!=='/api/monitor/v1/events')finish();
 const {normalizeHook}=await import('@jimmie-potts/agent-state/providers');
 const event=normalizeHook(await read(process.stdin,65536),config.source,Date.now());if(!event)finish();
 const body=JSON.stringify(event);
 const outgoing=request(url,{method:'POST',agent:false,headers:{authorization:`Bearer ${config.token}`,'x-pixoo-request':'1','content-type':'application/json','content-length':Buffer.byteLength(body)}},response=>{response.destroy();outgoing.destroy();finish();});
 outgoing.on('error',finish);outgoing.end(body);
}catch{finish();}
