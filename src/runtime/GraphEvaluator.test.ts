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
      const result = evaluate(document, .1, 0, 2);
      expect(result.snapshots.view?.geometry?.points.length).toBeGreaterThan(0);
      expect(result.snapshots.view?.geometry?.segments.length).toBeGreaterThan(0);
      expect(result.audio.some(node => node.id === 'out' && node.kind === 'audio.output')).toBe(true);
      expect(result.audio.some(node => node.id === 'gain' && node.params.db === document.nodes.find(node => node.id === 'gain')!.params.db)).toBe(true);
      const voices = result.audio.find(node => node.id === 'voices')!;
      const targets = [...(voices.voices ?? []), ...(voices.notes ?? [])];
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
    const document = parameter(preset(0), 'geometry', 'curvature', .15), controller = createNode('control.constant');
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
    expect(evaluator.evaluate(live).snapshots.geometry?.params?.sides).toBe(1);
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

describe('independent Shapes playheads', () => {
  it('restores readers to old saved projects through defaults without moving their point heads', () => {
    const document = preset(0);
    document.nodes.find(node => node.id === 'reader')!.params = { heads: 4, rateHz: .25 };
    const result = evaluate(document, .4);
    expect(result.snapshots.reader!.readers?.map(reader => reader.type)).toEqual(['points', 'points', 'points', 'points']);
    const phases = result.snapshots.reader!.readers!.map(reader => reader.phase);
    for (const [index, phase] of phases.entries()) expect(phase).toBeCloseTo(.1 + index / 4);
    expect(result.snapshots.reader!.readers).toEqual(result.snapshots.view!.readers);
  });

  it('supports twelve heads, mixed reader modes, independent scan axes and explicit relative positions', () => {
    const document = preset(0);
    Object.assign(document.nodes.find(node => node.id === 'reader')!.params, { heads: 12, phaseOffset: .2, head2Phase: .15, head2Direction: 'reverse', head3Reader: 'line', head3Axis: 'horizontal', head4Reader: 'radar' });
    const result = evaluate(document, 0);
    const readers = result.snapshots.view!.readers!;
    expect(readers).toHaveLength(12);
    expect(readers[0]!.phase).toBeCloseTo(.2);
    expect(readers[1]!.phase).toBeCloseTo(.2 + 1 / 12 + .15);
    expect(readers[1]!.direction).toBe(-1);
    expect(readers[2]!.type).toBe('line'); expect(readers[2]!.axis).toBe('horizontal');
    expect(readers[3]!.type).toBe('radar');
    expect(result.snapshots.view!.features!.filter(feature => feature.headIndex === 2)).toHaveLength(2);
    expect(result.audio.find(node => node.id === 'voices')!.voices).toHaveLength(13);
  });

  it('reverses each head in place, preserves rate edits and applies authored offsets immediately', () => {
    const document = parameter(preset(0), 'reader', 'rateHz', .2);
    let evaluator = new GraphEvaluator(compileGraph(document));
    const before = evaluator.evaluate(context(1)).snapshots.reader!.readers!;
    parameter(document, 'reader', 'head2Direction', 'reverse');
    evaluator = new GraphEvaluator(compileGraph(document), evaluator);
    const reversed = evaluator.evaluate(context(1)).snapshots.reader!.readers!;
    expect(reversed.map(reader => reader.phase)).toEqual(before.map(reader => reader.phase));
    const later = evaluator.evaluate(context(1.5)).snapshots.reader!.readers!;
    expect(later[0]!.phase).toBeCloseTo(before[0]!.phase + .1);
    expect(later[1]!.phase).toBeCloseTo(before[1]!.phase - .1);
    parameter(document, 'reader', 'rateHz', .4);
    evaluator = new GraphEvaluator(compileGraph(document), evaluator);
    expect(evaluator.evaluate(context(1.5)).snapshots.reader!.readers!.map(reader => reader.phase)).toEqual(later.map(reader => reader.phase));
    parameter(document, 'reader', 'direction', 'reverse');
    evaluator = new GraphEvaluator(compileGraph(document), evaluator);
    const globalReverse = evaluator.evaluate(context(1.5)).snapshots.reader!.readers!;
    expect(globalReverse.map(reader => reader.phase)).toEqual(later.map(reader => reader.phase));
    expect(globalReverse.map(reader => reader.direction)).toEqual([-1, 1, -1, -1]);
    parameter(document, 'reader', 'head1Phase', .12);
    evaluator = new GraphEvaluator(compileGraph(document), evaluator);
    expect(evaluator.evaluate(context(1.5)).snapshots.reader!.readers![0]!.phase).toBeCloseTo(later[0]!.phase + .12);
    evaluator.reset();
    expect(evaluator.evaluate(context(0)).snapshots.reader!.readers![0]!.phase).toBeCloseTo(.12);
  });

  it('keeps two instances of the same reader and voice bank independently addressable', () => {
    const document = preset(0), second = preset(0);
    parameter(second, 'reader', 'heads', 2);
    parameter(second, 'reader', 'rateHz', .4);
    parameter(second, 'mapping', 'rootHz', 220);
    document.nodes.push(...second.nodes.map(node => ({ ...node, id: `second-${node.id}`, viewBindings: undefined })));
    document.edges.push(...second.edges.map(edge => ({ ...edge, id: `second-${edge.id}`, source: { ...edge.source, nodeId: `second-${edge.source.nodeId}` }, target: { ...edge.target, nodeId: `second-${edge.target.nodeId}` } })));
    let evaluator = new GraphEvaluator(compileGraph(document));
    const before = evaluator.evaluate(context(.4));
    expect(before.snapshots.reader!.readers).toHaveLength(4);
    expect(before.snapshots['second-reader']!.readers).toHaveLength(2);
    expect(before.audio.find(node => node.id === 'voices')!.voices).toHaveLength(4);
    expect(before.audio.find(node => node.id === 'second-voices')!.voices).toHaveLength(2);
    const expected = evaluator.evaluate(context(.8)).snapshots.reader;
    parameter(document, 'second-reader', 'head1Direction', 'reverse');
    evaluator = new GraphEvaluator(compileGraph(document), evaluator);
    expect(evaluator.evaluate(context(.8)).snapshots.reader).toEqual(expected);
    const later = evaluator.evaluate(context(1));
    expect(later.snapshots.reader!.readers![0]!.direction).toBe(1);
    expect(later.snapshots['second-reader']!.readers![0]!.direction).toBe(-1);
  });

  it('resolves a wired full-period ping-pong phase without overwriting its saved offset', () => {
    const document = parameter(preset(0), 'reader', 'head1Phase', .2);
    parameter(document, 'reader', 'motion', 'pingpong');
    const control = createNode('control.constant'); control.params.value = 1.6;
    document.nodes.push(control);
    document.edges.push({ id: 'head-phase-control', source: { nodeId: control.id, portId: 'value' }, target: { nodeId: 'reader', portId: 'head1Phase' } });
    const wired = evaluate(document, 0);
    expect(wired.snapshots.reader!.params!.head1Phase).toBe(1.6);
    expect(wired.snapshots.reader!.readers![0]!.phase).toBeCloseTo(.4);
    expect(document.nodes.find(node => node.id === 'reader')!.params.head1Phase).toBe(.2);
    document.edges = document.edges.filter(edge => edge.id !== 'head-phase-control');
    expect(evaluate(document, 0).snapshots.reader!.readers![0]!.phase).toBeCloseTo(.2);
  });
});

