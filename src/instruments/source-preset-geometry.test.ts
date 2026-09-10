import { describe, expect, it } from 'vitest';
import source from './__fixtures__/source-preset-geometry.json';
import { branchGeometry, expandGrammar, graphGeometry, MAX_BRANCHES, MAX_SYMBOLS } from './geometry';
import { cloneGraphDocument, compileGraph, PRESETS } from '../graph';
import { GraphEvaluator } from '../runtime/GraphEvaluator';

const evaluationContext = { time: .1, start: 0, end: .2, levels: {}, controls: new Map<string, number>(), midiNotes: new Map() };

describe('source preset geometry preservation', () => {
  for (const fixture of source.traces) {
    it(`preserves ${fixture.input.name} at its original iteration and drawing semantics`, () => {
      const input = fixture.input;
      const options = {
        drawSymbols: 'drawSymbols' in input ? input.drawSymbols : 'F',
        moveSymbols: 'moveSymbols' in input ? input.moveSymbols : '',
        turnAsymmetry: 'turnAsymmetry' in input ? input.turnAsymmetry : 0,
      };
      const text = expandGrammar(input.axiom, Object.entries(input.rules).map(([symbol, replacement]) => `${symbol} -> ${replacement}`).join('\n'), input.iterations);
      expect(text).toHaveLength(fixture.symbols);
      expect(text).toBe(fixture.instructions);
      const geometry = branchGeometry(text, input.angle, input.lengthScale, options);
      expect(geometry.trace.segments).toHaveLength(fixture.segmentCount);
      expect(geometry.snapshot.segments).toHaveLength(fixture.segmentCount);
      expect(geometry.trace.duration).toBeCloseTo(fixture.duration, 8);
      expect(geometry.trace.rootIndices).toEqual(fixture.rootIndices);
      for (const key of ['minX', 'maxX', 'minY', 'maxY'] as const) expect(geometry.trace.bounds[key]).toBeCloseTo(fixture.bounds[key], 8);
      for (const probe of fixture.probes) {
        const segment = geometry.trace.segments[probe.index]!;
        for (const key of ['heading', 'cumulativeTurn', 'startDistance', 'endDistance', 'powerShare'] as const) expect(segment[key]).toBeCloseTo(probe[key], 8);
        for (const key of ['depth', 'parentIndex', 'voiceKey'] as const) expect(segment[key]).toBe(probe[key]);
        for (const point of ['start', 'end'] as const) {
          expect(segment[point].x).toBeCloseTo(probe[point].x, 8);
          expect(segment[point].y).toBeCloseTo(probe[point].y, 8);
        }
      }
    });
  }

  it('preserves pen-up gaps and asymmetric turn pitch metadata through the actual graph runtime', () => {
    const document = cloneGraphDocument(PRESETS[1]!);
    const grammar = document.nodes.find(node => node.kind === 'lsystem.grammar')!;
    const geometry = document.nodes.find(node => node.kind === 'lsystem.geometry')!;
    grammar.params = { axiom: 'XfX+X', rules: '', iterations: 0 };
    geometry.params = { angleDeg: 90, lengthScale: 1, drawSymbols: 'X', moveSymbols: 'f', turnAsymmetry: .5 };
    const expected = branchGeometry('XfX+X', 90, 1, { drawSymbols: 'X', moveSymbols: 'f', turnAsymmetry: .5 });
    const result = new GraphEvaluator(compileGraph(document)).evaluate(evaluationContext);
    expect(result.snapshots[geometry.id]?.geometry).toEqual(expected.snapshot);
    expect(expected.trace.duration).toBe(4);
    expect(expected.trace.segments[2]!.heading).toBeCloseTo(Math.PI * .75);
    expect(expected.trace.segments[1]!.start.x).toBe(2);
  });

  it('keeps larger authored generations observable as errors without reducing iterations or dropping branches', () => {
    expect(() => expandGrammar('F', 'F -> FFFFFFFFFF', 15)).toThrow(`${MAX_SYMBOLS} symbols`);
    expect(() => branchGeometry('F'.repeat(MAX_BRANCHES + 1), 45, 1)).toThrow(`${MAX_BRANCHES} branches`);
    const dragon = source.traces.find(fixture => fixture.input.id === 'dragon')!.input;
    const text = expandGrammar(dragon.axiom, Object.entries(dragon.rules).map(([symbol, replacement]) => `${symbol} -> ${replacement}`).join('\n'), 13);
    expect(() => branchGeometry(text, dragon.angle, dragon.lengthScale)).toThrow(`${MAX_BRANCHES} branches`);
  });

  for (const fixture of source.graphs) {
    it(`preserves the source ${fixture.input.type} topology, coordinates, entries and edge identities (${fixture.input.nodeCount} nodes)`, () => {
      const { input } = fixture;
      const actual = graphGeometry(3, 4, input.seed, { topology: input.type, nodeCount: input.nodeCount, density: input.density });
      const { nodes, ...expectedModel } = fixture.graph;
      const { nodes: actualNodes, ...actualModel } = actual.graph;
      expect(actualModel).toEqual(expectedModel);
      expect(actualNodes).toHaveLength(nodes.length);
      for (const [index, node] of nodes.entries()) {
        expect(actualNodes[index]!.id).toBe(node.id);
        expect(actualNodes[index]!.x).toBeCloseTo(node.x, 10);
        expect(actualNodes[index]!.y).toBeCloseTo(node.y, 10);
      }
      expect(actual.snapshot.segments.map(segment => segment.id)).toEqual(fixture.graph.edges.map(edge => `edge:${edge.id}`));
    });
  }

  it('preserves the legacy layered graph and exposes source topology controls through the graph runtime', () => {
    expect(graphGeometry(3, 4, 17, { topology: 'layered', nodeCount: 30, density: .9 })).toEqual(graphGeometry(3, 4, 17));
    const document = cloneGraphDocument(PRESETS[2]!);
    const node = document.nodes.find(candidate => candidate.kind === 'graph.topology')!;
    node.params = { ...node.params, topology: 'ring', nodeCount: 8, density: .3, seed: 17 };
    const result = new GraphEvaluator(compileGraph(document)).evaluate(evaluationContext);
    const sourceRing = graphGeometry(3, 4, 17, { topology: 'ring', nodeCount: 8, density: .3 });
    expect(result.snapshots[node.id]?.geometry).toEqual(sourceRing.snapshot);
    expect(sourceRing.graph.type).toBe('ring');
    expect(sourceRing.graph.edges).toHaveLength(8);
    expect(sourceRing.graph.edges.some(edge => edge.from === 7 && edge.to === 0)).toBe(true);
  });
});
