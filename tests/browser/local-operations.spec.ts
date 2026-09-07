import {test,expect} from '@playwright/test';
import sharp from 'sharp';

test('backend advances a playlist after the browser page closes',async({page,request})=>{
 const headers={'x-pixoo-request':'1'};
 const png=await sharp({create:{width:1,height:1,channels:3,background:'blue'}}).png().toBuffer();
 const upload=await request.post('/api/assets',{headers,multipart:{file:{name:'browser-lifetime.png',mimeType:'image/png',buffer:png}}});expect(upload.status()).toBe(201);
 const media=await upload.json();
 const created=await request.post('/api/playlists',{headers,data:{name:'Browser lifetime',repeat:false}});expect(created.ok()).toBe(true);
 const playlist=await created.json();
 const edited=await request.put(`/api/playlists/${playlist.id}/items`,{headers,data:{revision:1,items:[2000,100].map(durationMs=>({renditionId:media.rendition.id,playback:{mode:'duration',durationMs}}))}});expect(edited.ok()).toBe(true);
 const items=(await edited.json()).items;
 try{
  await page.goto('/');
  await page.getByRole('button',{name:'Player',exact:true}).click();
  await expect(page.getByText('Live state connected',{exact:true})).toBeVisible();
  const status=await page.evaluate(async playlistId=>{
   const state=await(await fetch('/api/player')).json();
   return (await fetch('/api/player/commands',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({command:'start',playlistId,requestId:state.nextRequestId})})).status;
  },playlist.id);expect(status).toBe(200);
  await expect.poll(async()=>(await(await request.get('/api/player')).json()).player.state).toBe('playing');
  await page.close();
  await expect.poll(async()=>(await(await request.get('/api/player')).json()).player,{timeout:10000}).toMatchObject({state:'idle',intent:'stopped',itemId:items[1].id});
 }finally{
  const state=await(await request.get('/api/player')).json();
  await request.post('/api/player/commands',{headers,data:{command:'clear',requestId:state.nextRequestId}});
 }
});