describe('Shapes note and drum scheduling contracts', () => {
  const notePreset = () => cloneGraphDocument(PRESETS.find(document => document.id === 'morphazoid-shapes-notes')!);
  const notesAt = (evaluator: GraphEvaluator, start: number, end: number) => evaluator.evaluate(context(start, start, end)).audio.find(node => node.id === 'voices')!.notes!;

  it('keeps note identities and attack limits across plan edits and half-open windows', () => {
    const document = notePreset();
    parameter(document, 'reader', 'rateHz', 1);
    const expected = notesAt(new GraphEvaluator(compileGraph(document)), 0, 1);
    let evaluator = new GraphEvaluator(compileGraph(document));
    const early = notesAt(evaluator, 0, .513);
    evaluator.evaluate(context(.513, .513, .513)); // A display observation consumes no event.
    parameter(document, 'gain', 'db', -24);
    evaluator = new GraphEvaluator(compileGraph(document), evaluator);
    const late = notesAt(evaluator, .513, 1);
    expect([...early, ...late]).toEqual(expected);
    expect(new Set(expected.map(note => note.id)).size).toBe(expected.length);
    expect(expected.length).toBeGreaterThan(1);
    evaluator.reset();
    expect(notesAt(evaluator, 0, 1)).toEqual(expected);
  });

  it('keeps canonical global and per-voice ceilings across dense short scheduling windows', () => {
    for (const mode of ['notes', 'triggers'] as const) {
      const document = notePreset();
      parameter(document, 'geometry', 'sides', 32);
      parameter(document, 'reader', 'heads', 1);
      parameter(document, 'reader', 'rateHz', 1);
      parameter(document, 'reader', 'divisions', 16);
      parameter(document, 'mapping', 'playingMode', mode);
      const evaluator = new GraphEvaluator(compileGraph(document));
      const notes = Array.from({ length: 40 }, (_, index) => notesAt(evaluator, index / 40, (index + 1) / 40)).flat();
      expect(notes.length).toBeGreaterThan(10);
      const attacks = [...new Set(notes.map(note => note.time))];
      for (let index = 1; index < attacks.length; index++) expect(attacks[index]! - attacks[index - 1]!).toBeGreaterThanOrEqual(1 / (mode === 'notes' ? 96 : 128) - 1e-9);
      const lastByVoice = new Map<string, number>();
      for (const note of notes) {
        const key = mode === 'notes' ? note.sourceId! : note.drum!.id;
        const previous = lastByVoice.get(key);
        if (previous !== undefined) expect(note.time - previous).toBeGreaterThanOrEqual((mode === 'notes' ? .016 : .012) - 1e-9);
        lastByVoice.set(key, note.time);
      }
    }
  });

  it('makes Note character change the canonical duration while retaining attacks and pitches', () => {
    const short = parameter(notePreset(), 'mapping', 'noteCharacter', 0);
    const long = parameter(notePreset(), 'mapping', 'noteCharacter', 1);
    const before = notesAt(new GraphEvaluator(compileGraph(short)), 0, 2);
    const after = notesAt(new GraphEvaluator(compileGraph(long)), 0, 2);
    expect(before.length).toBeGreaterThan(0);
    expect(after.map(note => ({ id: note.id, time: note.time, frequency: note.frequency }))).toEqual(before.map(note => ({ id: note.id, time: note.time, frequency: note.frequency })));
    for (const [index, note] of before.entries()) expect(after[index]!.duration).toBeGreaterThan(note.duration);
    expect(after.every(note => note.attack === .004)).toBe(true);
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
