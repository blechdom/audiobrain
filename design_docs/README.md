# AudioBrain design docs

Start with [all modules in one table](MODULE_LIST.md) to compare availability, module types, descriptions, inputs/outputs, key controls and sources. The [abstraction atlas](MORPHAZOID_ABSTRACTION_ATLAS.md) explains the proposed architecture in more detail.

**[Printable module list (PDF)](MODULE_LIST.pdf)** — two module-and-description pairs per row, alphabetized left to right, then down, in compact 6⅔-point type. [Print source](MODULE_PRINT_LIST.md).

1. **[All modules — one review table](MODULE_LIST.md)** — a continuous list of shipped nodes, proposed parts, source instruments/variants and exploratory interfaces, with short descriptions, I/O and controls.
2. **[Morphazoid abstraction atlas](MORPHAZOID_ABSTRACTION_ATLAS.md)** — candidate node families, geometry and anatomical boundaries, adapters, performance UI, contracts and implementation sequence.
3. **[Complete page matrix](MORPHAZOID_PAGE_MATRIX.md)** — all 176 authored Morphazoid pages, their proposed reusable parts, preservation requirements and source links.
4. **[Source registries](MORPHAZOID_SOURCE_REGISTRIES.md)** — shader modules, Composer primitives, geometry features, physical models, acoustic profiles and other detailed inventories.
5. **[Current nodes and initial abstraction review](NODE_ABSTRACTION_REVIEW.md)** — the 34 shipped AudioBrain nodes, the initial candidate shortlist, and three approaches to geometry → adapter → controller graphs.
6. **[Machine-readable survey](MORPHAZOID_ABSTRACTION_SURVEY.json)** — page coverage, source hashes, control metadata and registry records for the coverage checker.

The broad survey is pinned to Morphazoid commit `a67df8f44567b6fe457f2482f0084b24af249d1d`. Proposed extractions remain separate from implemented AudioBrain capabilities; the existing preset and feature-preservation baselines are unchanged.

For current application behavior and delivery details, see the [main README](../README.md), [architecture](../docs/ARCHITECTURE.md), [feature preservation](../docs/FEATURE_PARITY.md) and [preset archive](../docs/PRESET_ARCHIVE.md).

Run the source coverage check from the repository root with Node 22 or newer:

```sh
node scripts/check-morphazoid-survey.mjs --source-root /path/to/morphazoid
```

Add `--compare-head` to also report committed source changes that need a new audit. The checker reads the supplied Morphazoid checkout without changing it.
