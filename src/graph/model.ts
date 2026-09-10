import { GRAPH_LIMITS, getDefaultParams, getOperatorDefinition } from './operators';
import type { GraphDocument, GraphNode, GraphPosition, GraphParams, ParameterDefinition, ParameterValue, PerformanceWidget, WidgetLayout } from './types';

export class GraphDocumentError extends Error { constructor(message: string) { super(message); this.name = 'GraphDocumentError'; } }
function check(condition: unknown, message: string): asserts condition { if (!condition) throw new GraphDocumentError(message); }
function record(value: unknown, label: string, required: string[], optional: string[] = []): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), `${label}: expected an object`);
  const object = value as Record<string, unknown>;
  const allowed = new Set([...required, ...optional]);
  for (const key of required) check(Object.hasOwn(object, key), `${label}: missing ${key}`);
  for (const key of Object.keys(object)) check(allowed.has(key), `${label}: unsupported field ${key}`);
  return object;
}
function text(value: unknown, label: string, max = 96): string {
  check(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `${label}: expected nonempty text of at most ${max} characters`);
  return value;
}
function id(value: unknown, label: string): string {
  const result = text(value, label);
  check(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(result), `${label}: invalid stable identifier`);
  return result;
}
function array(value: unknown, label: string, max: number): unknown[] { check(Array.isArray(value) && value.length <= max, `${label}: expected at most ${max} items`); return value; }
function finite(value: unknown, label: string, min: number, max: number, integer = false): number {
  check(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isSafeInteger(value)), `${label}: expected ${integer ? 'an integer' : 'a finite number'} in [${min}, ${max}]`);
  return value;
}
function unique(items: { id: string }[], label: string): void { check(new Set(items.map(item => item.id)).size === items.length, `${label}: duplicate identifiers`); }
export function normalizeParameterValue(value: unknown, parameter: ParameterDefinition, label = parameter.id): ParameterValue {
  if (parameter.type === 'number' || parameter.type === 'integer') return finite(value, label, parameter.min, parameter.max, parameter.type === 'integer');
  if (parameter.type === 'text') { check(typeof value === 'string' && value.length <= parameter.maxLength, `${label}: expected text of at most ${parameter.maxLength} characters`); return value; }
  check(parameter.type === 'enum' && typeof value === 'string' && parameter.choices.includes(value), `${label}: unknown choice`);
  return value;
}
export function normalizeNodeParams(kind: string, value: unknown): GraphParams {
  const definition = getOperatorDefinition(kind);
  const params = { ...record(value, `${kind}.params`, [], definition.params.map(parameter => parameter.id)) };
  if (kind === 'shapes.mapping' && !Object.hasOwn(params, 'pitchMapping')) params.pitchMapping = 'centered';
  return Object.fromEntries(definition.params.map(parameter => [parameter.id, normalizeParameterValue(Object.hasOwn(params, parameter.id) ? params[parameter.id] : parameter.default, parameter)]));
}
export function parseWidgetLayout(value: unknown, columns: number): WidgetLayout {
  const layout = record(value, 'widget.layout', ['x', 'y', 'w', 'h']);
  const x = finite(layout.x, 'widget.x', 0, columns - 1, true);
  const y = finite(layout.y, 'widget.y', 0, GRAPH_LIMITS.maxRows - 1, true);
  const w = finite(layout.w, 'widget.w', 1, columns, true);
  const h = finite(layout.h, 'widget.h', 1, GRAPH_LIMITS.maxRows, true);
  check(x + w <= columns && y + h <= GRAPH_LIMITS.maxRows, 'Widget exceeds performance surface bounds');
  return { x, y, w, h };
}
export function parseGraphDocument(input: unknown): GraphDocument {
  let value = input;
  if (typeof value === 'string') {
    check(value.length <= GRAPH_LIMITS.maxJsonBytes && new TextEncoder().encode(value).byteLength <= GRAPH_LIMITS.maxJsonBytes, 'Project exceeds the 1 MiB import limit');
    try { value = JSON.parse(value); } catch { throw new GraphDocumentError('Project is not valid JSON'); }
  }
  const d = record(value, 'project', ['documentType', 'schemaVersion', 'id', 'title', 'nodes', 'edges', 'performance'], ['description', 'learningGoal', 'capabilityNotes']);
  check(d.documentType === 'audiobrain.project' && d.schemaVersion === 1, 'Expected an AudioBrain project with schemaVersion 1');
  const nodes: GraphNode[] = array(d.nodes, 'nodes', GRAPH_LIMITS.maxNodes).map((entry, index) => {
    const n = record(entry, `nodes[${index}]`, ['id', 'kind', 'position', 'params'], ['viewBindings', 'label']);
    const kind = id(n.kind, 'node.kind');
    const definition = getOperatorDefinition(kind);
    const position = record(n.position, 'node.position', ['x', 'y']);
    const node: GraphNode = { id: id(n.id, 'node.id'), kind, position: { x: finite(position.x, 'node.x', -100000, 100000), y: finite(position.y, 'node.y', -100000, 100000) }, params: normalizeNodeParams(kind, n.params) };
    if (n.label !== undefined) node.label = text(n.label, 'node.label');
    if (n.viewBindings !== undefined) {
      const bindings = record(n.viewBindings, 'node.viewBindings', [], definition.views.flatMap(view => view.intents.map(intent => intent.id)));
      node.viewBindings = Object.fromEntries(Object.entries(bindings).map(([key, value]) => {
        const b = record(value, 'viewBinding', ['nodePath', 'paramId']);
        const path = array(b.nodePath, 'viewBinding.nodePath', 1);
        check(path.length === 1, 'View bindings require one top-level node ID');
        return [key, { nodePath: [id(path[0], 'viewBinding.nodeId')], paramId: id(b.paramId, 'viewBinding.paramId') }];
      }));
    }
    return node;
  });
  unique(nodes, 'nodes');
  const nodesById = new Map(nodes.map(node => [node.id, node]));
  for (const node of nodes) {
    for (const [intentId, binding] of Object.entries(node.viewBindings ?? {})) {
      const target = nodesById.get(binding.nodePath[0]);
      check(target, `View ${node.id}: missing target ${binding.nodePath[0]}`);
      const parameter = getOperatorDefinition(target.kind).params.find(parameter => parameter.id === binding.paramId);
      const intent = getOperatorDefinition(node.kind).views.flatMap(view => view.intents).find(intent => intent.id === intentId);
      check(parameter && intent && parameter.type === intent.paramType, `View ${node.id}: incompatible parameter binding ${intentId}`);
    }
  }
  const edges = array(d.edges, 'edges', GRAPH_LIMITS.maxEdges).map((entry, index) => {
    const e = record(entry, `edges[${index}]`, ['id', 'source', 'target']);
    const endpoint = (value: unknown) => { const p = record(value, 'edge.endpoint', ['nodeId', 'portId']); return { nodeId: id(p.nodeId, 'endpoint.nodeId'), portId: id(p.portId, 'endpoint.portId') }; };
    return { id: id(e.id, 'edge.id'), source: endpoint(e.source), target: endpoint(e.target) };
  });
  unique(edges, 'edges');
  // Upgrade older Shapes views from their explicit graph connections. Authored
  // bindings always win; IDs and saved parameter values remain untouched.
  for (const node of nodes.filter(node => node.kind === 'view.shapes')) {
    const connected = (port: string, kind: string) => nodesById.get(edges.find(edge => edge.target.nodeId === node.id && edge.target.portId === port)?.source.nodeId ?? '')?.kind === kind
      ? edges.find(edge => edge.target.nodeId === node.id && edge.target.portId === port)?.source.nodeId : undefined;
    const geometry = connected('path', 'shapes.geometry');
    const reader = connected('features', 'shapes.reader');
    for (const [intent, targetId, paramId] of [['rotation', geometry, 'rotationDeg'], ['moveX', geometry, 'positionX'], ['moveY', geometry, 'positionY'], ['scrub', reader, 'phaseOffset']]) {
      if (intent && targetId && paramId) { node.viewBindings ??= {}; node.viewBindings[intent] ??= { nodePath: [targetId], paramId }; }
    }
  }
  const surface = record(d.performance, 'performance', ['version', 'columns', 'widgets']);
  check(surface.version === 1, 'Unsupported performance layout version');
  const columns = finite(surface.columns, 'performance.columns', 1, GRAPH_LIMITS.maxColumns, true);
  const widgets: PerformanceWidget[] = array(surface.widgets, 'widgets', GRAPH_LIMITS.maxWidgets).map(entry => {
    const w = record(entry, 'widget', ['id', 'kind', 'target', 'layout']);
    check(w.kind === 'param' || w.kind === 'view' || w.kind === 'meter', 'Unknown performance widget kind');
    const field = w.kind === 'param' ? 'paramId' : w.kind === 'view' ? 'viewId' : 'portId';
    const target = record(w.target, 'widget.target', ['nodePath', field]);
    const path = array(target.nodePath, 'widget.nodePath', 1);
    check(path.length === 1, 'Widget requires one top-level node ID');
    const nodeId = id(path[0], 'widget.nodeId');
    const node = nodesById.get(nodeId);
    check(node, `Widget references missing node ${nodeId}`);
    const operator = getOperatorDefinition(node.kind);
    const targetId = id(target[field], `widget.${field}`);
    check(w.kind === 'param' ? operator.params.some(p => p.id === targetId) : w.kind === 'view' ? operator.views.some(v => v.id === targetId) : operator.outputs.some(p => p.id === targetId && p.type === 'control.f32'), `Widget references missing or incompatible ${field} ${targetId}`);
    return { id: id(w.id, 'widget.id'), kind: w.kind, target: { nodePath: [nodeId], [field]: targetId }, layout: parseWidgetLayout(w.layout, columns) };
  });
  unique(widgets, 'widgets');
  const document: GraphDocument = { documentType: 'audiobrain.project', schemaVersion: 1, id: id(d.id, 'project.id'), title: text(d.title, 'project.title'), nodes, edges, performance: { version: 1, columns, widgets } };
  if (d.description !== undefined) document.description = text(d.description, 'description', 4096);
  if (d.learningGoal !== undefined) document.learningGoal = text(d.learningGoal, 'learningGoal', 4096);
  if (d.capabilityNotes !== undefined) document.capabilityNotes = array(d.capabilityNotes, 'capabilityNotes', 16).map(note => text(note, 'capabilityNote', 2048));
  return document;
}
let generated = 0;
export function createId(prefix: string): string { return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${++generated}`}`; }
export function createNode(kind: string, position: GraphPosition = { x: 80, y: 80 }): GraphNode { return { id: createId(kind), kind, position: { ...position }, params: getDefaultParams(kind) }; }
export function cloneGraphDocument(document: GraphDocument): GraphDocument { return structuredClone(document); }
export function serializeGraphDocument(document: GraphDocument): string { return JSON.stringify(parseGraphDocument(document), null, 2); }
