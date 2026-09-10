import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Frozen source audit, not a generated list of whatever the current app happens to support.
// Advance only after a documented source re-audit, preserving existing capability IDs.
export const BASELINE_SHA256 = 'aba74ec09db13eb67530b30fab38a1e54688727324b7eee80efbb78ee40dbc0f';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FLOWS = ['shapes', 'lsystems', 'graphs'];
const STATUS = new Set(['ported', 'partial', 'missing']);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const inside = (root, path) => typeof path === 'string' && path.length > 0 && !isAbsolute(path)
  && !relative(root, resolve(root, path)).startsWith('..');
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;

export function validateParity(baseline, manifest, { root = ROOT, requireComplete = [] } = {}) {
  const errors = [];
  if (baseline.documentType !== 'audiobrain.morphazoid-parity-baseline' || baseline.schemaVersion !== 1) errors.push('Unsupported baseline schema.');
  if (manifest.documentType !== 'audiobrain.feature-parity' || manifest.schemaVersion !== 1) errors.push('Unsupported parity schema.');
  if (manifest.baseline !== 'contracts/morphazoid-parity-baseline.json') errors.push('Parity must reference the fixed source baseline.');
  const requirements = new Map();
  const sourceControls = new Set((baseline.sourceControls ?? []).map((control) => control.id));
  const covered = new Set();
  const sourceFiles = new Set((baseline.sourceFiles ?? []).map((file) => file.path));
  for (const requirement of baseline.requirements ?? []) {
    if (!nonempty(requirement.id) || requirements.has(requirement.id)) errors.push(`Duplicate/invalid requirement ${requirement.id}.`);
    requirements.set(requirement.id, requirement);
    if (!['common', ...FLOWS].includes(requirement.flow)) errors.push(`Invalid flow for ${requirement.id}.`);
    if (!nonempty(requirement.title) || !nonempty(requirement.acceptance)) errors.push(`Missing acceptance definition for ${requirement.id}.`);
    if (!Array.isArray(requirement.source) || !requirement.source.length) errors.push(`Missing source for ${requirement.id}.`);
    for (const source of requirement.source ?? []) if (!sourceFiles.has(source.split('#')[0])) errors.push(`Unaudited source ${source}.`);
    for (const id of requirement.sourceControls ?? []) {
      if (!sourceControls.has(id)) errors.push(`Unknown source control ${id}.`);
      covered.add(id);
    }
  }
  for (const id of sourceControls) if (!covered.has(id)) errors.push(`Source control has no preservation requirement: ${id}.`);
  const capabilities = new Map();
  for (const capability of manifest.capabilities ?? []) {
    const id = capability.id;
    if (capabilities.has(id)) errors.push(`Duplicate capability ${id}.`);
    capabilities.set(id, capability);
    if (!requirements.has(id)) errors.push(`Capability ${id} has no audited requirement.`);
    if (!STATUS.has(capability.status)) errors.push(`Invalid status for ${id}; missing functionality cannot be renamed 'deferred' or removed.`);
    if (!nonempty(capability.access) || !nonempty(capability.remaining)) errors.push(`Missing discoverability/remaining-work statement for ${id}.`);
    if (!Array.isArray(capability.implementation) || !Array.isArray(capability.tests)) errors.push(`Missing implementation/evidence lists for ${id}.`);
    if (capability.status === 'ported' && (!capability.implementation?.length || !capability.tests?.length)) errors.push(`Ported capability ${id} needs implementation and behavioral test pointers.`);
    for (const path of capability.implementation ?? []) if (!inside(root, path) || !existsSync(resolve(root, path))) errors.push(`Missing implementation for ${id}: ${path}.`);
    for (const evidence of capability.tests ?? []) {
      if (!inside(root, evidence.path) || !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(evidence.path) || !existsSync(resolve(root, evidence.path))) errors.push(`Missing behavioral test for ${id}: ${evidence.path}.`);
      else if (!nonempty(evidence.testName) || !readFileSync(resolve(root, evidence.path), 'utf8').includes(evidence.testName)) errors.push(`Missing named test for ${id}: ${evidence.testName}.`);
    }
  }
  for (const id of requirements.keys()) if (!capabilities.has(id)) errors.push(`Tracked source capability disappeared: ${id}.`);
  for (const id of baseline.preservationFloor ?? []) {
    if (!requirements.has(id)) errors.push(`Preservation floor references an unknown capability: ${id}.`);
    if (capabilities.get(id)?.status !== 'ported') errors.push(`Previously ported capability cannot be downgraded: ${id}. Restore it or record a specific user-approved baseline change.`);
  }
  for (const change of manifest.approvedChanges ?? []) {
    if (!requirements.has(change.capabilityId) || !nonempty(change.userInstruction) || !nonempty(change.decision)) errors.push(`Invalid user-approved departure ${change.id}.`);
  }
  for (const flow of FLOWS) {
    if (!['partial', 'complete'].includes(manifest.claims?.[flow])) errors.push(`Missing completion claim for ${flow}.`);
    const incomplete = [...requirements.values()].filter((item) => [flow, 'common'].includes(item.flow) && capabilities.get(item.id)?.status !== 'ported');
    if ((manifest.claims?.[flow] === 'complete' || requireComplete.includes(flow)) && incomplete.length) errors.push(`${flow} cannot claim source parity: ${incomplete.length} required capabilities remain partial/missing.`);
  }
  return errors;
}

