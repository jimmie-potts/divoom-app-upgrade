import { createHash } from 'node:crypto';
import { createDeviceTransport } from '../packages/device/dist/http-transport.js';
import { HttpDeviceAdapter, SPIKE_PROFILE } from '@pixoo/device';
import { parseSpikeArgs, runSpike } from '../packages/device/dist/spike.js';
import { acquireDeviceOwner } from '../apps/server/dist/device-owner.js';

if (process.argv.includes('--help')) {
  console.log('Set PIXOO_DEVICE_IP explicitly. Use probe, static, gif, transitions, controls or reset. Mutations require --allow-display-change; transitions also require --confirm-prior-stages. See docs/protocol-spike.md.');
} else {
  let device;
  let release;
  const controller = new AbortController();
  const stop = () => { controller.abort(); device?.invalidateGeneration(); };
  try {
    const config = parseSpikeArgs(process.argv.slice(2), process.env);
    release = await acquireDeviceOwner(config.ip);
    const exchanges = [];
    const transport = createDeviceTransport(config.ip);
    device = new HttpDeviceAdapter({ ip: config.ip, profile: SPIKE_PROFILE }, async (body, signal) => {
      const request = { ...body };
      if (typeof request.PicData === 'string') {
        const bytes = Buffer.from(request.PicData, 'base64');
        request.PicData = { byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
      }
      const entry = { request, startedAtMs: performance.now(), completedAtMs: null, response: null, error: null };
      exchanges.push(entry);
      try {
        const response = await transport(body, signal);
        entry.response = Object.fromEntries(['error_code', 'PicId', 'SelectIndex', 'Brightness', 'LightSwitch']
          .filter(key => typeof response[key] === 'number').map(key => [key, response[key]]));
        return response;
      } catch (error) {
        entry.error = { code: error.code ?? 'transport-error', ...error.details };
        throw error;
      } finally { entry.completedAtMs = performance.now(); }
    });
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    const report = await runSpike(config.stage, device, undefined, controller.signal);
    console.log(JSON.stringify({ ...report, profile: SPIKE_PROFILE, exchanges }, null, 2));
    process.exitCode = report.status === 'http-complete-observation-pending' ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Device experiment failed'); process.exitCode = 1;
  } finally {
    try { await device?.close(); }
    finally { release?.(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
  }
}
