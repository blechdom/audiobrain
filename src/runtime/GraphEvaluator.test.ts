import { describe, expect, it } from 'vitest';
import { cloneGraphDocument, compileGraph, createNode, PRESETS, type GraphDocument } from '../graph';
import { GraphEvaluator } from './GraphEvaluator';
import { MAX_BRANCHES, MAX_EVENT_BATCH, MAX_SYMBOLS, branchEvents, branchGeometry, expandGrammar } from '../instruments/geometry';

const context = (time = 0.1, start = 0, end = 0.2) => ({ time, start, end, levels: {} as Record<string, number>, controls: new Map<string, number>(), midiNotes: new Map() });
const evaluate = (document: GraphDocument, time = 0.1, start = 0, end = 0.2) => new GraphEvaluator(compileGraph(document)).evaluate(context(time, start, end));
const preset = (index: number) => cloneGraphDocument(PRESETS[index]!);
const parameter = (document: GraphDocument, nodeId: string, paramId: string, value: number | string) => { document.nodes.find(node => node.id === nodeId)!.params[paramId] = value; return document; };

describe('Morphazoid instrument evaluation', () => {
  it('evaluates all production preset graphs into matching visuals and routed sound', () => {
    for (const document of PRESETS) {
      const result = evaluate(document);
      expect(result.snapshots.view?.geometry?.points.length).toBeGreaterThan(0);
      expect(result.snapshots.view?.geometry?.segments.length).toBeGreaterThan(0);
      expect(result.audio.some(node => node.id === 'out' && node.kind === 'audio.output')).toBe(true);
      expect(result.audio.some(node => node.id === 'gain' && node.params.db === -18)).toBe(true);
      const voices = result.audio.find(node => node.id === 'voices')!;
      const targets = voices.voices ?? voices.notes ?? [];
      expect(targets.length).toBeGreaterThan(0);
      for (const target of targets) {
        expect(Number.isFinite(target.frequency)).toBe(true);
        expect(target.frequency).toBeGreaterThanOrEqual(20);
        expect(target.frequency).toBeLessThanOrEqual(20_000);
        expect(target.amplitude).toBeGreaterThanOrEqual(0);
        expect(target.pan).toBeGreaterThanOrEqual(-1);
        expect(target.pan).toBeLessThanOrEqual(1);
      }
    }
  });
  it('maps the same geometric contacts into a higher continuous root pitch', () => {
    const low = preset(0), high = parameter(preset(0), 'mapping', 'rootHz', 220);
    const lowResult = evaluate(low), highResult = evaluate(high);
    const lowVoices = lowResult.audio.find(node => node.id === 'voices')!.voices!;
    const highVoices = highResult.audio.find(node => node.id === 'voices')!.voices!;
    expect(lowVoices).toHaveLength(4);
    expect(highResult.snapshots.view?.features).toEqual(lowResult.snapshots.view?.features);
    for (let index = 0; index < lowVoices.length; index++) {
      expect(highVoices[index]!.id).toBe(lowVoices[index]!.id);
      expect(highVoices[index]!.frequency).toBeCloseTo(lowVoices[index]!.frequency * 2);
    }
  });
  it('changes note pitch through musical mapping without changing traversal identity', () => {
    for (const index of [1, 2]) {
      const baseline = preset(index);
      const root = Number(baseline.nodes.find(node => node.id === 'mapping')!.params.rootHz);
      const changed = parameter(preset(index), 'mapping', 'rootHz', root / 2);
      const before = evaluate(baseline, .2, 0, 1).audio.find(node => node.id === 'voices')!.notes!;
      const after = evaluate(changed, .2, 0, 1).audio.find(node => node.id === 'voices')!.notes!;
      expect(before.length).toBeGreaterThan(1);
      expect(after.map(note => note.id)).toEqual(before.map(note => note.id));
      expect(after.map(note => note.time)).toEqual(before.map(note => note.time));
      for (let note = 0; note < before.length; note++) expect(after[note]!.frequency).toBeCloseTo(before[note]!.frequency / 2);
    }
  });
  it('preserves reader phase when a new plan changes an unrelated parameter', () => {
    const original = new GraphEvaluator(compileGraph(preset(0)));
    original.evaluate(context(.4, .4, .5));
    const expected = original.evaluate(context(2, 2, 2.1));
    const edited = new GraphEvaluator(compileGraph(parameter(preset(0), 'gain', 'db', -24)), original).evaluate(context(2, 2, 2.1));
    expect(edited.snapshots.reader?.features).toEqual(expected.snapshots.reader?.features);
    expect(edited.audio.find(node => node.id === 'gain')!.params.db).toBe(-24);
  });
  it('preserves branch note identity across adjacent scheduling intervals without duplicate attacks', () => {
    for (const index of [1, 2]) {
      const evaluator = new GraphEvaluator(compileGraph(preset(index)));
      const early = evaluator.evaluate(context(.1, 0, .5)).audio.find(node => node.id === 'voices')!.notes!;
      const late = evaluator.evaluate(context(.5, .5, 1)).audio.find(node => node.id === 'voices')!.notes!;
      const together = evaluate(preset(index), .1, 0, 1).audio.find(node => node.id === 'voices')!.notes!;
      expect(new Set([...early, ...late].map(note => note.id)).size).toBe(early.length + late.length);
      expect([...early, ...late].map(note => note.id).sort()).toEqual(together.map(note => note.id).sort());
    }
  });
  it('keeps view-only instruments alive while inactive sound branches do not evaluate voices', () => {
    const document = preset(0);
    const removed = new Set(['out', 'meter']);
    document.nodes = document.nodes.filter(node => !removed.has(node.id));
    document.edges = document.edges.filter(edge => !removed.has(edge.source.nodeId) && !removed.has(edge.target.nodeId));
    document.performance.widgets = document.performance.widgets.filter(widget => !removed.has(widget.target.nodePath[0]));
    const graph = compileGraph(document);
    expect(graph.reachableNodeIds.has('voices')).toBe(false);
    const result = new GraphEvaluator(graph).evaluate(context());
    expect(result.audio).toHaveLength(0);
    expect(result.snapshots.view?.features?.length).toBe(4);
  });
});