const cell = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
export function renderParityDocument(baseline, manifest) {
  const byId = new Map(manifest.capabilities.map((capability) => [capability.id, capability]));
  const lines = [
    '# Morphazoid feature preservation', '',
    '**These are partial instrument ports. A control that is absent from the graph is not merely hidden in Perform.** The graph/Inspector can expose and pin supported parameters; they cannot recover a missing engine, gesture, mode or mapping.', '',
    'This ledger is generated from [the fixed source inventory](../contracts/morphazoid-parity-baseline.json) and [the implementation ledger](../contracts/feature-parity.json). Do not edit the tables directly. Run `npm run check:parity` after changes, and `node scripts/check-feature-parity.mjs --write-doc` to refresh this document.', '',
    `The audit records **${baseline.sourceControls.length} authored control elements** across Shapes, L-Systems, Graph Synth, Graph Drums and Graph Delay, grouped with dynamic controls/gestures into **${baseline.requirements.length} preservation requirements**. Source revision: [${baseline.sourceRevision.slice(0, 12)}](${baseline.sourceRepository}/tree/${baseline.sourceRevision}), audited ${baseline.auditedAt}. Each source file has a SHA-256 fingerprint in the baseline. The target source files still match the original 81d3530 audit; the repository HEAD has advanced.`, '',
    baseline.scope, '',
    '## What preservation means', '',
    '- Retain original sound engines, mathematical mappings, modes, ranges, defaults, gestures, transitions, identities, saved states and routes as explicit requirements. Sharing infrastructure does not authorize replacing them with approximate behavior.',
    '- `ported` means the narrowly stated capability has an implementation and named behavioral evidence. `partial` means some behavior exists but the listed differences still need work. `missing` means no equivalent instrument capability exists. A generic delay or microphone node does not satisfy a source-specific processor.',
    '- Changing preset names and adopting the VideoBrain shell does not approve unrelated visual or musical changes. Source visuals, contact identity and direct gestures require comparison, not just a similar screenshot.',
    '- Missing items stay in the ledger until implemented and checked. Record a specific user-approved departure with the user’s instruction; never invent approval or erase the original requirement. Preservation is the default for subsequent work.',
    '- For every ported control document its Graph and Perform location. Pinning exposes the same parameter, without copying it. Essential instrument controls belong in the default performance surface, not only an obscure node.', '',
    '## Checks and their limits', '',
    '`npm run check:parity` checks the frozen source inventory, complete requirement coverage, existing implementation/named-test pointers, the preservation floor for already-ported capabilities, honest completion claims and this generated document. It fails if a tracked capability disappears or an already-ported capability is downgraded. It reports outstanding work without preventing releases accurately labelled as partial ports.', '',
    '`node scripts/check-feature-parity.mjs --require-complete shapes` (or `lsystems`, `graphs`, `all`) is the gate before claiming a source instrument is completely imported. It currently fails by design. `--source-root /path/to/morphazoid` additionally detects drift from the audited source files; normal CI never depends on a sibling checkout.', '',
    '**A ledger check does not execute behavioral tests or prove equivalence.** Run the named unit/browser/audio suites. Numerical identity, timing/phase, geometry/contact identity, silence/release, gesture persistence and unchanged controls need regression tests. Original/ported recordings, visual comparisons, listening, touch and physical MIDI/mic/output-device passes remain separate acceptance evidence. They have not been completed for full source parity.', '',
    '## Explicit user instruction', '',
    ...manifest.approvedChanges.map((change) => `- “${change.userInstruction}” — ${change.decision}`), '',
  ];
  for (const [flow, title] of [['common', 'Shared contracts'], ['shapes', 'Shapes'], ['lsystems', 'L-Systems'], ['graphs', 'Graphs family']]) {
    lines.push(`## ${title}`, '', '| Capability and source | Status / where to find it | Remaining requirement | Evidence |', '| --- | --- | --- | --- |');
    for (const requirement of baseline.requirements.filter((item) => item.flow === flow)) {
      const item = byId.get(requirement.id);
      if (!item) continue;
      const source = requirement.source[0];
      const evidence = item.tests.map((test) => `[${test.testName}](../${test.path})`).join('; ') || 'No behavior test recorded for this capability.';
      lines.push(`| **${cell(requirement.title)}** · [source](${baseline.sourceRepository}/blob/${baseline.sourceRevision}/${source}) · \`${requirement.id}\` | **${item.status}**. ${cell(item.access)} | ${cell(item.remaining)} | ${cell(evidence)} |`);
    }
    lines.push('');
  }
  lines.push('## Updating the audit', '',
    'When source work advances, inspect the changed application and shared modules, append newly discovered capabilities, retain existing IDs, refresh source fingerprints and document what changed before updating the frozen baseline checksum in the checker. Promote verified capabilities into the baseline preservation floor; a later regression cannot simply be relabelled missing. A user-approved departure requires a specific recorded instruction and an explicit baseline change, while preserving the original requirement. Generated HTML inventory covers authored controls; dynamic controls, external-device paths and behavior must still be audited explicitly. Never regenerate a smaller source inventory from the current AudioBrain UI.', '',
    'The source snapshots and source test files are provenance, not proof that AudioBrain passes those tests. Production AudioBrain never imports a sibling checkout. See [provenance](PROVENANCE.md) and the [boundary analysis](MORPHAZOID_BOUNDARIES.md) for the extraction contracts.', '');
  return lines.join('\n');
}

