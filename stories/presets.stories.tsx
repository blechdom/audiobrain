import type { Meta, StoryObj } from '@storybook/react-vite';
import { PresetLibrary } from '../src/components/PresetLibrary';
import { PRESET_LIBRARY_ENTRIES } from '../src/presets';

const meta = {
  title: 'Workspace/Presets',
  component: PresetLibrary,
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'The production preset library and extracted Morphazoid catalog. Filters, source identities and availability come from the same data used by AudioBrain. Story actions never request devices or start audio.' } },
  },
  args: { entries: PRESET_LIBRARY_ENTRIES, onLoad: () => undefined, onAdd: () => undefined, onExport: () => undefined },
  decorators: [Story => <div style={{ maxWidth: 960, margin: 'auto', padding: 24 }}><Story /></div>],
} satisfies Meta<typeof PresetLibrary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Library: Story = {};
export const SourcePresets: Story = { args: { entries: PRESET_LIBRARY_ENTRIES.filter(entry => entry.origin === 'morphazoid') } };