describe('explicit control boundaries', () => {
  it('resolves connected values with bounds while retaining saved literals for disconnect', () => {
    const document = preset(0), controller = createNode('control.constant');
    controller.params.value = 2;
    document.nodes.push(controller);
    document.edges.push({ id: 'curvature-control', source: { nodeId: controller.id, portId: 'value' }, target: { nodeId: 'geometry', portId: 'curvature' } });
    const result = evaluate(document);
    expect(result.snapshots.geometry?.params?.curvature).toBe(1);
    expect(document.nodes.find(node => node.id === 'geometry')!.params.curvature).toBe(.15);
    document.edges = document.edges.filter(edge => edge.id !== 'curvature-control');
    expect(evaluate(document).snapshots.geometry?.params?.curvature).toBe(.15);
  });
  it('normalizes integer modulation and rejects nonfinite live values at the consumer', () => {
    const document = preset(0), input = createNode('io.midi.in');
    document.nodes.push(input);
    document.edges.push({ id: 'live-control', source: { nodeId: input.id, portId: 'value' }, target: { nodeId: 'geometry', portId: 'sides' } });
    const evaluator = new GraphEvaluator(compileGraph(document));
    const live = context(); live.controls.set(input.id, 5.7);
    expect(evaluator.evaluate(live).snapshots.geometry?.params?.sides).toBe(6);
    live.controls.set(input.id, NaN);
    expect(evaluator.evaluate(live).snapshots.geometry?.params?.sides).toBe(3);
  });
  it('rejects branch and graph event mappings without their required musical metadata', () => {
    const branches = preset(1);
    branches.nodes.find(node => node.id === 'mapping')!.kind = 'mapping.graphNotes';
    expect(() => evaluate(branches)).toThrow('directed route and cumulative-turn metadata');
    const graph = preset(2);
    graph.nodes.find(node => node.id === 'mapping')!.kind = 'mapping.branchNotes';
    expect(() => evaluate(graph)).toThrow('branch distance and power-share metadata');
  });
  it('enforces geometry semantics when superficially matching path wires are crossed', () => {
    const document = preset(1);
    const shapesReader = createNode('shapes.reader');
    document.nodes.push(shapesReader);
    // Make the reader reachable by replacing the shape-specific mapping/view
    // output root's source with this reader in a complete Shapes graph below.
    const crossed = preset(0);
    const grammar = document.nodes.find(node => node.id === 'grammar')!;
    const geometry = document.nodes.find(node => node.id === 'geometry')!;
    grammar.id = 'branch-grammar'; geometry.id = 'branch-geometry';
    crossed.nodes.push(grammar, geometry);
    crossed.edges = crossed.edges.map(edge => edge.source.nodeId === 'geometry' ? { ...edge, source: { nodeId: geometry.id, portId: 'path' } } : edge);
    crossed.edges.push({ id: 'branch-text', source: { nodeId: grammar.id, portId: 'text' }, target: { nodeId: geometry.id, portId: 'text' } });
    expect(() => evaluate(crossed)).toThrow('requires a Shapes contour');
  });
});

describe('bounded geometry and event scheduling', () => {
  it('rejects malformed or over-budget L-System expansion instead of silently truncating it', () => {
    expect(() => expandGrammar('F[', 'F -> FF', 1)).toThrow('unmatched');
    expect(() => expandGrammar('F', 'not a rule', 1)).toThrow('Invalid production rule');
    expect(() => expandGrammar('F', 'F -> FFFFFFFFFF', 8)).toThrow(`${MAX_SYMBOLS} symbols`);
    expect(() => branchGeometry('F'.repeat(MAX_SYMBOLS + 1), 45, .72)).toThrow(`${MAX_SYMBOLS} symbols`);
    expect(() => branchGeometry('F'.repeat(MAX_BRANCHES + 1), 45, .72)).toThrow(`${MAX_BRANCHES} branches`);
    expect(() => branchGeometry('X', 45, .72)).toThrow('F drawing symbol');
    expect(() => branchGeometry('<'.repeat(400) + 'F', 45, .1)).toThrow('finite geometry range');
  });
  it('bounds event batches even under dense geometry and long scheduling windows', () => {
    const geometry = branchGeometry('F'.repeat(MAX_BRANCHES), 45, .72);
    expect(branchEvents(geometry, 0, 100, 4).length).toBeLessThanOrEqual(MAX_EVENT_BATCH);
  });
});
