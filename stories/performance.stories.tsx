import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PRESETS, compileGraph } from '../src/graph';
import { GraphEvaluator } from '../src/runtime/GraphEvaluator';
import type { RuntimeSnapshot } from '../src/runtime/types';
import { useProjectStore } from '../src/store';
import { PerformanceSurface } from '../src/performance/PerformanceSurface';

const meta = { title: 'Workspace/Performance', component: PerformanceSurface, parameters: { layout: 'fullscreen', docs: { description: { component: 'Production performer surface and real graph-derived geometry snapshots. This story never creates an AudioContext or asks for devices.' } } } } satisfies Meta<typeof PerformanceSurface>;
export default meta;
type Story = StoryObj;

function SurfaceFixture({ index, arrange = false }: { index: number; arrange?: boolean }) {
  const store = useProjectStore();
  const { loadProject } = store;
  useEffect(() => { const preset = PRESETS[index]; if (preset) loadProject(preset); }, [index, loadProject]);
  const evaluation = new GraphEvaluator(compileGraph(store.document)).evaluate({ time: 0.6, start: 0.6, end: 0.6, levels: {}, controls: new Map(), midiNotes: new Map() });
  const snapshot: RuntimeSnapshot = { time: 0.6, beat: 1.2, playing: false, audioState: 'off', level: 0, voiceCount: 0, nodes: evaluation.snapshots, diagnostics: [], capabilities: { midi: 'disabled', microphone: 'disabled', osc: 'disconnected', brain: 'disconnected' }, epoch: 0, droppedEvents: 0 };
  return <div className="performance-panel expanded" style={{ maxWidth: 1000, margin: 'auto' }}><PerformanceSurface snapshot={snapshot} arrange={arrange} /></div>;
}
export const Shapes: Story = { render: () => <SurfaceFixture index={0} /> };
export const LSystems: Story = { render: () => <SurfaceFixture index={1} /> };
export const Graphs: Story = { render: () => <SurfaceFixture index={2} /> };
export const Arrange: Story = { render: () => <SurfaceFixture index={0} arrange /> };
