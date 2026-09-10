import { describe, expect, it, vi } from 'vitest';
import type { GraphDocument } from '../graph/types';
import { AudioBrainRuntime } from '../runtime/AudioBrainRuntime';
import { bindRuntimeControls, brainNodeChannel } from './runtimeControls';

describe('production graph external-control binding', () => {
  it('routes evaluated values by saved names and releases inputs on disconnect', () => {
    const document: GraphDocument = {
      documentType: 'audiobrain.project', schemaVersion: 1, id: 'bridge-test', title: 'Bridge test',
      nodes: [
        { id: 'input', kind: 'io.brain.in', position: { x: 0, y: 0 }, params: { channel: 'test', name: 'input' } },
        { id: 'output', kind: 'io.brain.out', position: { x: 300, y: 0 }, params: { channel: 'test', name: 'output' } },
      ],
      edges: [{ id: 'edge', source: { nodeId: 'input', portId: 'value' }, target: { nodeId: 'output', portId: 'value' } }],
      performance: { version: 1, columns: 12, widgets: [] },
    };
    const runtime = new AudioBrainRuntime({ autoTick: false }); runtime.setProject(document);
    const send = vi.fn(() => true);
    const binding = bindRuntimeControls({ runtime, document, kind: 'brain', send });
    expect(binding.channels).toEqual(['test/input', 'test/output']);
    binding.receive('test/input', 0.625); runtime.tick();
    expect(send).toHaveBeenCalledWith('test/output', 0.625);
    const count = send.mock.calls.length;
    binding.dispose(); runtime.tick();
    expect(runtime.getSnapshot().nodes.input?.value).toBeUndefined();
    expect(send).toHaveBeenCalledTimes(count);
    binding.receive('test/input', 0.8); runtime.tick();
    expect(runtime.getSnapshot().nodes.input?.value).toBeUndefined();
    runtime.dispose();
  });
  it('rejects a combined channel/name that cannot fit the transport contract', () => {
    expect(() => brainNodeChannel({ id: 'out', kind: 'io.brain.out', position: { x: 0, y: 0 }, params: { channel: 'x'.repeat(128), name: 'value' } })).toThrow('128');
  });
});
