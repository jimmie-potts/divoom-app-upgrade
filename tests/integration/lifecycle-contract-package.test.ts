import { expect, it } from 'vitest';
import { validateEvent } from '@jimmie-potts/agent-lifecycle-contracts';

it('rejects unsupported monitoring versions without echoing private content', () => {
  expect(validateEvent({ apiVersion: 'future', prompt: 'private-content-sentinel' }))
    .toEqual({ ok: false, code: 'invalid-event' });
});

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_VERSION, ARTIFACT_VERSION, deduplicationKey } from '@jimmie-potts/agent-lifecycle-contracts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const installed = join(root, 'node_modules', '@jimmie-potts', 'agent-lifecycle-contracts');
const archive = 'jimmie-potts-agent-lifecycle-contracts-1.1.0.tgz';
const digest = '3afd731d76c8bac66ce14d7210e606771f249f75e76edd8bc9a9ec76815c5d35';
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

async function inventory(directory: string, prefix = ''): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    // npm may nest lockfile-verified dependencies here; they are not archive files.
    if (!prefix && entry.name === 'node_modules' && entry.isDirectory()) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await inventory(directory, relative));
    else {
      expect(entry.isFile(), `Unexpected package entry: ${relative}`).toBe(true);
      result.push(relative);
    }
  }
  return result.sort();
}

it('verifies the released archive, source receipt and installed inventory', async () => {
  const receipt = JSON.parse(await readFile(join(root, 'vendor', 'agent-lifecycle-contracts-1.1.0-source-receipt.json'), 'utf8')) as Record<string, unknown>;
  expect(receipt).toMatchObject({
    artifact: '@jimmie-potts/agent-lifecycle-contracts', version: '1.1.0', apiVersions: ['1.0','1.1'],
    filename: archive, sha256: digest, sourceRevision: '9d0b78d8f89ab8911339ac982a6dd02357e93843',
    reviewedHead: '3bc2e0c408bee9bf89e8c03cfbf330e58abb39e1',
    pr: 'https://github.com/jimmie-potts/agent-device-hub/pull/452',
  });
  expect(sha256(await readFile(join(root, 'vendor', archive)))).toBe(digest);
  const importedUrl = execFileSync(process.execPath, ['--input-type=module', '-e',
    'process.stdout.write(import.meta.resolve("@jimmie-potts/agent-lifecycle-contracts"))'], { cwd: root, encoding: 'utf8' });
  const importedRoot = dirname(dirname(fileURLToPath(importedUrl)));
  expect(await realpath(importedRoot)).toBe(await realpath(installed));
  expect(await realpath(installed)).toBe(installed);
  const manifestBytes = await readFile(join(installed, 'manifest.json'));
  expect(sha256(manifestBytes)).toBe('b4d86c76f1293b6410d5e452d7b1925e86fea785ff27cbfbe8a536ea34fb2d6d');
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as { files: Record<string, string> };
  expect(manifest).toMatchObject({
    artifact: '@jimmie-potts/agent-lifecycle-contracts', version: ARTIFACT_VERSION,
    apiVersion: API_VERSION, schemaDraft: '2020-12', fixtureFormat: 1,
  });
  expect(ARTIFACT_VERSION).toBe('1.1.0');
  expect(API_VERSION).toBe('1.0');
  expect(Object.keys(manifest.files)).toEqual(expect.arrayContaining([
    'schemas/lifecycle-v1.schema.json', 'fixtures/lifecycle-v1.json', 'provider-qualification.md', 'dist/index.js',
  ]));
  expect(await inventory(installed)).toEqual([...Object.keys(manifest.files), 'manifest.json'].sort());
  for (const [name, expected] of Object.entries(manifest.files)) {
    expect(sha256(await readFile(join(installed, name))), name).toBe(expected);
  }
});

it('consumes every released lifecycle fixture and deduplication result', async () => {
  type Fixture = { id: string; input: unknown; valid: boolean; deduplication?: { kind: 'native' | 'content'; key: string } };
  const corpus = JSON.parse(await readFile(join(installed, 'fixtures', 'lifecycle-v1.json'), 'utf8')) as { format: number; apiVersion: string; cases: Fixture[] };
  expect(corpus.format).toBe(1);
  expect(corpus.apiVersion).toBe(API_VERSION);
  expect(corpus.cases).toHaveLength(81);
  expect(new Set(corpus.cases.map((fixture) => fixture.id)).size).toBe(81);
  for (const fixture of corpus.cases) {
    const result = validateEvent(fixture.input);
    expect(result.ok, fixture.id).toBe(fixture.valid);
    if (fixture.valid) {
      expect(result, fixture.id).toEqual({ ok: true, value: fixture.input });
      expect(deduplicationKey(fixture.input), fixture.id).toEqual(fixture.deduplication);
    } else {
      expect(result, fixture.id).toEqual({ ok: false, code: 'invalid-event' });
      expect(deduplicationKey(fixture.input), fixture.id).toBeNull();
    }
  }
});

it('consumes every released title/project lifecycle 1.1 fixture',async()=>{
 const corpus=JSON.parse(await readFile(join(installed,'fixtures','lifecycle-v1.1.json'),'utf8')) as {cases:Array<{id:string;input:unknown;valid:boolean;deduplication:unknown}>};
 expect(corpus.cases.length).toBeGreaterThan(0);
 for(const fixture of corpus.cases){
  expect(validateEvent(fixture.input).ok,fixture.id).toBe(fixture.valid);
  expect(deduplicationKey(fixture.input),fixture.id).toEqual(fixture.deduplication??null);
 }
});
