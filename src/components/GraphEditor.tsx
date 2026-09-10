import { memo, useMemo, useState } from 'react';
import { Background, BackgroundVariant, Controls, Handle, MiniMap, Position, ReactFlow, type Node, type NodeProps } from '@xyflow/react';
import { Pin } from 'lucide-react';
import { getOperatorDefinition, tryCompileGraph, type GraphDocument, type GraphNode } from '../graph';
import { useProjectStore } from '../store';
import { ParameterControl } from './ParameterControl';
import { nodePresentation, signalColor } from './presentation';
import { DeviceActions } from './DeviceActions';

type FlowNode = Node<{ node: GraphNode; project: GraphDocument; active: boolean }, 'operator'>;

const OperatorNode = memo(function OperatorNode({ data, selected }: NodeProps<FlowNode>) {
  const store = useProjectStore();
  const definition = getOperatorDefinition(data.node.kind);
  const meta = nodePresentation(data.node.kind);
  const Icon = meta.icon;
  return <article className={`operator-node ${selected ? 'selected' : ''} ${data.active ? '' : 'inactive'}`}
    style={{ '--node-accent': meta.color } as React.CSSProperties} aria-label={`${definition.title} node`}>
    <header className="node-header"><Icon size={17} /><div><strong>{definition.title}</strong><small>{meta.category}</small></div><i className="node-status" title={data.active ? 'Connected to an output' : 'Inactive branch'} /></header>
    <div className="node-ports">
      <div>{definition.inputs.map((port) => <div className="port-row input" key={port.id}>
        <Handle type="target" position={Position.Left} id={port.id} style={{ background: signalColor(port.type) }} aria-label={`${port.label} input, ${port.type}`} />
        <span title={port.type}>{port.label}</span>
      </div>)}</div>
      <div>{definition.outputs.map((port) => <div className="port-row output" key={port.id}>
        <span title={port.type}>{port.label}</span><Handle type="source" position={Position.Right} id={port.id} style={{ background: signalColor(port.type) }} aria-label={`${port.label} output, ${port.type}`} />
      </div>)}</div>
    </div>
    <DeviceActions kind={data.node.kind} />
    <div className="node-parameters">{definition.params.map((param) => <ParameterControl key={param.id} nodeId={data.node.id} parameter={param}
      value={data.node.params[param.id] ?? param.default} compact
      wired={data.project.edges.some((edge) => edge.target.nodeId === data.node.id && edge.target.portId === param.id)}
      onChange={(value) => store.setParameter(data.node.id, param.id, value)} onBegin={store.beginGesture} onEnd={store.endGesture}
      onPin={() => store.pinParameter(data.node.id, param.id)} />)}
      {definition.views.map((view) => <button type="button" key={view.id} className="node-view-button nodrag" onClick={() => store.pinView(data.node.id, view.id)}><Pin size={12} /> {view.label}</button>)}
    </div>
    <footer className="node-footer">{data.node.kind}<span>{data.active ? 'connected' : 'idle'}</span></footer>
  </article>;
});

const nodeTypes = { operator: OperatorNode };

export function GraphEditor() {
  const store = useProjectStore();
  const project = store.document;
  const [selectedEdges, setSelectedEdges] = useState<Set<string>>(() => new Set());
  const compilation = useMemo(() => tryCompileGraph(project), [project]);
  const nodes = useMemo<FlowNode[]>(() => project.nodes.map((node) => ({
    id: node.id, type: 'operator', position: node.position, selected: store.selection === node.id,
    data: { node, project, active: compilation.ok ? compilation.graph.reachableNodeIds.has(node.id) : true },
  })), [project, store.selection, compilation]);
  const edges = useMemo(() => project.edges.map((edge) => {
    const source = project.nodes.find((node) => node.id === edge.source.nodeId);
    const port = source && getOperatorDefinition(source.kind).outputs.find((candidate) => candidate.id === edge.source.portId);
    return { id: edge.id, selected: selectedEdges.has(edge.id), ariaLabel: `Connection ${edge.source.nodeId} to ${edge.target.nodeId}`, source: edge.source.nodeId, sourceHandle: edge.source.portId, target: edge.target.nodeId,
      targetHandle: edge.target.portId, type: 'smoothstep', style: { stroke: signalColor(port?.type ?? ''), strokeWidth: 1.8 } };
  }), [project, selectedEdges]);
  return <div className="graph-editor" data-testid="graph-editor">
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.12, maxZoom: 0.8 }}
      minZoom={0.15} maxZoom={1.6} defaultEdgeOptions={{ deletable: true }}
      onNodeClick={(_event, node) => { store.selectNode(node.id); setSelectedEdges(new Set()); }} onPaneClick={() => { store.selectNode(null); setSelectedEdges(new Set()); }}
      onEdgeClick={() => store.selectNode(null)}
      onEdgesChange={(changes) => setSelectedEdges(previous => { const next = new Set(previous); for (const change of changes) { if (change.type === 'select') { if (change.selected) next.add(change.id); else next.delete(change.id); } if (change.type === 'remove') next.delete(change.id); } return next; })}
      onNodeDragStart={(_event, node) => store.beginGesture(`move:${node.id}`)}
      onNodeDrag={(_event, node) => store.moveNode(node.id, node.position)}
      onNodeDragStop={(_event, node) => { store.moveNode(node.id, node.position); store.endGesture(`move:${node.id}`); }}
      onNodesDelete={(removed) => removed.forEach((node) => store.removeNode(node.id))}
      onEdgesDelete={(removed) => removed.forEach((edge) => store.disconnect(edge.id))}
      onConnect={(connection) => {
        if (connection.sourceHandle && connection.targetHandle) store.connect(
          { nodeId: connection.source, portId: connection.sourceHandle }, { nodeId: connection.target, portId: connection.targetHandle });
      }}
      onNodesChange={(changes) => changes.forEach((change) => {
        if (change.type === 'select' && change.selected) store.selectNode(change.id);
      })}
      deleteKeyCode={['Backspace', 'Delete']}>
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#303541" />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable nodeColor={(node) => nodePresentation((node.data as FlowNode['data']).node.kind).color} maskColor="rgba(8,10,15,.65)" />
    </ReactFlow>
    <div className="graph-legend"><span><i style={{ background: '#a88cff' }} /> Geometry</span><span><i style={{ background: '#ffba72' }} /> Music</span><span><i style={{ background: '#65ddff' }} /> Audio</span><span><i style={{ background: '#d8ff5f' }} /> Control</span></div>
    {!compilation.ok && <div className="graph-diagnostic" role="status">{compilation.issues[0]?.message ?? 'Complete the connections to run this graph.'}</div>}
  </div>;
}
