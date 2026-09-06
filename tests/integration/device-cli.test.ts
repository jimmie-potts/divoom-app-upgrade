import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
const exec = promisify(execFile);
it('shows help without configuration and rejects a mutation before any device setup', async () => {
  const env = { ...process.env, PIXOO_DEVICE_IP: '' };
  const help = await exec(process.execPath, ['scripts/device-spike.mjs', '--help'], { env });
  expect(help.stdout).toContain('--allow-display-change');
  await expect(exec(process.execPath, ['scripts/device-spike.mjs', 'static'], { env })).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('--allow-display-change') });
  await expect(exec(process.execPath, ['scripts/device-spike.mjs', 'probe'], { env })).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('PIXOO_DEVICE_IP') });
});
