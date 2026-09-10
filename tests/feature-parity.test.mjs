import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { renderParityDocument, validateParity } from '../scripts/check-feature-parity.mjs';

const root = resolve(import.meta.dirname, '..');
const baseline = JSON.parse(readFileSync(resolve(root, 'contracts/morphazoid-parity-baseline.json'), 'utf8'));
const ledger = JSON.parse(readFileSync(resolve(root, 'contracts/feature-parity.json'), 'utf8'));

test('source inventory covers every authored control and ledger preserves every capability', () => {
  assert.deepEqual(validateParity(baseline, ledger), []);
  assert.equal(renderParityDocument(baseline, ledger), readFileSync(resolve(root, 'docs/FEATURE_PARITY.md'), 'utf8'));
});

test('removing an unimplemented capability fails instead of making completeness look better', () => {
  const edited = structuredClone(ledger);
  edited.capabilities = edited.capabilities.filter((item) => item.id !== 'graphs.delay-processing');
  assert.ok(validateParity(baseline, edited).some((error) => error.includes('Tracked source capability disappeared: graphs.delay-processing')));
});

test('a claimed complete source instrument fails while any required capability remains missing or partial', () => {
  const edited = structuredClone(ledger);
  edited.claims.shapes = 'complete';
  assert.ok(validateParity(baseline, edited).some((error) => error.includes('shapes cannot claim source parity')));
  assert.ok(validateParity(baseline, ledger, { requireComplete: ['lsystems', 'graphs'] }).some((error) => error.includes('graphs cannot claim source parity')));
});

test('a ported label requires real implementation and named behavioral-test pointers', () => {
  const edited = structuredClone(ledger);
  const row = edited.capabilities.find((item) => item.id === 'graphs.delay-processing');
  row.status = 'ported';
  assert.ok(validateParity(baseline, edited).some((error) => error.includes('Ported capability graphs.delay-processing needs implementation and behavioral test pointers')));
  row.implementation = ['src/audio/AudioRack.ts'];
  row.tests = [{ path: 'src/runtime/GraphEvaluator.test.ts', testName: 'a fictional source parity test' }];
  assert.ok(validateParity(baseline, edited).some((error) => error.includes('Missing named test for graphs.delay-processing')));
});

test('inventoried control omissions and unsupported deferred statuses fail', () => {
  const editedBaseline = structuredClone(baseline);
  for (const item of editedBaseline.requirements) item.sourceControls = item.sourceControls.filter((id) => id !== 'shapes.html#readerSelect');
  assert.ok(validateParity(editedBaseline, ledger).some((error) => error.includes('Source control has no preservation requirement: shapes.html#readerSelect')));
  const edited = structuredClone(ledger);
  edited.capabilities[0].status = 'deferred';
  assert.ok(validateParity(baseline, edited).some((error) => error.includes('Invalid status')));
});

test('already restored readers cannot be downgraded to partial to hide a regression', () => {
  const edited = structuredClone(ledger);
  edited.capabilities.find(item => item.id === 'shapes.readers').status = 'partial';
  assert.ok(validateParity(baseline, edited).some(error => error.includes('Previously ported capability cannot be downgraded: shapes.readers')));
});
