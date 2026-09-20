import {afterEach,expect,it} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {HttpDeviceAdapter,SPIKE_PROFILE} from '../../packages/device/src/http-adapter.js';
import {runDashboard} from '../../packages/device/src/dashboard-qualification.js';
import {dashboardCases} from '../../packages/device/src/dashboard-fixtures.js';
import {acquireDeviceOwner} from '../../apps/server/src/device-owner.js';
const cleanup:(()=>Promise<unknown>|void)[]=[];
afterEach(async()=>{for(const close of cleanup.splice(0).reverse())await close();});

it('sends complete frame bytes through the existing queue and retains uncertain failure',async()=>{
  const requests:Record<string,unknown>[]=[];
  const device=new HttpDeviceAdapter({ip:'192.168.1.2',profile:SPIKE_PROFILE},async body=>{
    requests.push(body);
    if(body.Command==='Draw/SendHttpGif')throw new Error('uncertain send');
    return {error_code:0,PicId:3};
  });
  cleanup.push(()=>device.close());
  const cases=dashboardCases();
  const report=await runDashboard(device,cases,{cadenceMs:1000,durationMs:1000});
  expect(report).toMatchObject({status:'failed',uploads:[{result:{ok:false,priorEffects:'possible'}}]});
  expect(requests.map(item=>item.Command)).toEqual(['Draw/GetHttpGifId','Draw/SendHttpGif']);
  expect(requests[1]).toMatchObject({PicID:3,PicNum:1,PicOffset:0,PicWidth:64,PicSpeed:500});
  expect(Buffer.from(requests[1]!.PicData as string,'base64')).toEqual(Buffer.from(cases[0]!.rgb));
});
it('legacy protocol CLI refuses the backend target lock without contacting hardware',async()=>{
  const home=await mkdtemp(join(tmpdir(),'pixoo-dashboard-owner-'));cleanup.push(()=>rm(home,{recursive:true,force:true}));
  const directory=process.platform==='win32'?join(home,'AppData','Local','PixooPlaylistControllerDeviceLocks'):join(home,'.local','share','pixoo-playlist-controller-device-locks');
  const release=await acquireDeviceOwner('192.168.1.2',directory);cleanup.push(release);
  const env={...process.env,HOME:home,USERPROFILE:home,PIXOO_DEVICE_IP:'192.168.1.2'};
  await expect(promisify(execFile)(process.execPath,['scripts/device-spike.mjs','static','--allow-display-change'],{env})).rejects.toMatchObject({code:1,stderr:expect.stringContaining('busy')});
  release();
  const next=await acquireDeviceOwner('192.168.1.2',directory);next();
});
