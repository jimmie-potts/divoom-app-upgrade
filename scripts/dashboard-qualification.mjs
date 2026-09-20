import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {FakeDeviceAdapter, HttpDeviceAdapter, SPIKE_PROFILE} from '@pixoo/device';
import {parseDashboardArgs, runDashboard} from '../packages/device/dist/dashboard-qualification.js';
import {dashboardCases, dashboardPreview} from '../packages/device/dist/dashboard-fixtures.js';
import {acquireDeviceOwner} from '../apps/server/dist/device-owner.js';
import {privatePath} from '../apps/server/dist/config.js';

if (process.argv.length===3 && process.argv[2]==='--help') {
  console.log('Offline default: --cadence-ms 3000 --duration-ms 15000 --preview /absolute/new-file.html. Physical: --device --allow-display-change --confirm-exclusive-writer --owner NAME --model Pixoo64 --firmware VERSION --source-revision SHA and PIXOO_DEVICE_IP. Method: frame only. Read docs/protocol-spike.md before physical execution.');
} else {
  let device,release;
  const controller=new AbortController();
  const stop=()=>controller.abort();
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try {
    const config=parseDashboardArgs(process.argv.slice(2),process.env);
    const events=dashboardCases();
    if (config.preview) await writeFile(await privatePath(config.preview),dashboardPreview(events),{flag:'wx',mode:0o600});
    let initialState=null;
    if (config.mode==='device') {
      const cwd=fileURLToPath(new URL('..',import.meta.url));
      const revision=execFileSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8'}).trim();
      const dirty=execFileSync('git',['status','--porcelain'],{cwd,encoding:'utf8'}).trim();
      if (revision!==config.sourceRevision || dirty) throw new Error('Physical execution requires the supplied source revision and a clean worktree');
      release=await acquireDeviceOwner(config.ip);
      device=new HttpDeviceAdapter({ip:config.ip,profile:SPIKE_PROFILE});
      const probe=await device.probe({generation:device.generation,timeoutMs:5000,signal:controller.signal});
      if (!probe.ok || probe.value.mode!=='device' || probe.value.brightness===undefined || probe.value.screenOn===undefined) throw new Error('Initial settings unknown; no dashboard upload attempted');
      initialState={channel:probe.value.channel,brightness:probe.value.brightness,screenOn:probe.value.screenOn};
    } else device=new FakeDeviceAdapter();
    const report=await runDashboard(device,events,config,controller.signal);
    console.log(JSON.stringify({...report,mode:config.mode,
      evidence:config.mode==='fake'?'simulator-only':'http-complete-observation-pending',initialState,
      ...(config.mode==='device'?{sourceRevision:config.sourceRevision}:{}),
      restoration:'Settings unchanged; original artwork cannot be restored; last sent content may remain.'},null,2));
    process.exitCode=['failed','cancelled'].includes(report.status)?1:0;
  } catch(error) {
    // No raw transport response, target or operator metadata in public receipts.
    console.error(error instanceof Error?error.message:'Qualification failed');process.exitCode=1;
  } finally {
    try {await device?.close?.();} finally {release?.();process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
  }
}
