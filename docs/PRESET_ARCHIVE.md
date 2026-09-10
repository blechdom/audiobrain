# Morphazoid preset preservation

The original preset data is independent of AudioBrain's current engines and layouts. The fixed source edition contains **1,479 entries in 126 banks**, covering 173 authored browser pages and 128 default-state declarations. Entries include whole instrument patches, grammar/topology choices, sound/envelope components, patterns and procedural choices. That count does **not** mean 1,479 complete playable AudioBrain instruments.

Source edition: [Morphazoid 769b348ab0ee3a8a57e1dd703d0c5cda211e5090](https://github.com/blechdom/morphazoid/tree/769b348ab0ee3a8a57e1dd703d0c5cda211e5090). Uncommitted Morphazoid work and browser-local user banks are outside this committed factory-data edition and were not modified or overwritten. Authored custom banks require an explicit source-state import; their names and contents cannot be recovered from repository factory constants.

| Source family | Preserved entries | Boundary |
| --- | ---: | --- |
| Shapes | 1 canonical default state, plus shared sound/envelope banks | Shapes has no separate named complete-scene preset bank. Its state includes all dimensions, reader settings, source defaults and inactive modes. |
| L-Systems | 11 grammars, 4 mix presets, 5 default-state components | Selecting a grammar changes structure settings; it does not imply replacing sound, mix or transport. Every rule, drawing/movement symbol and original iteration count is retained. |
| Graph Synth / Drums | 8 patches | Original patches include graph/timing settings and drum overrides. They are distinct from topology labels and from Graph Delay. |
| Graph Delay | 14 patches | Includes the original delay, feedback, pitch, wet/dry and topology values. A generic note graph does not satisfy these patches. |
| Graph topology | 10 choices | Structural component definitions retain original IDs, families, descriptions and cyclic classification. |
| Modular Shader Synth | 9 presets and 242 combinations/scenes | Preserves original nested patch/node/cable IDs, parameters and generated default-filled scene data. These need matching operator/engine adapters. |
| Morphazoid Composer | 10 graph patches and 68 device presets | Preserves nested graphs, primitive/device settings, source identities and missing-value distinctions. |
| Shared envelopes | 5 amplitude and 4 percussion curves | Each complete named control-point array is one preset; points are not counted as separate presets. |
| Other pages | All discovered factory banks and authored preset-menu choices in the fixed audit | Includes Puggler, source synth/percussion banks, Physics factories, Colony Syrinx calls, recorded-source metadata and embedded page presets. Unsupported engines remain archived. |

`contracts/morphazoid-presets.json` is the full portable source archive. `contracts/morphazoid-preset-index.json` is its compact discovery index, so the application can load the larger data only when needed. `contracts/morphazoid-preset-baseline.json` freezes entry IDs, source fingerprints, raw-value fingerprints and the archive/index checksums. Runtime adapters must use this data rather than copying selected source values into handwritten preset replacements.

Each family records its original path/declaration and source SHA-256. Each entry records a namespaced stable ID, original source ID, original name/label where supplied, original key/index path, and raw source settings. `sourcePath` and `structure` reconstruct the original array, object or singleton without changing keys or array order. Whole envelopes and terrain patterns stay whole; grouped banks are separated only when they contain actual named preset objects. Compiler aliases, shuffled display orders and empty fallbacks are listed explicitly rather than silently counted twice.

JSON cannot directly represent functions, `undefined`, negative zero or URL objects. Those values use explicit `$morphazoidValue` records that preserve their source representation. Environment-dependent Boidzoid definitions retain their expressions and viewport dependency. Gesturama preserves its named mode handler and arguments. These records are archival requirements, not executable AudioBrain operators. Sample references and source recording credits are retained; recording binaries are not copied into the host or silently fetched by importing a preset. The archive includes the original MIT license and complete third-party notices.

The abstraction boundary is **source preset → versioned adapter → validated graph plus performance layout**. A playable adapter must map all settings it claims to preserve, identify remaining unsupported behavior, retain source provenance and allocate fresh instance IDs when added to an existing project. Multiple graph instances share a factory definition while keeping separate parameter values, cables, UI bindings and runtime ownership. Export must retain which source definition and adapter created the instance. Loading or adding any definition must leave audio/device activation under the existing explicit session controls.

A preset whose original engine is unavailable must remain visible as archived, with its original data and missing requirements accessible. It must not be advertised as restored merely because a graph can render a similar picture. Supported grammar/topology components can be reconstituted within an editable AudioBrain graph without claiming the full original instrument's sound or gestures. See [the feature ledger](FEATURE_PARITY.md) and [preset usage](PRESETS.md) for the shipped behavior.

Run the preservation check without a sibling checkout:

```sh
node scripts/check-morphazoid-presets.mjs
node --test tests/morphazoid-presets.test.mjs
```

For an independent deterministic re-extraction from the fixed committed source edition:

```sh
node scripts/check-morphazoid-presets.mjs --source-root /path/to/morphazoid
```

The extractor uses the TypeScript AST to select only a requested declaration's dependency closure. It reads committed Git objects, never imports or executes a browser page's startup body, does not grant DOM/network/filesystem APIs to that closure, rejects nondeterministic preset factories, and preserves exceptional source expressions explicitly. HTML menus are parsed with scripts disabled. It is a maintenance tool for the reviewed source edition, not a general service for executing user-supplied JavaScript.

For inspection, `node scripts/extract-morphazoid-presets.mjs --source-root /path/to/morphazoid --output /tmp/morphazoid-presets.json` recreates the full archive and matching index. It does not advance the frozen preservation baseline. A future source re-audit must retain this edition and existing entry identities, add newly discovered banks/requirements, explain changed source fingerprints and rerun adapter behavior tests. Regenerating a baseline to conceal omitted or altered source settings is not an accepted migration.

The archive tests prove deterministic extraction, original-key reconstruction, complete frozen coverage, rejection of deleted/renamed/altered data, stable graph data and preservation of procedural/non-JSON records. They do not prove an adapter's sound, visual equivalence, gestures, physical-device behavior or listening acceptance.
