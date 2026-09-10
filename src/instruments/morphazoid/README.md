# Morphazoid pure source modules

Vendored from Morphazoid commit `81d3530e80403976880f7161555820496c4e382e` (MIT, Kristin Galvin), with original license alongside. `provenance.json` records source URLs and source-byte SHA-256 hashes. Only the browser cache query in the graph import is removed. The `.d.ts` files describe the subset consumed by Audiobrain.

`../geometry.ts` adapts those pure functions into explicit graph payloads: contour contacts/corner envelopes, branch frontier/power sharing, and topology/route turn mapping. Audiobrain owns scheduling and native Web Audio synthesis; this subset is not a claim to reproduce every Morphazoid mode or its complete voice worklet. The first Shapes adapter supports 2D polygon point heads. L-Systems supports a synchronous final-iteration branch frontier. Graphs supports seeded layered directed topology with bounded event propagation.
