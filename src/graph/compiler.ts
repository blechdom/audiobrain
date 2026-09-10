import { parseGraphDocument } from './model';
import { getOperatorDefinition } from './operators';
import type { GraphDocument, GraphEndpoint, GraphNode, OperatorDefinition, SignalType } from './types';

export interface GraphIssue { code: string; message: string; nodeId?: string; edgeId?: string }
export interface CompiledInputBinding { edgeId: string; sourceNodeId: string; sourcePortId: string; type: SignalType }
export interface CompiledNode { node: GraphNode; definition: OperatorDefinition; inputs: Record<string, CompiledInputBinding> }
export interface CompiledGraph { document: GraphDocument; nodes: CompiledNode[]; reachableNodeIds: Set<string> }
export class GraphCompileError extends Error {
  readonly issues: GraphIssue[];
  constructor(issues: GraphIssue[]) { super(issues.map(issue => issue.message).join('\n')); this.name = 'GraphCompileError'; this.issues = issues; }
}
export function compileGraph(input: GraphDocument): CompiledGraph {
  let document: GraphDocument;
  try { document = parseGraphDocument(input); } catch (error) { throw new GraphCompileError([{ code: 'invalid-document', message: error instanceof Error ? error.message : 'Invalid project' }]); }
  const issues: GraphIssue[] = [];
  const nodes = new Map<string, CompiledNode>(document.nodes.map(node => [node.id, { node, definition: getOperatorDefinition(node.kind), inputs: Object.create(null) as Record<string, CompiledInputBinding> }]));
  const outgoing = new Map(document.nodes.map(node => [node.id, [] as string[]]));
  const upstream = new Map(document.nodes.map(node => [node.id, [] as string[]]));
  const degree = new Map(document.nodes.map(node => [node.id, 0]));
  for (const edge of document.edges) {
    const source = nodes.get(edge.source.nodeId);
    const target = nodes.get(edge.target.nodeId);
    if (!source || !target) { issues.push({ code: 'missing-node', message: `Cable ${edge.id} references a missing node`, edgeId: edge.id }); continue; }
    const output = source.definition.outputs.find(port => port.id === edge.source.portId);
    const input = target.definition.inputs.find(port => port.id === edge.target.portId);
    if (!output || !input) { issues.push({ code: 'missing-port', message: `Cable ${edge.id} references a missing port`, edgeId: edge.id }); continue; }
    if (output.type !== input.type || output.schemaVersion !== input.schemaVersion) { issues.push({ code: 'port-type-mismatch', message: `Cannot connect ${output.type} to ${input.type}`, edgeId: edge.id }); continue; }
    if (target.inputs[input.id]) { issues.push({ code: 'input-occupied', message: `${target.definition.title}.${input.label} already has a source`, edgeId: edge.id }); continue; }
    target.inputs[input.id] = { edgeId: edge.id, sourceNodeId: source.node.id, sourcePortId: output.id, type: output.type };
    outgoing.get(source.node.id)!.push(target.node.id);
    upstream.get(target.node.id)!.push(source.node.id);
    degree.set(target.node.id, degree.get(target.node.id)! + 1);
  }
  const queue = [...nodes.keys()].filter(id => degree.get(id) === 0).sort();
  const ordered: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    ordered.push(id);
    for (const target of outgoing.get(id)!) {
      degree.set(target, degree.get(target)! - 1);
      if (degree.get(target) === 0) { queue.push(target); queue.sort(); }
    }
  }
  if (ordered.length !== nodes.size) issues.push({ code: 'cycle', message: 'Graph cable cycles are not supported. Use a Delay node for internal audio feedback.' });
  const reachableNodeIds = new Set<string>();
  const pending = [...nodes.values()].filter(node => node.definition.demandRoot !== null).map(node => node.node.id);
  // Pinning a scalar output also creates demand for that producer.
  for (const widget of document.performance.widgets) if (widget.kind === 'meter' || widget.kind === 'view') pending.push(widget.target.nodePath[0]);
  while (pending.length) {
    const id = pending.pop()!;
    if (reachableNodeIds.has(id)) continue;
    reachableNodeIds.add(id);
    pending.push(...(upstream.get(id) ?? []));
  }
  for (const id of reachableNodeIds) {
    const node = nodes.get(id)!;
    for (const port of node.definition.inputs) {
      if (port.required && !node.inputs[port.id]) issues.push({ code: 'required-input', nodeId: id, message: `${node.definition.title}: connect the ${port.label} input` });
    }
  }
  if (issues.length) throw new GraphCompileError(issues);
  return { document, nodes: ordered.filter(id => reachableNodeIds.has(id)).map(id => nodes.get(id)!), reachableNodeIds };
}
export function tryCompileGraph(document: GraphDocument): { ok: true; graph: CompiledGraph } | { ok: false; issues: GraphIssue[] } {
  try { return { ok: true, graph: compileGraph(document) }; }
  catch (error) { return { ok: false, issues: error instanceof GraphCompileError ? error.issues : [{ code: 'invalid-document', message: error instanceof Error ? error.message : 'Invalid project' }] }; }
}
export interface ConnectionValidation { valid: boolean; message?: string; code?: string }
export function validateConnection(document: GraphDocument, source: GraphEndpoint, target: GraphEndpoint): ConnectionValidation {
  let candidateIndex = 0;
  const edgeIds = new Set(document.edges.map(edge => edge.id));
  while (edgeIds.has(`connection-candidate-${candidateIndex}`)) candidateIndex++;
  const candidateId = `connection-candidate-${candidateIndex}`;
  const result = tryCompileGraph({ ...document, edges: [...document.edges, { id: candidateId, source, target }] });
  if (result.ok) return { valid: true };
  const fatal = result.issues.find(issue => issue.code !== 'required-input');
  return fatal ? { valid: false, code: fatal.code, message: fatal.message } : { valid: true };
}