export function main(args = process.argv.slice(2)) {
  const baselineText = readFileSync(resolve(ROOT, 'contracts/morphazoid-parity-baseline.json'), 'utf8');
  if (digest(baselineText) !== BASELINE_SHA256) throw new Error('Frozen Morphazoid baseline changed. Re-audit and document retained/new requirements before intentionally advancing its checksum.');
  const baseline = JSON.parse(baselineText);
  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'contracts/feature-parity.json'), 'utf8'));
  const completeIndex = args.indexOf('--require-complete');
  const request = completeIndex < 0 ? null : args[completeIndex + 1];
  if (completeIndex >= 0 && ![...FLOWS, 'all'].includes(request)) throw new Error('--require-complete expects shapes, lsystems, graphs or all.');
  const errors = validateParity(baseline, manifest, { requireComplete: request === 'all' ? FLOWS : request ? [request] : [] });
  const sourceIndex = args.indexOf('--source-root');
  if (sourceIndex >= 0) {
    if (!args[sourceIndex + 1] || args[sourceIndex + 1].startsWith('--')) throw new Error('--source-root expects a source checkout path.');
    const sourceRoot = resolve(args[sourceIndex + 1]);
    for (const source of baseline.sourceFiles) {
      const path = resolve(sourceRoot, source.path);
      if (!inside(sourceRoot, source.path) || !existsSync(path) || digest(readFileSync(path)) !== source.sha256) errors.push(`Source drift requires re-audit: ${source.path}.`);
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  const document = renderParityDocument(baseline, manifest);
  const documentPath = resolve(ROOT, 'docs/FEATURE_PARITY.md');
  if (args.includes('--write-doc')) writeFileSync(documentPath, document);
  else if (!existsSync(documentPath) || readFileSync(documentPath, 'utf8') !== document) throw new Error('Feature parity document is stale. Run node scripts/check-feature-parity.mjs --write-doc.');
  const counts = Object.fromEntries([...STATUS].map((status) => [status, manifest.capabilities.filter((item) => item.status === status).length]));
  process.stdout.write(`Feature parity ledger valid: ${counts.ported} ported, ${counts.partial} partial, ${counts.missing} missing. Structural coverage is not behavioral equivalence.\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
