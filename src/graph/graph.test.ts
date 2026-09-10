import { describe, expect, it } from 'vitest';
import { PRESETS, OPERATOR_DEFINITIONS, cloneGraphDocument, compileGraph, createNode, getOperatorDefinition, parseGraphDocument, serializeGraphDocument, tryCompileGraph, validateConnection } from './index';

const shapes = () => cloneGraphDocument(PRESETS[0]!);
describe('production catalog and presets', () => {
  it('runs all three Morphazoid examples with complete upstream demand', () => {
    expect(PRESETS.map(preset => preset.title)).toEqual(['Morphazoid Shapes', 'Morphazoid L-Systems', 'Morphazoid Graphs', 'Morphazoid Shapes Synth', 'Morphazoid Shapes Notes', 'Morphazoid Shapes Triggers', 'Morphazoid Shapes Drums']);
    for (const preset of PRESETS) {
      const graph = compileGraph(preset);
      expect(graph.reachableNodeIds.size).toBe(preset.nodes.length);
      expect(parseGraphDocument(serializeGraphDocument(preset))).toEqual(preset);
      const cooked = new Set();
      for (const node of graph.nodes) { for (const input of Object.values(node.inputs)) expect(cooked.has(input.sourceNodeId)).toBe(true); cooked.add(node.node.id); }
    }
  });
  it('has unique stable kinds, ports and exact numeric modulation inputs', () => {
    expect(new Set(OPERATOR_DEFINITIONS.map(operator => operator.kind)).size).toBe(OPERATOR_DEFINITIONS.length);
    for (const definition of OPERATOR_DEFINITIONS) {
      expect(new Set(definition.params.map(parameter => parameter.id)).size).toBe(definition.params.length);
      for (const direction of ['inputs', 'outputs'] as const) expect(new Set(definition[direction].map(port => port.id)).size).toBe(definition[direction].length);
      const document = shapes();
      const node = createNode(definition.kind);
      document.nodes.push(node);
      expect(parseGraphDocument(document).nodes.at(-1)?.params).toEqual(node.params);
      for (const parameter of definition.params) if (parameter.type === 'number' || parameter.type === 'integer') expect(definition.inputs).toContainEqual(expect.objectContaining({ id: parameter.id, type: 'control.f32', required: false }));
    }
  });
});
describe('document boundary', () => {
  it('rejects foreign documents, unknown fields, invalid numbers and oversized imports', () => {
    expect(() => parseGraphDocument({ ...shapes(), documentType: 'videobrain.project' })).toThrow();
    expect(() => parseGraphDocument({ ...shapes(), runtime: {} })).toThrow('unsupported field');
    expect(() => parseGraphDocument(' '.repeat(1024 * 1024 + 1))).toThrow('import limit');
    const document = shapes(); document.nodes[0]!.params.sides = NaN;
    expect(() => parseGraphDocument(document)).toThrow('integer');
    document.nodes[0]!.params.sides = 3.5;
    expect(() => parseGraphDocument(document)).toThrow('integer');
  });
  it('rejects duplicate identities and stale performance or gesture references', () => {
    const document = shapes(); document.nodes.push(cloneGraphDocument(document).nodes[0]!);
    expect(() => parseGraphDocument(document)).toThrow('duplicate');
    const stale = shapes(); stale.performance.widgets[0]!.target.nodePath = ['gone'];
    expect(() => parseGraphDocument(stale)).toThrow('missing node');
    const binding = shapes(); binding.nodes.find(node => node.id === 'view')!.viewBindings!.curvature!.paramId = 'sides';
    expect(() => parseGraphDocument(binding)).toThrow('incompatible');
  });
  it('normalizes omitted literals while rejecting undeclared parameters', () => {
    const document = shapes(); document.nodes[0]!.params = {};
    expect(parseGraphDocument(document).nodes[0]!.params.sides).toBe(5);
    document.nodes[0]!.params.unregistered = 1;
    expect(() => parseGraphDocument(document)).toThrow('unsupported field');
  });
});
describe('compiler', () => {
  it('is independent of node position and author array order', () => {
    const document = shapes(); const ids = compileGraph(document).nodes.map(node => node.node.id);
    document.nodes.reverse(); document.edges.reverse(); document.nodes.forEach(node => { node.position = { x: -400, y: 1800 }; });
    expect(compileGraph(document).nodes.map(node => node.node.id)).toEqual(ids);
  });
  it('retains disconnected author branches without cooking them', () => {
    const document = shapes(); const filter = createNode('audio.filter'); document.nodes.push(filter);
    const graph = compileGraph(document);
    expect(graph.document.nodes).toHaveLength(10);
    expect(graph.reachableNodeIds.has(filter.id)).toBe(false);
  });
  it('reports required reachable inputs while the author document remains importable', () => {
    const document = shapes(); document.edges = document.edges.filter(edge => edge.target.nodeId !== 'out');
    expect(parseGraphDocument(document).edges).toHaveLength(shapes().edges.length - 1);
    const result = tryCompileGraph(document);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(issue => issue.code === 'required-input' && issue.nodeId === 'out')).toBe(true);
  });
  it('rejects implicit coercion, duplicate inputs, missing endpoints and ordinary cycles', () => {
    const document = shapes();
    expect(validateConnection(document, { nodeId: 'geometry', portId: 'path' }, { nodeId: 'gain', portId: 'db' })).toMatchObject({ valid: false, code: 'port-type-mismatch' });
    expect(validateConnection(document, { nodeId: 'voices', portId: 'audio' }, { nodeId: 'gain', portId: 'audio' })).toMatchObject({ valid: false, code: 'input-occupied' });
    expect(validateConnection(document, { nodeId: 'missing', portId: 'audio' }, { nodeId: 'gain', portId: 'audio' })).toMatchObject({ valid: false, code: 'missing-node' });
    const a = createNode('control.constant'); const b = createNode('control.constant'); document.nodes.push(a, b);
    document.edges.push({ id: 'a-b', source: { nodeId: a.id, portId: 'value' }, target: { nodeId: b.id, portId: 'value' } });
    expect(validateConnection(document, { nodeId: b.id, portId: 'value' }, { nodeId: a.id, portId: 'value' })).toMatchObject({ valid: false, code: 'cycle' });
  });
  it('keeps saved literals below explicit connected controls', () => {
    const document = shapes(); const source = createNode('control.constant'); document.nodes.push(source);
    document.nodes.find(node => node.id === 'gain')!.params.db = -18;
    document.edges.push({ id: 'modulation', source: { nodeId: source.id, portId: 'value' }, target: { nodeId: 'gain', portId: 'db' } });
    const gain = compileGraph(document).nodes.find(node => node.node.id === 'gain')!;
    expect(gain.inputs.db!.sourceNodeId).toBe(source.id);
    expect(gain.node.params.db).toBe(-18);
  });
  it('makes external outputs demand roots and preserves port ordering', () => {
    expect(getOperatorDefinition('io.midi.out').demandRoot).toBe('external-output');
    expect(getOperatorDefinition('shapes.reader').inputs.slice(0, 2).map(port => port.id)).toEqual(['path', 'transport']);
  });
});
