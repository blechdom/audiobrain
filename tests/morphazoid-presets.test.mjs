import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { archiveIndex, SourceDeclarations } from '../scripts/extract-morphazoid-presets.mjs';
import { checkArchive, reconstituteFamily, validateArchive } from '../scripts/check-morphazoid-presets.mjs';

const root=path.resolve(import.meta.dirname,'..');
const json=name=>JSON.parse(fs.readFileSync(path.join(root,'contracts',name),'utf8'));
const archive=json('morphazoid-presets.json');
const baseline=json('morphazoid-preset-baseline.json');
const family=id=>archive.families.find(family=>family.id===id);

test('frozen archive, compact index, source identities and every authored preset menu remain covered',()=>{
  const result=checkArchive();
  assert.equal(result.entries,1479);
  assert.equal(result.families,126);
  assert.equal(result.pages,173);
  assert.equal(result.defaults,128);
  for(const value of archive.families) for(const entry of value.entries) assert.match(entry.id,/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
});

test('all grammar rules and graph patches are preserved separately from source topology labels',()=>{
  const grammars=family('l-system-grammars');
  assert.equal(grammars.entries.length,11);
  const source=reconstituteFamily(grammars);
  assert.deepEqual(source.find(entry=>entry.id==='gosper'),{
    id:'gosper',name:'Gosper curve',axiom:'X',rules:{X:'X+Y++Y-X--XX-Y+',Y:'-X+YY++Y+X--X-Y'},iterations:4,maxIterations:5,angle:60,lengthScale:1,drawSymbols:'XY',
  });
  assert.equal(source.find(entry=>entry.id==='cantor').moveSymbols,'f');
  assert.equal(source.find(entry=>entry.id==='dragon').iterations,12);
  assert.equal(family('graph-topologies').entries.length,10);
  assert.equal(family('graph-instrument-patches').entries.length,8);
  assert.equal(family('graph-delay-patches').entries.length,14);
  const clearSteps=reconstituteFamily(family('graph-instrument-patches')).clearSteps;
  assert.equal(clearSteps.baseDelay,55);
  assert.equal(clearSteps.drums.mappingMode,'path-phase');
  assert.equal(clearSteps.topology,'chain');
});

test('envelopes remain entire named curves and whole source scenes retain node and cable identities',()=>{
  const envelopes=family('amplitude-envelopes');
  assert.equal(envelopes.entries.length,5);
  assert(envelopes.entries.every(entry=>entry.sourcePath.length===1 && Array.isArray(entry.raw)));
  assert(Array.isArray(reconstituteFamily(envelopes).sustain));
  assert.equal(family('percussion-envelopes').entries.length,4);
  assert.equal(family('shader-synth-combos').entries.length,242);
  const bell=family('shader-synth-playground-shader-playground-presets').entries.find(entry=>entry.sourceId==='pm-bell').raw;
  assert.deepEqual(bell.patch.nodes.map(node=>node.id),['clock','shape','voice','vca','pan','out']);
  assert.deepEqual(bell.patch.connections[0],{id:'clock-shape',from:{node:'clock',port:'phase'},to:{node:'shape',port:'phase'}});
  assert.equal(family('constellation-composer-patch-presets').entries.length,10);
  assert.equal(family('puggler-presets-presets').entries.length,22);
});

test('procedural choices, URL values, undefined fields and original licenses are retained explicitly',()=>{
  const boids=archive.families.find(family=>family.source.exportName==='TEMPERAMENTS');
  assert.equal(boids.serialization,'source-expression');
  assert.match(boids.entries.find(entry=>entry.sourceId==='graze').raw.source,/compactViewport/);
  assert.equal(family('gesturama-playing-modes').entries.find(entry=>entry.sourceId==='harp').raw.$morphazoidValue,'procedural-preset');
  assert.equal(family('hyper-syrinx-presets').entries.length,4);
  assert.equal(family('klein-presets').entries.length,3);
  assert.equal(family('moebius-presets').entries.length,3);
  const banks=archive.families.find(family=>family.source.exportName==='VOCALZOID_OPEN_BANKS');
  assert.equal(banks.entries[0].raw.url.$morphazoidValue,'url');
  assert.match(banks.entries[0].raw.url.href,new RegExp(archive.source.revision));
  assert(JSON.stringify(family('constellation-composer-patch-presets')).includes('"$morphazoidValue":"undefined"'));
  assert.match(archive.notices.find(notice=>notice.path==='LICENSE').text,/Copyright \(c\) 2026 Kristin Galvin/);
});

test('deleting, renaming or altering an original preset and hiding it from the index fails preservation',()=>{
  for(const mutate of [
    copy=>copy.families.find(family=>family.id==='l-system-grammars').entries.pop(),
    copy=>{copy.families.find(family=>family.id==='l-system-grammars').entries[0].id='l-system-grammars:renamed';},
    copy=>{copy.families.find(family=>family.id==='l-system-grammars').entries[0].raw.angle=0;},
  ]) {
    const altered=structuredClone(archive); mutate(altered);
    assert.throws(()=>validateArchive(altered,archiveIndex(altered),baseline));
  }
  const index=archiveIndex(archive); index.families.pop();
  assert.throws(()=>validateArchive(archive,index,baseline),/Preset index/);
});

test('AST extraction evaluates only requested pure declarations from committed bytes and never page startup',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'audiobrain-preset-source-'));
  try {
    const git=(...args)=>execFileSync('git',args,{cwd:directory,encoding:'utf8',stdio:['ignore','pipe','pipe']});
    fs.writeFileSync(path.join(directory,'math.js'),'export const multiply=(a,b)=>a*b;');
    fs.writeFileSync(path.join(directory,'page.js'),`import { multiply } from './math.js';
      document.body.textContent = 'must never execute';
      const start = () => { throw new Error('must never execute'); }; start();
      const BASE = 0.25;
      const PRESETS = Object.freeze([{id:'source-id',name:'Source name',gain:multiply(BASE,2)}]);
      const RANDOM_PRESETS = [{id:'random',gain:Math.random()}];
      const DOM_PRESETS = [{id:'dom',gain:document.body.textContent}];`);
    git('init','--quiet');git('add','math.js','page.js');
    git('-c','user.name=Archive test','-c','user.email=archive-test@example.invalid','commit','--quiet','-m','Fixture source');
    const revision=git('rev-parse','HEAD').trim();
    fs.writeFileSync(path.join(directory,'page.js'),'uncommitted user work must not be loaded or rewritten');
    const source=new SourceDeclarations(directory,revision);
    const result=source.value('page.js','PRESETS');
    assert.deepEqual(JSON.parse(JSON.stringify(result)),[{id:'source-id',name:'Source name',gain:0.5}]);
    assert.throws(()=>source.value('page.js','RANDOM_PRESETS'),/Nondeterministic/);
    assert.throws(()=>source.value('page.js','DOM_PRESETS'),/document is not defined/);
    assert.equal(fs.readFileSync(path.join(directory,'page.js'),'utf8'),'uncommitted user work must not be loaded or rewritten');
  } finally { fs.rmSync(directory,{recursive:true,force:true}); }
});
