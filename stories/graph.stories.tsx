import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { GraphEditor } from '../src/components/GraphEditor';
import { PRESETS } from '../src/graph';
import { useProjectStore } from '../src/store';

const meta = { title: 'Workspace/Graph', component: GraphEditor, parameters: { layout: 'fullscreen', docs: { description: { component: 'Complete production graph editor with typed connections and actual parameter commands. Audio and device runtime are absent from this fixture.' } } } } satisfies Meta<typeof GraphEditor>;
export default meta;
type Story = StoryObj<typeof meta>;
function GraphFixture() { const store = useProjectStore(); const { loadProject } = store; useEffect(() => { if (PRESETS[0]) loadProject(PRESETS[0]); }, [loadProject]); return <div style={{ height: 800, width: '100%' }}><GraphEditor /></div>; }
export const Shapes: Story = { render: () => <GraphFixture /> };
