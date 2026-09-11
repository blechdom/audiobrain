/** Read-only validation of the discussion inventory; never rewrites a preservation baseline. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { SourceDeclarations } from './extract-morphazoid-presets.mjs';

const args = process.argv.slice(2);
const sourceIndex = args.indexOf('--source-root');
assert(sourceIndex >= 0 && args[sourceIndex + 1], 'Usage: node scripts/check-morphazoid-survey.mjs --source-root /path/to/morphazoid [--compare-head]');
const sourceRoot = path.resolve(args[sourceIndex + 1]);
const survey = JSON.parse(fs.readFileSync(new URL('../design_docs/MORPHAZOID_ABSTRACTION_SURVEY.json', import.meta.url), 'utf8'));
assert.equal(survey.kind, 'audiobrain.morphazoid-abstraction-survey');
assert.equal(survey.schemaVersion, 1);
assert.match(survey.source.revision, /^[a-f0-9]{40}$/);
const source = new SourceDeclarations(sourceRoot, survey.source.revision);
const originalRead = source.read.bind(source);
const cache = new Map();
source.read = (file) => {
  if (!cache.has(file)) cache.set(file, originalRead(file));
  return cache.get(file);
};
const authored = file => !file.includes('/') || file.startsWith('morphazoidical/');
const sortedUnique = (values, label) => {
  assert.equal(new Set(values).size, values.length, `Duplicate ${label}`);
  return [...values].sort();
};
const sourcePages = source.files.filter(file => file.endsWith('.html') && authored(file));
assert.deepEqual(sortedUnique(survey.pages.map(p => p.path), 'page'), [...sourcePages].sort(), 'Authored page coverage differs');
assert.equal(survey.counts.pages, sourcePages.length);
const roles = {};
const domains = {};
for (const page of survey.pages) {
  assert(page.proposedParts && page.preservationNotes && page.reviewStatus, `Incomplete review row: ${page.path}`);
  assert.equal(createHash('sha256').update(source.read(page.path)).digest('hex'), page.sha256, `Page hash: ${page.path}`);
  assert(page.evidence.every(file => source.files.includes(file)), `Missing source evidence: ${page.path}`);
  if (page.redirectTarget) assert(sourcePages.includes(page.redirectTarget), `Missing redirect target: ${page.path}`);
  roles[page.role] = (roles[page.role] ?? 0) + 1;
  domains[page.domain] = (domains[page.domain] ?? 0) + 1;
}
assert.deepEqual(roles, survey.counts.pageRoles);
assert.deepEqual(domains, survey.counts.domains);
const navigation = source.value('nav.js', 'TOOL_GROUPS').flatMap(group => group.tools);
const recordedIds = survey.pages.flatMap(page => page.catalogueIds);
assert.deepEqual(sortedUnique(recordedIds, 'catalogue ID'), sortedUnique(navigation.map(tool => tool.id), 'source catalogue ID'));
assert.equal(survey.counts.catalogueEntries, navigation.length);
for (const tool of navigation) {
  let target = tool.href.replace(/^\.\//, '').split(/[?#]/)[0];
  if (target.endsWith('/')) target += 'index.html';
  assert.equal(survey.pages.find(page => page.catalogueIds.includes(tool.id))?.path, target, `Navigation destination: ${tool.id}`);
}
for (const registry of survey.registries) {
  const value = source.value(registry.source, registry.declaration);
  const entries = Array.isArray(value) ? value : Object.entries(value).map(([key, entry]) => (
    entry && typeof entry === 'object' ? { id: key, ...entry } : { id: key, value: entry }
  ));
  const identity = entry => entry.id ?? entry.projectId;
  assert.deepEqual(sortedUnique(registry.entries.map(identity), registry.declaration), sortedUnique(entries.map(identity), `source ${registry.declaration}`), `Registry membership: ${registry.declaration}`);
  assert.equal(survey.counts.registries[registry.declaration], entries.length);
  const byId = new Map(entries.map(entry => [identity(entry), entry]));
  for (const record of registry.entries) {
    const actual = byId.get(identity(record));
    for (const [key, expected] of Object.entries(record)) {
      if (key === 'id') continue; // Object-key IDs and program IDs are normalized by this survey.
      assert.equal(JSON.stringify(actual[key]), JSON.stringify(expected), `Registry metadata: ${registry.declaration}:${identity(record)}.${key}`);
    }
  }
}
assert.deepEqual([...survey.sharedUiSources].sort(), source.files.filter(file => file.startsWith('src/ui/')).sort());
for (const record of survey.evidence) {
  assert.equal(createHash('sha256').update(source.read(record.path)).digest('hex'), record.sha256, `Source hash: ${record.path}`);
}
console.log(`Survey verified at ${survey.source.revision}: ${sourcePages.length} pages, ${navigation.length} navigation entries, ${survey.registries.length} complete registries, ${survey.evidence.length} evidence files.`);
if (args.includes('--compare-head')) {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim();
  const changed = execFileSync('git', ['diff', '--name-only', survey.source.revision, head], { cwd: sourceRoot, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const relevant = changed.filter(file => authored(file) || file.startsWith('src/') || file.startsWith('assets/'));
  if (relevant.length) {
    console.error(`Committed source drift at ${head}; re-audit required (${relevant.length} files):\n${relevant.join('\n')}`);
    process.exitCode = 1;
  } else console.log(`No authored-source drift at HEAD ${head}. Uncommitted source work was not examined.`);
}
