import {afterEach,describe,expect,it} from 'vitest';
import {mkdir,mkdtemp,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {assertPrivateDataDir,assertSeedable,launchSpec,transportLog} from '../../scripts/verify/run-environment.ts';

const cleanup:string[]=[];
afterEach(async()=>{await Promise.all(cleanup.splice(0).map(path=>rm(path,{recursive:true,force:true})));});
async function temporary(prefix:string){const path=await mkdtemp(join(tmpdir(),prefix));cleanup.push(path);return path;}
async function fakeCheckout(){const root=await temporary('verify-foreign-checkout-');await mkdir(join(root,'.git'));await writeFile(join(root,'.git','HEAD'),'ref: refs/heads/main\n');return root;}

describe('launch command',()=>{
 it('launches the built server through the transport guard with explicit simulator settings only',()=>{
  const spec=launchSpec({runtimeDir:'/state/pixoo-run',dataDir:'/state/pixoo-run/data',port:0,node:'/opt/node/bin/node'});
  expect(spec.argv).toEqual(['/opt/node/bin/node','--import',expect.stringMatching(/^file:.*\/scripts\/verify\/transport-guard\.ts$/),resolve('apps/server/dist/main.js')]);
  expect(spec.env).toEqual({PIXOO_MODE:'simulator',PIXOO_DATA_DIR:'/state/pixoo-run/data',PIXOO_PORT:'0',PIXOO_MONITOR_ENABLED:'1',APP_VERIFY_TRANSPORT_LOG:transportLog('/state/pixoo-run')});
  expect(spec.cwd).toBe(resolve('.'));
  expect(launchSpec({runtimeDir:'/state/r',dataDir:'/state/r/data',port:41705,node:'node'}).env.PIXOO_PORT).toBe('41705');
 });
 it('never binds an installed port',()=>{
  for(const port of [8787,8788,8765,8791,41230,41231])expect(()=>launchSpec({runtimeDir:'/state/r',dataDir:'/state/r/data',port,node:'node'})).toThrow(/installed port/);
 });
});

describe('private data directory',()=>{
 it('accepts a fresh directory outside every checkout',async()=>{
  const home=await temporary('verify-owner-home-'),data=join(await temporary('verify-state-'),'pixoo-20260927T000000Z-abcdef','data');
  await expect(assertPrivateDataDir(data,{home,ambient:{}})).resolves.toBe(data);
 });
 it('rejects relative, checkout and foreign-checkout paths including symlink aliases',async()=>{
  const home=await temporary('verify-owner-home-'),foreign=await fakeCheckout(),aliases=await temporary('verify-alias-');
  await symlink(foreign,join(aliases,'foreign'));await symlink(resolve('.'),join(aliases,'this-checkout'));
  for(const data of ['relative/data','',resolve('.local/verify-run/data'),join(foreign,'data'),join(aliases,'foreign','data'),join(aliases,'this-checkout','data')])
   await expect(assertPrivateDataDir(data,{home,ambient:{}}),data).rejects.toThrow(/absolute|source control/);
 });
 it('rejects the owner data and lock directories, their aliases, their ancestors and the ambient data directory',async()=>{
  const home=await temporary('verify-owner-home-'),owner=join(home,'.local','share','pixoo-playlist-controller'),elsewhere=await temporary('verify-ambient-');
  await mkdir(owner,{recursive:true});const aliases=await temporary('verify-alias-');await symlink(owner,join(aliases,'owner'));
  const cases=[owner,join(owner,'data'),join(home,'.local','share','pixoo-playlist-controller-device-locks','data'),join(aliases,'owner','data'),home,join(home,'.local'),join(elsewhere,'data'),elsewhere];
  for(const data of cases)await expect(assertPrivateDataDir(data,{home,ambient:{PIXOO_DATA_DIR:join(elsewhere,'data')}}),data).rejects.toThrow(/owner state/);
 });
});

describe('seedable data directory',()=>{
 it('accepts only an empty real directory',async()=>{
  const home=await temporary('verify-owner-home-'),state=await temporary('verify-state-');
  const empty=join(state,'empty');await mkdir(empty);
  await expect(assertSeedable(empty,{home,ambient:{}})).resolves.toBe(empty);
  const occupied=join(state,'occupied');await mkdir(occupied);await writeFile(join(occupied,'library.sqlite'),'');
  await expect(assertSeedable(occupied,{home,ambient:{}})).rejects.toThrow(/occupied/);
  const target=join(state,'elsewhere');await mkdir(target);const planted=join(state,'planted');await symlink(target,planted);
  await expect(assertSeedable(planted,{home,ambient:{}})).rejects.toThrow(/occupied/);
 });
});
