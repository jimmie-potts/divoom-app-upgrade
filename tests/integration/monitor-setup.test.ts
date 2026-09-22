import {expect, it} from 'vitest';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createApp} from '../../apps/server/src/app.js';
import {provisionCredential} from '../../apps/server/src/mcp-config.js';

// The shared SDK supports Linux/WSL. A skip is not native Windows qualification.
it.skipIf(process.platform !== 'linux')('rehearses shared setup and removal with the real Pixoo simulator', async () => {
 const {planSetup, applySetup, inspectSetup, planRemoval, removeSetup, producerPrincipal} = await import('@jimmie-potts/hub/setup');
 const {pixooSetupAuthority} = await import('@jimmie-potts/hub/setup-authority');
 const root = await mkdtemp(join(tmpdir(), 'pixoo-setup-'));
 const data = join(root, 'data'), monitor = join(data, 'agent-monitor');
 const app = createApp({dataDir: data, monitorEnabled: true});
 const write = (path: string, value: unknown) => writeFile(path, JSON.stringify(value), {mode: 0o600});
 try {
  await mkdir(data, {mode: 0o700}); await mkdir(monitor, {mode: 0o700});
  await write(join(monitor, 'config.json'), {version: 1, mode: 'embedded', ownerId: 'fixture-owner', consumers: [{id: 'pixoo', clearOnNewTurn: true}]});
  await provisionCredential(monitor, 'fixture-reader', ['read']);
  const address = await app.listen({host: '127.0.0.1', port: 0});
  const hook = createRequire(import.meta.url).resolve('@jimmie-potts/hub/monitor-hook');
  const authority = pixooSetupAuthority({dataDirectory: data, endpoint: address + '/api/monitor/v1', node: process.execPath, managementEntrypoint: resolve('apps/server/dist/monitor-cli.js')});
  const legacy = {hooks: [{type: 'command', command: 'legacy-nanoleaf-fixture'}]};
  for (const [provider, qualified] of [['codex', true], ['claude', true], ['codex', false]] as const) {
   const sourceId = provider + (qualified ? '-qualified' : '-disabled');
   const directory = join(root, sourceId); await mkdir(directory, {mode: 0o700});
   const target = join(directory, 'settings.json');
   await write(target, {permissions: {mode: 'unchanged'}, hooks: {Stop: [legacy]}});
   const input = {directory, target, source: {provider, client: provider === 'codex' ? 'cli' as const : 'code' as const, hostId: 'fixture-host', sourceId, hook: 'SessionStart' as const}, endpoint: address + '/api/monitor/v1/events', node: process.execPath, hook, owner: 'fixture-owner', qualified, credentialFile: join(directory, 'token')};
   const token = await provisionCredential(monitor, producerPrincipal(input), ['read', 'control']);
   await writeFile(input.credentialFile, token, {mode: 0o600});
   const stale = await planSetup(input);
   await write(target, {permissions: {mode: 'unchanged'}, hooks: {Stop: [legacy]}, additional: 'preserve'});
   const edited = await readFile(target, 'utf8');
   await expect(applySetup(input, stale.digest, authority)).rejects.toThrow('configuration-changed');
   expect(await readFile(target, 'utf8')).toBe(edited);
   await applySetup(input, (await planSetup(input)).digest, authority);
   const installed = await readFile(target, 'utf8');
   await applySetup(input, (await planSetup(input)).digest, authority);
   expect(await readFile(target, 'utf8')).toBe(installed);
   expect(await inspectSetup(directory)).toMatchObject({state: 'installed', enabled: input.qualified});
   const settings = JSON.parse(installed);
   expect(settings.hooks.Stop).toHaveLength(2);
   expect(await readFile(join(directory, 'configuration-backup.json'), 'utf8')).toBe(edited);
   const emit = () => new Promise<{code: number | null; output: string}>((done, reject) => {
    const child = spawn(process.execPath, [hook, join(directory, 'producer.json')], {env: {}, stdio: ['pipe', 'pipe', 'pipe']});
    let output = ''; child.stdout.on('data', bytes => {output += bytes;}); child.stderr.on('data', bytes => {output += bytes;});
    child.once('error', reject); child.once('close', code => done({code, output}));
    child.stdin.end(JSON.stringify({hook_event_name: 'Stop', session_id: sourceId, turn_id: 'turn', prompt: 'PRIVATE_CANARY', transcript: 'PRIVATE_CANARY', tool_input: 'PRIVATE_CANARY', title: 'PRIVATE_CANARY'}));
   });
   expect(await emit()).toEqual({code: 0, output: ''});
   const snapshot = await fetch(address + '/api/monitor/v1/sessions', {headers: {authorization: 'Bearer ' + token}}).then(r => r.text());
   expect(snapshot).not.toContain('PRIVATE_CANARY');
   expect(JSON.parse(snapshot).snapshot.sessions.some((s: {identity: {sessionId: string}}) => s.identity.sessionId === sourceId)).toBe(input.qualified);
   settings.hooks.Stop.push({hooks: [{type: 'command', command: 'later-unrelated-fixture'}]});
   settings.additional = 'latest'; await write(target, settings);
   await removeSetup(directory, (await planRemoval(directory)).digest, authority);
   await removeSetup(directory, (await planRemoval(directory)).digest, authority);
   const remaining = JSON.parse(await readFile(target, 'utf8'));
   expect(remaining).toEqual({permissions: {mode: 'unchanged'}, additional: 'latest', hooks: {Stop: [legacy, {hooks: [{type: 'command', command: 'later-unrelated-fixture'}]}]}});
   expect(await inspectSetup(directory)).toMatchObject({state: 'removed', enabled: false});
   expect((await fetch(address + '/api/monitor/v1/sessions', {headers: {authorization: 'Bearer ' + token}})).status).toBe(401);
   expect(await emit()).toEqual({code: 0, output: ''});
  }
  expect(await fetch(address + '/api/health').then(r => r.json())).toMatchObject({mode: 'simulator', device: {connected: false}});
 } finally {await app.close(); await rm(root, {recursive: true, force: true});}
}, 30000);
