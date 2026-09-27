import {expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {captureSteps} from '../../scripts/verify/capture-steps.ts';
import {controlSteps} from '../../scripts/verify/controls.ts';
import {PLAYLIST,SESSION,scenarioDefinitions,syntheticMedia} from '../../scripts/verify/scenarios.ts';

// The development guide's feature map is the compact reference for agents and
// the owner. It must name exactly the registered steps, controls, scenarios,
// fixtures and saved results, so it cannot drift from the tested behavior.
it('documents exactly the registered verification steps, controls, scenarios and fixtures',async()=>{
 const guide=await readFile('docs/development.md','utf8');
 const start=guide.indexOf('## Simulator verification runs'),end=guide.indexOf('\n## ',start+1);
 expect(start).toBeGreaterThan(-1);
 const section=guide.slice(start,end);
 const stepColumn=[...section.matchAll(/^\| [^|]+ \| [^|]+ \| (`[^|]+`) \|/gm)].flatMap(match=>[...match[1]!.matchAll(/`([a-z-]+)`/g)].map(name=>name[1]!));
 expect(new Set(stepColumn)).toEqual(new Set(Object.keys(captureSteps)));
 const controls=[...section.matchAll(/^\| `(control-[a-z-]+)` \|/gm)].map(match=>match[1]);
 expect(controls.sort()).toEqual(Object.keys(controlSteps).sort());
 for(const name of Object.keys(scenarioDefinitions))expect(section).toContain(`\`${name}\``);
 for(const media of Object.values(syntheticMedia))expect(section).toContain(`\`${media.file}\``);
 for(const value of [PLAYLIST,SESSION.title,SESSION.project])expect(section).toContain(value);
 const source=await readFile('scripts/verify/capture-steps.ts','utf8');
 const saved=[...source.matchAll(/saveSimulatorResult\(t,'([a-z0-9-]+)'/g)].map(match=>match[1]!);
 expect(saved.length).toBeGreaterThan(0);
 for(const name of saved)expect(section).toContain(`saves \`${name}\``);
});
