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
const archive = 'jimmie-potts-agent-lifecycle-contracts-1.0.0.tgz';
const digest = '669c8e3d8b2bac5255ea613eae96134c324515b4e7a767887e86fa59b87fef85';
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
  const receipt = JSON.parse(await readFile(join(root, 'vendor', 'agent-lifecycle-contracts-1.0.0-receipt.json'), 'utf8')) as Record<string, unknown>;
  expect(receipt).toMatchObject({
    artifact: '@jimmie-potts/agent-lifecycle-contracts', version: '1.0.0', apiVersion: '1.0',
    file: archive, sha256: digest, sourceRevision: '855bd3787803dad7245f29e88c758659f6e4eda4',
    reviewedHead: '581cca0e758e46de4a121f2881babd5a42cc16c9', pullRequest: 74,
    tag: 'agent-lifecycle-contracts-v1.0.0',
  });
  expect(sha256(await readFile(join(root, 'vendor', archive)))).toBe(digest);
  const importedUrl = execFileSync(process.execPath, ['--input-type=module', '-e',
    'process.stdout.write(import.meta.resolve("@jimmie-potts/agent-lifecycle-contracts"))'], { cwd: root, encoding: 'utf8' });
  const importedRoot = dirname(dirname(fileURLToPath(importedUrl)));
  expect(await realpath(importedRoot)).toBe(await realpath(installed));
  expect(await realpath(installed)).toBe(installed);
  const manifestBytes = await readFile(join(installed, 'manifest.json'));
  expect(sha256(manifestBytes)).toBe('ac8a72433adc8d516715476e842f2deccafeec748b2292c6df9d96b5afa93f96');
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as { files: Record<string, string> };
  expect(manifest).toMatchObject({
    artifact: '@jimmie-potts/agent-lifecycle-contracts', version: ARTIFACT_VERSION,
    apiVersion: API_VERSION, schemaDraft: '2020-12', fixtureFormat: 1,
  });
  expect(ARTIFACT_VERSION).toBe('1.0.0');
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
