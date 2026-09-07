import {test,expect} from '@playwright/test';
import sharp from 'sharp';
import {createServer,request as proxyRequest} from 'node:http';

test('library uploads an image and previews an immutable transform',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Library',exact:true}).click();
 const buffer=await sharp({create:{width:4,height:2,channels:3,background:'red'}}).png().toBuffer();
 await page.getByLabel('Upload media').setInputFiles({name:'ui-image.png',mimeType:'image/png',buffer});
 await expect(page.getByRole('heading',{name:'ui-image.png',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Media library',exact:true}).getByAltText('Effective preview')).toBeVisible();
 await expect(page.getByLabel('Fit',{exact:true})).toHaveValue('fit');
 await expect(page.getByLabel('Scaling')).toHaveValue('nearest');
 await page.getByLabel('Fit',{exact:true}).selectOption('crop');
 await page.getByRole('button',{name:'Render preview'}).click();
 await expect(page.getByText('Preview saved.',{exact:true})).toBeVisible();
});

test('playlist editor creates a named playlist with repeat and shuffle defaults',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Playlists',exact:true}).click();
 await page.getByLabel('New playlist name').fill('Evening UI');
 await page.getByRole('button',{name:'Create playlist'}).click();
 await expect(page.getByLabel('Playlist name',{exact:true})).toHaveValue('Evening UI');
 await expect(page.getByLabel('Repeat playlist',{exact:true})).toBeChecked();
 await expect(page.getByLabel('Shuffle',{exact:true})).not.toBeChecked();
});

test('player reports authoritative simulator state and supports clear session',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Player',exact:true}).click();
 await expect(page.getByText('Live state connected',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Clear session',exact:true}).click();
 await expect(page.getByText('No active session.',{exact:true})).toBeVisible();
});

test('settings save explicit configuration without connecting hardware',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByLabel('Device IP').fill('192.168.1.40');
 await page.getByLabel('Model observation').fill('Pixoo64');
 await page.getByRole('button',{name:'Save configuration'}).click();
 await expect(page.getByText('Configuration saved. Simulator remains active.',{exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Settings',exact:true}).click();
 await expect(page.getByLabel('Device IP')).toHaveValue('192.168.1.40');
 await expect(page.getByText('No physical display connected.',{exact:true})).toBeVisible();
});

test('mixed playlist journey preserves independent policies and saved session across refresh',async({page},info)=>{
 const {gifFixture}=await import('../helpers/media-fixtures.js');
 await page.goto('/');
 const buffer=await sharp({create:{width:5,height:3,channels:3,background:'blue'}}).png().toBuffer();
 await page.getByLabel('Upload media').setInputFiles({name:'journey-image.png',mimeType:'image/png',buffer});
 await expect(page.getByRole('heading',{name:'journey-image.png',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Use in playlist'}).click();
 const name=`Journey ${info.project.name}`;
 await page.getByLabel('New playlist name').fill(name);await page.getByRole('button',{name:'Create playlist'}).click();
 await page.getByRole('button',{name:'Add selected media'}).click();
 await expect(page.getByLabel('Item 1 seconds')).toHaveValue('30');
 await page.getByLabel('Item 1 seconds').fill('30');await page.getByRole('button',{name:'Save items',exact:true}).click();
 await expect(page.getByText('Playlist items saved.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Library',exact:true}).click();
 const gif=gifFixture(2,2,[{width:2,height:2,pixels:[1,2,3,0],delay:100},{width:2,height:2,pixels:[3,2,1,0],delay:100}]);
 await page.getByLabel('Upload media').setInputFiles({name:'journey.gif',mimeType:'image/gif',buffer:gif});
 await expect(page.getByRole('heading',{name:'journey.gif',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Use in playlist'}).click();await page.getByRole('button',{name:'Add selected media'}).click();
 await expect(page.getByLabel('Item 2 total plays')).toHaveValue('3');await page.getByLabel('Item 2 total plays').fill('3');
 await page.getByRole('button',{name:'Add selected media'}).click();await page.getByLabel('Item 3 timing mode').selectOption('duration');await page.getByLabel('Item 3 seconds').fill('8');
 await page.getByRole('button',{name:'Move item 2 up',exact:true}).focus();await page.keyboard.press('Enter');
 await expect(page.getByLabel('Item 1 total plays')).toHaveValue('3');await expect(page.getByLabel('Item 2 seconds')).toHaveValue('30');
 await page.getByRole('button',{name:'Save items',exact:true}).click();await expect(page.getByText('Playlist items saved.',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('playlist-editor.png'),fullPage:true});
 await page.getByRole('button',{name:'Player',exact:true}).click();await page.getByRole('button',{name:'Play playlist',exact:true}).click();
 await expect(page.getByText(/Playback: playing/)).toBeVisible();await expect(page.getByText(/Estimated remaining: [0-9]/)).toBeVisible();
 await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByText('Item 2 of 3',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Pause playlist',exact:true}).click();await expect(page.getByText(/Intent: paused/)).toBeVisible();
 await page.getByRole('button',{name:'Resume',exact:true}).click();await expect(page.getByText(/Intent: active/)).toBeVisible();
 await page.getByRole('button',{name:'Previous',exact:true}).click();await expect(page.getByText('Item 1 of 3',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Stop',exact:true}).click();await expect(page.getByText(/Intent: stopped/)).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Player',exact:true}).click();await expect(page.getByText(/Intent: stopped/)).toBeVisible();
 await page.getByRole('button',{name:'Playlists',exact:true}).click();await page.getByLabel('Open playlist',{exact:true}).selectOption({label:name});
 await expect(page.getByLabel('Item 1 total plays')).toHaveValue('3');await expect(page.getByLabel('Item 2 seconds')).toHaveValue('30');await expect(page.getByLabel('Item 3 seconds')).toHaveValue('8');
});

test('stale editor preserves draft and explicit reload reads the winning revision',async({page},info)=>{
 await page.goto('/');await page.getByRole('button',{name:'Playlists',exact:true}).click();
 const name=`Race ${info.project.name}`;await page.getByLabel('New playlist name').fill(name);await page.getByRole('button',{name:'Create playlist'}).click();
 await expect(page.getByLabel('Playlist name',{exact:true})).toHaveValue(name);
 const all=await (await page.request.get('/api/playlists')).json();const p=all.find((p:{name:string})=>p.name===name);
 const updated=await page.request.patch(`/api/playlists/${p.id}`,{headers:{'X-Pixoo-Request':'1'},data:{revision:p.revision,name:`${name} winner`}});expect(updated.status()).toBe(200);
 await page.getByLabel('Playlist name',{exact:true}).fill(`${name} draft`);await page.getByRole('button',{name:'Save name',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('changed in another window');await expect(page.getByLabel('Playlist name',{exact:true})).toHaveValue(`${name} draft`);
 await page.getByRole('button',{name:'Reload saved playlist'}).click();await expect(page.getByLabel('Playlist name',{exact:true})).toHaveValue(`${name} winner`);
});

test('lost command response retries the identical identity without a second effect',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Player',exact:true}).click();
 const bodies:unknown[]=[];
 await page.route('**/api/player/commands',async route=>{bodies.push(route.request().postDataJSON());await route.fetch();await route.abort('failed');});
 await page.getByRole('button',{name:'Stop',exact:true}).click();await expect(page.getByText(/Command outcome uncertain/)).toBeVisible();
 const first=await (await page.request.get('/api/player')).json();
 await page.unroute('**/api/player/commands');await page.route('**/api/player/commands',async route=>{bodies.push(route.request().postDataJSON());await route.continue();});
 await page.getByRole('button',{name:'Retry command',exact:true}).click();await expect(page.getByText(/Command outcome uncertain/)).toHaveCount(0);
 const after=await (await page.request.get('/api/player')).json();expect(bodies).toHaveLength(2);expect(bodies[0]).toEqual(bodies[1]);expect(after.player.generation).toBe(first.player.generation);
});

test('settings validate targets and screen on does not resume',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Device IP').fill('8.8.8.8');await page.getByRole('button',{name:'Save configuration'}).click();
 await expect(page.getByRole('alert')).toContainText('private IPv4');
 await page.getByRole('button',{name:'Screen off',exact:true}).click();await page.getByRole('button',{name:'Screen on',exact:true}).click();
 await page.getByRole('button',{name:'Player',exact:true}).click();await expect(page.getByText(/Intent: paused/)).toBeVisible();await expect(page.getByText('Requested screen: on',{exact:true})).toBeVisible();
});

test('stream reconnect keeps disconnection visible and reconciles without sending commands',async({page})=>{
 let connections=0,commands=0;const resumed:string[]=[];
 const fixture=createServer((incoming,outgoing)=>{
  if(incoming.url==='/api/events'){
   connections++;resumed.push(String(incoming.headers['last-event-id']??''));
   outgoing.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store'});
   outgoing.write(`retry: 1500\nid: browser-test:${connections}\nevent: state\ndata: {}\n\n`);
   if(connections===1)outgoing.end();
   return;
  }
  if(incoming.url==='/api/player/commands')commands++;
  const upstream=proxyRequest({hostname:'127.0.0.1',port:18787,path:incoming.url,method:incoming.method,headers:{...incoming.headers,host:'127.0.0.1:18787',...(incoming.headers.origin?{origin:'http://127.0.0.1:18787'}:{})}},response=>{
   const chunks:Buffer[]=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>{
    const send=()=>{outgoing.writeHead(response.statusCode??500,response.headers);outgoing.end(Buffer.concat(chunks));};
    if(incoming.url==='/api/player')setTimeout(send,250);else send();
   });
  });upstream.on('error',()=>{outgoing.writeHead(502);outgoing.end();});incoming.pipe(upstream);
 });
 await new Promise<void>(resolve=>fixture.listen(0,'127.0.0.1',resolve));const address=fixture.address();if(!address||typeof address==='string')throw new Error('No fixture address');
 try{
  await page.goto(`http://127.0.0.1:${address.port}`);await page.getByRole('button',{name:'Player',exact:true}).click();
  await expect(page.getByText('Live state disconnected. Reconnecting…',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Stop',exact:true})).toBeDisabled();
  await expect(page.getByText('Live state connected',{exact:true})).toBeVisible({timeout:10000});
  expect(resumed).toContain('browser-test:1');expect(commands).toBe(0);
 }finally{await page.goto('about:blank').catch(()=>{});fixture.closeAllConnections();await new Promise<void>(resolve=>fixture.close(()=>resolve()));}
});

test('invalid uploads show an actionable error and preserve the catalog',async({page})=>{
 await page.goto('/');const before=await (await page.request.get('/api/assets')).json();
 await page.getByLabel('Upload media').setInputFiles({name:'broken.gif',mimeType:'image/gif',buffer:Buffer.from('not an image')});
 await expect(page.getByRole('alert')).toContainText(/Choose a PNG|could not be decoded/);
 expect((await (await page.request.get('/api/assets')).json()).total).toBe(before.total);
});

test('saved edits require explicit restart and referenced media cannot be deleted',async({page},info)=>{
 await page.goto('/');const buffer=await sharp({create:{width:7,height:3,channels:3,background:'green'}}).png().toBuffer();
 await page.getByLabel('Upload media').setInputFiles({name:'retained-ui.png',mimeType:'image/png',buffer});await expect(page.getByRole('heading',{name:'retained-ui.png'})).toBeVisible();
 await page.getByRole('button',{name:'Use in playlist'}).click();await page.getByLabel('New playlist name').fill(`Retained ${info.project.name}`);await page.getByRole('button',{name:'Create playlist'}).click();await page.getByRole('button',{name:'Add selected media'}).click();await page.getByRole('button',{name:'Save items',exact:true}).click();await expect(page.getByText('Playlist items saved.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Player',exact:true}).click();await page.getByRole('button',{name:'Play playlist'}).click();await expect(page.getByText(/Playback: playing/)).toBeVisible();
 await page.getByRole('button',{name:'Playlists',exact:true}).click();await page.getByLabel('Item 1 seconds').fill('31');await page.getByRole('button',{name:'Save items',exact:true}).click();await expect(page.getByText('Playlist items saved.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Player',exact:true}).click();await expect(page.getByText(/Saved changes are waiting/)).toBeVisible();await page.getByRole('button',{name:'Restart with changes'}).click();await expect(page.getByText(/Saved changes are waiting/)).toHaveCount(0);
 await page.getByRole('button',{name:'Stop',exact:true}).click();await page.getByRole('button',{name:'Library',exact:true}).click();page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Delete media'}).click();await expect(page.getByRole('alert')).toContainText('used by a playlist or saved player session');
});

test('readiness refresh preserves selected playlist and unsaved draft',async({page},info)=>{
 await page.goto('/');await page.getByRole('button',{name:'Playlists',exact:true}).click();
 await page.getByLabel('New playlist name').fill(`Health ${info.project.name}`);await page.getByRole('button',{name:'Create playlist'}).click();
 await expect(page.getByLabel('Playlist name',{exact:true})).toHaveValue(`Health ${info.project.name}`);
 await page.getByLabel('Playlist name',{exact:true}).fill('Unsaved health draft');
 await page.getByRole('button',{name:'Refresh status',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Server ready');
 await page.getByRole('button',{name:'Playlists',exact:true}).click();await expect(page.getByLabel('Playlist name',{exact:true})).toHaveValue('Unsaved health draft');
});

test('readiness refresh preserves uncertain identity until exact retry',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Player',exact:true}).click();const bodies:unknown[]=[];
 await page.route('**/api/player/commands',async route=>{bodies.push(route.request().postDataJSON());await route.fetch();await route.abort('failed');});
 await page.getByRole('button',{name:'Stop',exact:true}).click();await expect(page.getByRole('button',{name:'Retry command',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Refresh status',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Server ready');
 await expect(page.getByRole('button',{name:'Retry command',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Player',exact:true}).click();await expect(page.getByRole('button',{name:'Stop',exact:true})).toBeDisabled();
 await page.unroute('**/api/player/commands');await page.route('**/api/player/commands',async route=>{bodies.push(route.request().postDataJSON());await route.continue();});
 await page.getByRole('button',{name:'Retry command',exact:true}).click();await expect(page.getByRole('button',{name:'Stop',exact:true})).toBeEnabled();expect(bodies).toHaveLength(2);expect(bodies[1]).toEqual(bodies[0]);
});
