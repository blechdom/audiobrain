import type { GraphDocument, GraphNode } from '../graph/types';
import type { RuntimeSnapshot } from '../runtime/types';
import { validBrainChannel } from './brainBridge';

export interface ExternalControlRuntime {
  getSnapshot: () => RuntimeSnapshot;
  subscribe: (listener: () => void) => () => void;
  receiveControl: (nodeId: string, value: number) => void;
  clearControl: (nodeId: string) => void;
}
export function brainNodeChannel(node: GraphNode): string {
  const channel = `${String(node.params.channel ?? 'audiobrain-v1')}/${String(node.params.name ?? 'value')}`;
  if (!validBrainChannel(channel)) throw new Error('Brain channel/name must form a path of at most 128 simple characters.');
  return channel;
}
/** Session wiring observes the production runtime; it never creates another graph model. */
export function bindRuntimeControls(options: {
  runtime: ExternalControlRuntime;
  document: GraphDocument;
  kind: 'brain' | 'osc';
  send: (channel: string, value: number) => boolean;
}): { receive: (channel: string, value: number) => void; dispose: () => void; channels: string[] } {
  const channelFor = (node: GraphNode) => options.kind === 'brain' ? brainNodeChannel(node) : String(node.params.address);
  const inputs = options.document.nodes.filter(node => node.kind === `io.${options.kind}.in`);
  const outputs = options.document.nodes.filter(node => node.kind === `io.${options.kind}.out`);
  const channels = [...new Set([...inputs, ...outputs].map(channelFor))];
  let active = true;
  const lastOutbound = new Map<string, number>();
  const unsubscribe = options.runtime.subscribe(() => {
    if (!active) return;
    const snapshot = options.runtime.getSnapshot();
    for (const node of outputs) {
      const channel = channelFor(node);
      const value = snapshot.nodes[node.id]?.value;
      if (value !== undefined && Number.isFinite(value) && value !== lastOutbound.get(channel) && options.send(channel, value)) lastOutbound.set(channel, value);
    }
  });
  return {
    channels,
    receive(channel, value) {
      if (!active || !Number.isFinite(value)) return;
      // Suppress direct patch-through echoes while preserving changed values.
      lastOutbound.set(channel, value);
      for (const node of inputs) if (channelFor(node) === channel) options.runtime.receiveControl(node.id, value);
    },
    dispose() {
      if (!active) return;
      active = false; unsubscribe(); lastOutbound.clear();
      for (const node of inputs) options.runtime.clearControl(node.id);
    },
  };
}
