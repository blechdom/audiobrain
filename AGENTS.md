# AudioBrain agent guide

Read `README.md`, `docs/PROVENANCE.md` and the relevant implementation before changing behavior. `docs/INTEGRATION.md` defines the current Brain/OSC boundary; `infra/README.md` and `.github/workflows/deploy-aws.yml` define publication. Other design documents retain planned extensions, so distinguish their targets from shipped behavior.

## Ownership and contracts

- `contracts/operator-catalog.json` is the authoritative operator registry. The graph parser/compiler, editor, parameter controls, presets and runtime use that registry; do not create a parallel graph model or catalog in a view, adapter or test.
- `GraphDocument` is serializable project data. Store commands own edits and undo history; the compiler validates types and plans upstream demand; the runtime owns clocks, voices, native audio resources and snapshots. Renderers observe snapshots and issue explicit validated gestures.
- Preserve stable node kinds, node/port/parameter/view IDs, port ordering and schema discriminators. Append compatible optional ports; make a migration decision for incompatible changes. Connected controls override resolved values while preserving saved literals.
- Graph documents and performance layout are bounded. Reject ordinary cable cycles and incompatible signal families. Keep invalid author edits observable; incomplete destructive edits must not leave removed audio routes sounding.
- Performance coordinates are independent of graph coordinates. Pinned controls use existing parameter bindings. Do not store duplicated values, runtime objects, device handles, sockets or credentials in project JSON.

## Implementation and verification

A node needs a contract, registry/compiler support, actual bounded runtime behavior, accessible metadata-driven controls and meaningful tests. Add a complete example when the node needs a teaching path. Availability and session readiness are separate; a planned capability must not appear as an implemented operator.

Storybook imports production components, styles and graph data. Do not reconstruct the application appearance or graph rules inside stories. Inject deterministic runtime/device fixtures; stories must not request real permissions, connect to networks or emit sound.

Microphone, MIDI, audio activation and network connections require their explicit session actions. Preserve source/channel note ownership, matching releases, output-device selection, teardown and stale asynchronous request cancellation. Keep timer/control, transport and audio clocks distinct. Bridge changes must preserve exact-origin pairing, bounds, explicit mappings and session-owned endpoints.

Record copied or adapted code in `docs/PROVENANCE.md`, retain required licenses and source hashes, and use fixed source links. Keep actual implementation limits and roadmap status accurate. Production code must not depend on sibling checkouts.

Use Node.js 22 or newer. For a release-sized change run:

```sh
npm run verify
npm run build:deploy
npm run check:storybook-dist
npm run test:e2e
git diff --check
```

Run focused tests while developing; use real offline audio/browser coverage when sound, graph routing or lifecycle changes. Physical-device and listening checks supplement deterministic CI and must not be implied by a fake-device test.

Preserve unrelated user changes. Do not commit generated `dist`, test output, credentials or runtime/device data. Publication follows the configured GitHub verification/deployment pipeline; report success only after its public acceptance checks, and report missing deployment configuration accurately. Use the user's authorized task scope without adding an extra approval workflow.
