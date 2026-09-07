import multipart from '@fastify/multipart';
import type {FastifyInstance} from 'fastify';
import type {Library} from '@pixoo/library';
import {SIMULATOR_PROFILE,type MediaProfile} from '@pixoo/media';
import {apiId,apiHash,apiName,playlistCreate,playlistRename,playlistOptions,playlistItems,playlistOrder,expectedRevision,assetQuery,renditionRequest} from '@pixoo/core';
import {parse} from './validation.js';
import {ApiError} from './security.js';
type Id={Params:{id:string}};
export async function catalogRoutes(app:FastifyInstance,library:Library,profile:MediaProfile=SIMULATOR_PROFILE):Promise<void> {
 await app.register(multipart,{limits:{fileSize:10*1024*1024,files:1,fields:0,parts:1,fieldNameSize:40,headerPairs:20}});
 let mediaRequests=0;
 async function media<T>(work:()=>Promise<T>):Promise<T>{if(mediaRequests>=4)throw new ApiError('busy',503);mediaRequests++;try{return await work();}finally{mediaRequests--;}}
 app.get('/api/assets',async request=>{
  const {offset,limit,q}=parse(assetQuery,request.query);
  const assets=(await library.listAssets()).filter(asset=>asset.name.toLocaleLowerCase().includes(q.toLocaleLowerCase()));
  return {items:assets.slice(offset,offset+limit),total:assets.length,offset,limit};
 });
 app.post('/api/assets',async(request,reply)=>media(async()=>{
  let bytes:Buffer|undefined,name:string|undefined;
  for await(const part of request.parts()){
   if(part.type!=='file'||part.fieldname!=='file'||bytes)throw new ApiError('invalid-input');
   name=parse(apiName,part.filename);bytes=await part.toBuffer();
  }
  if(!bytes||!name)throw new ApiError('invalid-input');
  const input=bytes;async function* stream(){yield input;}
  const result=await library.importMedia(stream(),name,{profile});reply.code(201);return result;
 }));
 app.get<Id>('/api/assets/:id',async request=>{const id=parse(apiId,request.params.id);return {asset:await library.getAsset(id),renditions:await library.listRenditions(id)};});
 app.post<Id>('/api/assets/:id/renditions',async request=>media(async()=>{
  const id=parse(apiId,request.params.id),options=parse(renditionRequest,request.body);
  return {status:'complete',...await library.renderAsset(id,{profile,...(options.transform?{transform:options.transform}:{})})};
 }));
 app.delete<Id>('/api/assets/:id',async(request,reply)=>{await library.deleteAsset(parse(apiId,request.params.id));return reply.code(204).send();});
 app.get<Id>('/api/renditions/:id',request=>library.getRendition(parse(apiHash,request.params.id)));
 app.get<{Params:{id:string;index:string}}>('/api/renditions/:id/frames/:index.png',async(request,reply)=>{
  const id=parse(apiHash,request.params.id),index=request.params.index;
  if(!/^(0|[1-9][0-9]{0,2})$/.test(index))throw new ApiError('invalid-input');
  return reply.type('image/png').send(await library.readFrame(id,Number(index),'png'));
 });
 app.get('/api/playlists',()=>library.listPlaylists());
 app.post('/api/playlists',async(request,reply)=>{const {name,...options}=parse(playlistCreate,request.body);reply.code(201);return library.createPlaylist(name,options);});
 app.get<Id>('/api/playlists/:id',request=>library.getPlaylist(parse(apiId,request.params.id)));
 app.patch<Id>('/api/playlists/:id',request=>{const body=parse(playlistRename,request.body);return library.renamePlaylist(parse(apiId,request.params.id),body.revision,body.name);});
 app.patch<Id>('/api/playlists/:id/options',request=>{const {revision,...options}=parse(playlistOptions,request.body);return library.setPlaylistOptions(parse(apiId,request.params.id),revision,options);});
 app.put<Id>('/api/playlists/:id/items',request=>{const body=parse(playlistItems,request.body);return library.replaceItems(parse(apiId,request.params.id),body.revision,body.items);});
 app.put<Id>('/api/playlists/:id/order',request=>{const body=parse(playlistOrder,request.body);return library.reorderItems(parse(apiId,request.params.id),body.revision,body.itemIds);});
 app.post<Id>('/api/playlists/:id/duplicate',async(request,reply)=>{const body=parse(playlistRename,request.body);reply.code(201);return library.duplicatePlaylist(parse(apiId,request.params.id),body.revision,body.name);});
 app.delete<Id>('/api/playlists/:id',async(request,reply)=>{const body=parse(expectedRevision,request.body);await library.deletePlaylist(parse(apiId,request.params.id),body.revision);return reply.code(204).send();});
}
