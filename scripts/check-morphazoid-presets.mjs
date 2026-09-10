import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { archiveIndex, extractArchive } from './extract-morphazoid-presets.mjs';

export const digest = value => createHash('sha256').update(value).digest('hex');
const root = path.resolve(import.meta.dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'contracts', name), 'utf8');
const own = (value,key) => Object.prototype.hasOwnProperty.call(value,key);

/** Reconstitute the original bank shape and source order without renaming keys. */
export function reconstituteFamily(family) {
  if (family.structure === 'singleton') {
    assert.equal(family.entries.length,1,`${family.id}: singleton entry count`);
    assert.deepEqual(family.entries[0].sourcePath,[],`${family.id}: singleton path`);
    return family.entries[0].raw;
  }
  const output = family.structure === 'array' ? [] : {};
  for (const entry of family.entries) {
    assert(entry.sourcePath.length > 0,`${entry.id}: missing original key/index`);
    let target = output;
    for (let index=0;index<entry.sourcePath.length;index++) {
      const key = entry.sourcePath[index];
      assert(typeof key === 'string' || (Number.isInteger(key) && key >= 0),`${entry.id}: invalid source key`);
      assert(!['__proto__','constructor','prototype'].includes(key),`${entry.id}: unsafe source key`);
      if (index === entry.sourcePath.length-1) {
        assert(!own(target,key),`${entry.id}: repeated original key/index`);
        target[key] = entry.raw;
      } else {
        if(!own(target,key)) target[key] = typeof entry.sourcePath[index+1] === 'number' ? [] : {};
        target = target[key];
      }
    }
  }
  return output;
}

export function validateArchive(archive,index,baseline) {
  assert.equal(archive.kind,'audiobrain.morphazoid-preset-archive');
  assert.equal(archive.schemaVersion,1);
  assert.equal(archive.source.revision,baseline.sourceRevision,'Source revision changed without a retained source audit.');
  assert.equal(archive.unresolved.length,0,'Unresolved source declarations must be retained as explicit source expressions.');
  assert.deepEqual(index,archiveIndex(archive),'Preset index omits or rewrites archived entry metadata.');
  const ids = new Set(); const familyIds = new Set();
  for(const family of archive.families) {
    assert(!familyIds.has(family.id),`Duplicate family ${family.id}`); familyIds.add(family.id);
    assert(['instrument','grammar','topology','timbre','envelope','pattern','configuration'].includes(family.category));
    assert(archive.files.some(file=>file.path===family.source.path && file.sha256===family.source.sha256),`${family.id}: source fingerprint missing`);
    for(const entry of family.entries) {
      assert(!ids.has(entry.id),`Duplicate archived identity ${entry.id}`); ids.add(entry.id);
      assert(entry.id.startsWith(`${family.id}:`),`${entry.id}: family namespace missing`);
      assert(entry.name.length>0 && entry.sourceId.length>0,`${entry.id}: original identity/label missing`);
      assert(own(entry,'raw'),`${entry.id}: source data missing`);
    }
    assert.equal(digest(JSON.stringify(reconstituteFamily(family))),family.valueHash,`${family.id}: reconstituted source settings differ`);
  }
  assert.deepEqual(archive.families.map(family=>({id:family.id,source:family.source,entries:family.entries.map(entry=>({id:entry.id,sourceId:entry.sourceId,rawSha256:digest(JSON.stringify(entry.raw))}))})),baseline.families,'Frozen source presets were removed, renamed or modified. Retain the original source edition when re-auditing.');
  for(const page of archive.pages) {
    assert(page.familyIds.every(id=>familyIds.has(id)),`${page.path}: unknown bank reference`);
    for(const choice of page.presetChoices) {
      if(['custom','local'].includes(choice.sourceId)) continue;
      assert(archive.families.some(family=>page.familyIds.includes(family.id) && family.entries.some(entry=>entry.sourceId===choice.sourceId)),`${page.path}: authored preset choice ${choice.sourceId} was not archived`);
    }
  }
  assert(archive.notices.some(notice=>notice.path==='LICENSE'), 'Source MIT license missing');
  assert(archive.notices.some(notice=>notice.path==='THIRD_PARTY_NOTICES.md'),'Source third-party attribution missing');
  for(const notice of archive.notices) assert.equal(digest(notice.text),notice.sha256,`${notice.path}: source attribution differs`);
  return {families:familyIds.size,entries:ids.size,pages:archive.pages.length,defaults:archive.defaults.length};
}

export function checkArchive({sourceRoot}={}) {
  const archiveText=read('morphazoid-presets.json'); const indexText=read('morphazoid-preset-index.json');
  const archive=JSON.parse(archiveText); const index=JSON.parse(indexText); const baseline=JSON.parse(read('morphazoid-preset-baseline.json'));
  const counts=validateArchive(archive,index,baseline);
  assert.equal(digest(archiveText),baseline.archiveSha256,'Frozen source archive checksum differs.');
  assert.equal(digest(indexText),baseline.indexSha256,'Frozen source index checksum differs.');
  if(sourceRoot) assert.deepEqual(extractArchive(sourceRoot),archive,'Source declaration re-extraction differs from the archived committed source edition.');
  return counts;
}
if(process.argv[1] && path.resolve(process.argv[1])===new URL(import.meta.url).pathname) {
  try {
    const args=process.argv.slice(2);
    assert(args.length===0 || (args.length===2 && args[0]==='--source-root'),'Usage: node scripts/check-morphazoid-presets.mjs [--source-root /path/to/morphazoid]');
    const counts=checkArchive({sourceRoot:args[1]});
    console.log(`Morphazoid preset archive verified: ${counts.entries} entries in ${counts.families} banks, ${counts.pages} pages, ${counts.defaults} default declarations. Archived data is not a claim of playable engine parity.`);
  } catch(error) { console.error(error.message); process.exitCode=1; }
}
