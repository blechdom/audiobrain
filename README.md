# AudioBrain

AudioBrain 0.2.0 turns Morphazoid instruments into an editable audio graph and a graphical performance surface. It uses VideoBrain's React, TypeScript, Vite, React Flow and Zustand foundation, with an independent audio runtime and project format.

The application is implemented locally with **seven playable presets and 34 registered operators**. AWS infrastructure and the verification/publishing workflow are included; a public deployment is complete only after that workflow and public acceptance checks succeed. See [AWS setup](infra/README.md).

## Play an instrument

Use Node.js 22 or newer:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5178`, choose an instrument, enable audio, and press Play. Audio activation and transport are separate controls. Space plays or pauses when focus is outside a control; Escape stops sounding voices. Built-in instruments need no microphone, MIDI device, account or network service.

| Preset | Editable flow | Performance gesture |
| --- | --- | --- |
| **Morphazoid Shapes** | Polygon → phase heads → musical voice targets → continuous sine/FM voices | Point, line and radar playheads; drag heads, scrub, rotate or move the shape; switch Synth / Notes / Drums |
| **Morphazoid L-Systems** | Grammar → branch geometry → frontier encounters → note mapping → polyphonic voices | Drag branch angle; edit grammar, iterations, length, speed and pitch mapping |
| **Morphazoid Graphs** | Seeded topology → route traversal → musical mapping → decaying graph voices | Drag edge timing; change layers, nodes per layer, seed, pitch and decay |

All instrument families reuse gain, output, analysis and performance bindings. They adapt actual Morphazoid geometry and musical mapping; the native AudioBrain voice engine does not claim full timbral parity with the original applications. [Preset details](docs/PRESETS.md) and [source provenance](docs/PROVENANCE.md) explain the boundaries.

The **Presets** button opens all examples, including **Morphazoid Shapes Synth**, **Shapes Notes**, **Shapes Triggers**, and **Shapes Drums**. Load replaces the current project; Add inserts an independent instrument with its own graph, identities, cables and performance controls. Both actions can be undone. New presets start at −6 dB output gain (Notes −3 dB; Drums −9 dB); existing saved gain values are retained.

In Shapes, **Sound mode** switches Synth, Notes and Drums / triggers without rewiring. **Playheads** exposes up to twelve readers, independent directions and positions, line axes, mixed reader types, loop and ping-pong motion. The graphic defaults to direct playhead manipulation: drag inside to scrub or outside to rotate. Move, Rotate and Curvature tools make each action explicit. New curvature defaults to zero.

## Build and perform

Graph mode exposes every instrument's domain nodes. Choose **New instrument** for an empty graph or **Rename instrument** to name the current one; both changes are undoable. Add nodes from the library, connect matching port types, edit inline parameters, and replace a mapping or voice bank. Ordinary cable cycles are rejected; the Delay node contains its own bounded feedback. A connected numeric control overrides the live value while retaining the saved literal, which returns when the cable is removed.

Select a node to name or duplicate it in the Inspector. Its stable ID survives renaming, edits, undo, export and import. A node duplicate has independent parameter values and starts without copied cables; the Presets Add action copies a complete connected instrument.

Pin a parameter or instrument view into Performance. Arrange mode moves and resizes those widgets independently of the graph; Perform locks the layout and can fullscreen the entire control surface. Graphics observe the runtime and send explicit parameter gestures. Hiding or resizing a view does not own the audio clock.

Undo/redo, project naming, JSON import/export and debounced local autosave operate on the same project document. The save indicator reports pending or failed storage writes. Exports include graph and performance layout, without audio resources, sockets or device permissions. Import requires the `audiobrain.project` discriminator and schema version 1; VideoBrain documents are not interchangeable.

The [authoritative operator catalog](contracts/operator-catalog.json) supplies all parameter and port definitions:

- Morphazoid geometry, traversal and musical mapping nodes; continuous, polyphonic and graph voice banks; three instrument views.
- Transport, Value, Range Map and LFO controls.
- Oscillator, gain, low/high/band-pass filter, delay, stereo pan, microphone input, audio output and RMS level analysis.
- MIDI In/Out, OSC In/Out and Brain Control In/Out adapters.

Microphone and MIDI each require explicit session activation; MIDI output additionally requires a selected output device. OSC uses the included optional gateway (`npm run osc:gateway`). VideoBrain pairing exchanges selected scalar controls: AudioBrain exports evaluated graph controls, while the VideoBrain companion sends and receives selected saved numeric parameter literals. See [integration setup and limitations](docs/INTEGRATION.md).

## Current scope

The three instrument families are editable top-level graphs; full source feature parity remains incomplete. The [feature parity ledger](docs/FEATURE_PARITY.md) inventories original controls and records implemented, partial and missing capabilities with evidence. `npm run check:parity` prevents silently dropping inventory or claiming full parity; `node scripts/check-feature-parity.mjs --require-complete all` intentionally fails until every required capability is restored. Nested reusable modules, arbitrary vertex/edge authoring, Graph Drums, the original L-System microphone processor, audio files/recording, broader analyzers, MIDI learn/clock, discrete surround and cross-app audio streams remain planned. Stereo panning is implemented; it is not a discrete 5.1/7.1 output system. Third-party executable plugin loading is also outside this version.

The native audio rack admits up to 96 simultaneous voices globally and 32 per voice bank. Shapes has at most eight heads. L-System expansion is limited to 12,000 symbols and 1,024 segments; event batches are limited to 256. A 25 ms host timer schedules a 100 ms lookahead onto Web Audio. Views do not schedule sound, but browser background throttling remains a timer-scheduler limitation. Graph documents are bounded to 128 nodes, 512 cables, 64 performance widgets and a 1 MiB JSON import.

## Develop and release

```sh
npm run verify
npm run build:deploy
npm run check:storybook-dist
npx playwright install chromium
npm run test:e2e
```

`verify` runs lint, type checking, unit/gateway tests, production preset validation and the app build. Browser coverage includes real `OfflineAudioContext` rendering of all three instruments, finite audio, gain response and silence after output disconnection. These checks complement listening and physical-device testing.

Run `npm run storybook` for the production component catalog on port 6006. `build:deploy` includes that catalog under `dist/storybook`; `dist/build.json` identifies the app version and source commit.

The [GitHub workflow](.github/workflows/deploy-aws.yml) verifies pull requests and main-branch pushes, then publishes through a dedicated AudioBrain GitHub OIDC role when the four verified AWS repository variables are configured. Assets publish before HTML, followed by CloudFront invalidation and public checks. Missing configuration is reported explicitly. [Infrastructure instructions](infra/README.md) cover authenticated inventory, preparation, release identity and rollback; [deployment design](docs/DEPLOYMENT.md) retains the source audit and cutover rationale.

## Architecture and source inventory

| Document | Contents |
| --- | --- |
| [Morphazoid boundary inventory](docs/MORPHAZOID_BOUNDARIES.md) | Source evidence and proposed UI/math/mapping/audio/device boundaries for all three flows |
| [Architecture](docs/ARCHITECTURE.md) | Current ownership/execution model and planned module/media extensions |
| [I/O contracts](docs/CONTRACTS.md) | Implemented signal subset, parameter arbitration and broader contract design |
| [Performance UI](docs/PERFORMANCE_UI.md) | Current surface behavior and remaining authoring/accessibility design |
| [Node catalog and roadmap](docs/NODE_CATALOG.md) | Implemented inventory plus remaining standard audio/toolkit work |
| [Implementation status and plan](docs/IMPLEMENTATION_PLAN.md) | Delivery status and the original ordered implementation sequence |
| [Live integrations](docs/INTEGRATION.md) | VideoBrain pairing, direction/authority and local OSC gateway |
| [Provenance](docs/PROVENANCE.md) | Source commits, adapted code, retained licenses and parity limits |

Source baselines: VideoBrain `b7af64b1c1615eb521209b480856bff95b33a71f` and Morphazoid `81d3530e80403976880f7161555820496c4e382e`. Source-audit links point to those fixed GitHub revisions. Runtime dependencies are contained in this repository.
