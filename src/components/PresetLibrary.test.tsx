import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PresetLibrary } from './PresetLibrary';
import type { PresetLibraryEntry } from './PresetLibrary';

const entries: PresetLibraryEntry[] = [
  { id: 'example-shapes', title: 'Morphazoid Shapes', family: 'Shapes', category: 'Instrument', origin: 'audiobrain', status: 'ready', requirements: [], description: 'An AudioBrain instrument.' },
  { id: 'source:grammar:plant', title: 'Branching Plant', family: 'L-Systems', category: 'Grammar', origin: 'morphazoid', status: 'ready', requirements: ['Rebuilds grammar and branch geometry.'], source: { page: 'l-systems.html', url: 'https://github.com/blechdom/morphazoid/blob/fixed/l-systems-app.js', revision: 'abcdef1234567890' } },
  { id: 'source:delay:patch', title: 'Recursive Wet', family: 'Graphs', category: 'Delay patch', origin: 'morphazoid', status: 'blocked', requirements: ['Graph Delay microphone processing'], source: { page: 'graph-delay.html', url: 'https://github.com/blechdom/morphazoid/blob/fixed/graph-delay-app.js', revision: 'abcdef1234567890' } },
];

afterEach(cleanup);

describe('PresetLibrary', () => {
  it('keeps unsupported source presets visible and exportable without offering a substituted graph', async () => {
    const user = userEvent.setup();
    const onLoad = vi.fn(); const onAdd = vi.fn(); const onExport = vi.fn();
    render(<PresetLibrary entries={entries} onLoad={onLoad} onAdd={onAdd} onExport={onExport} />);
    const title = screen.getByRole('heading', { name: 'Recursive Wet' });
    const card = within(title.closest('article')!);
    expect(card.getByText('Needs features')).toBeVisible();
    expect(card.getByText('Graph Delay microphone processing')).toBeVisible();
    expect(card.queryByRole('button', { name: /^(Load|Add) / })).toBeNull();
    await user.click(card.getByRole('button', { name: 'Export source preset Recursive Wet' }));
    expect(onExport).toHaveBeenCalledExactlyOnceWith('source:delay:patch');
    expect(onLoad).not.toHaveBeenCalled(); expect(onAdd).not.toHaveBeenCalled();
    await user.click(card.getByText('Original source and identity'));
    expect(card.getByText('source:delay:patch')).toBeVisible();
    expect(card.getByRole('link', { name: 'graph-delay.html' })).toHaveAttribute('href', entries[2]!.source!.url);
  });

  it('finds presets by family, type, source page and availability and loads the selected stable identity', async () => {
    const user = userEvent.setup();
    const onLoad = vi.fn(); const onAdd = vi.fn();
    render(<PresetLibrary entries={entries} onLoad={onLoad} onAdd={onAdd} onExport={vi.fn()} />);
    await user.type(screen.getByRole('searchbox', { name: 'Search presets' }), 'l-systems.html');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Preset family' }), 'L-Systems');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Preset type' }), 'Grammar');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Preset availability' }), 'ready');
    expect(screen.getByRole('status')).toHaveTextContent('1 of 3 presets');
    expect(screen.queryByRole('heading', { name: 'Recursive Wet' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Load Branching Plant' }));
    await user.click(screen.getByRole('button', { name: 'Add Branching Plant' }));
    expect(onLoad).toHaveBeenCalledExactlyOnceWith('source:grammar:plant');
    expect(onAdd).toHaveBeenCalledExactlyOnceWith('source:grammar:plant');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('status')).toHaveTextContent('3 of 3 presets');
    expect(screen.getByRole('heading', { name: 'Recursive Wet' })).toBeVisible();
  });

  it('searches the complete archive while mounting only a bounded page of cards', async () => {
    const user = userEvent.setup();
    const archive: PresetLibraryEntry[] = Array.from({ length: 1200 }, (_, index) => ({ ...entries[2]!, id: `archive:${index}`, title: `Archived sound ${index}` }));
    render(<PresetLibrary entries={archive} onLoad={vi.fn()} onAdd={vi.fn()} onExport={vi.fn()} />);
    expect(screen.getAllByRole('article')).toHaveLength(48);
    expect(screen.queryByRole('heading', { name: 'Archived sound 1199' })).toBeNull();
    await user.type(screen.getByRole('searchbox', { name: 'Search presets' }), '1199');
    expect(screen.getByRole('heading', { name: 'Archived sound 1199' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('1 of 1200 presets');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await user.click(screen.getByRole('button', { name: 'Show 48 more presets' }));
    expect(screen.getAllByRole('article')).toHaveLength(96);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Preset family' }), 'Graphs');
    expect(screen.getAllByRole('article')).toHaveLength(48);
  });
});
