import { afterEach, describe, expect, it, vi } from 'vitest';
import { cloneGraphDocument, parseGraphDocument, serializeGraphDocument, PRESETS } from '../graph';
import { createProjectStore, PROJECT_STORAGE_KEY, type ProjectStoreApi } from './projectStore';
const stores: ProjectStoreApi[] = [];
const fresh = () => { const store = createProjectStore({ storage: null, initialDocument: PRESETS[0]! }); stores.push(store); return store; };
afterEach(() => { stores.splice(0).forEach(store => store.dispose()); vi.useRealTimers(); });
describe('project commands', () => {
  it('groups a performance gesture into one undo entry shared with node controls', () => {
    const store = fresh(); const state = store.getState();
    state.beginGesture('curvature');
    state.setParameter('geometry', 'curvature', .3);
    state.setParameter('geometry', 'curvature', .7);
    state.endGesture('curvature');
    expect(store.getState().undoCount).toBe(1);
    expect(store.getState().document.nodes[0]!.params.curvature).toBe(.7);
    store.getState().undo(); expect(store.getState().document.nodes[0]!.params.curvature).toBe(0);
    store.getState().redo(); expect(store.getState().document.nodes[0]!.params.curvature).toBe(.7);
  });
  it('rejects invalid commands transactionally and makes the error observable', () => {
    const store = fresh(); const before = store.getState().document;
    store.getState().setParameter('geometry', 'sides', 1000);
    expect(store.getState().document).toBe(before);
    expect(store.getState().error).toContain('integer');
    expect(store.getState().connect({ nodeId: 'geometry', portId: 'path' }, { nodeId: 'gain', portId: 'db' })).toBe(false);
    expect(store.getState().document).toBe(before);
    expect(store.getState().undoCount).toBe(0);
  });
  it('retains incomplete edits and diagnoses them without silently undoing cables', () => {
    const store = fresh(); const edge = store.getState().document.edges.find(edge => edge.target.nodeId === 'out')!;
    store.getState().disconnect(edge.id);
    expect(store.getState().document.edges.some(item => item.id === edge.id)).toBe(false);
    expect(store.getState().error).toContain('connect');
    store.getState().undo(); expect(store.getState().error).toBeNull();
  });
  it('cleans associated cables, widgets and view targets when removing a node', () => {
    const store = fresh(); store.getState().selectNode('geometry'); store.getState().removeNode('geometry');
    const state = store.getState();
    expect(state.selection).toBeNull();
    expect(state.document.edges.every(edge => edge.source.nodeId !== 'geometry' && edge.target.nodeId !== 'geometry')).toBe(true);
    expect(state.document.performance.widgets.every(widget => widget.target.nodePath[0] !== 'geometry')).toBe(true);
    expect(Object.values(state.document.nodes.find(node => node.id === 'view')!.viewBindings ?? {}).every(binding => binding.nodePath[0] !== 'geometry')).toBe(true);
  });
  it('pins one control once and removing it preserves the underlying node', () => {
    const store = fresh(); const widgets = store.getState().document.performance.widgets.length;
    store.getState().pinParameter('transport', 'bpm'); store.getState().pinParameter('transport', 'bpm');
    expect(store.getState().document.performance.widgets).toHaveLength(widgets + 1);
    const widget = store.getState().document.performance.widgets.at(-1)!;
    store.getState().removeWidget(widget.id);
    expect(store.getState().document.nodes.some(node => node.id === 'transport')).toBe(true);
    expect(store.getState().document.performance.widgets).toHaveLength(widgets);
  });
  it('preserves the previous project after a foreign or broken import', () => {
    const store = fresh(); const before = store.getState().document;
    const foreign = { ...cloneGraphDocument(PRESETS[1]!), documentType: 'foreign' };
    expect(store.getState().loadProject(foreign)).toBe(false);
    expect(store.getState().document).toBe(before);
    const corrupt = cloneGraphDocument(PRESETS[1]!);
    corrupt.edges[0]!.source.nodeId = 'missing';
    expect(store.getState().loadProject(corrupt)).toBe(false);
    expect(store.getState().document).toBe(before);
    expect(store.getState().loadProject(PRESETS[1]!)).toBe(true);
    expect(store.getState().document.title).toBe('Morphazoid L-Systems');
    store.getState().undo(); expect(store.getState().document).toEqual(before);
  });
});
describe('local persistence', () => {
  it('debounces, stores only the versioned project and reports storage failure', () => {
    vi.useFakeTimers(); const setItem = vi.fn<(key: string, value: string) => void>();
    const store = createProjectStore({ storage: { getItem: () => null, setItem }, autosaveDelayMs: 300 }); stores.push(store);
    store.getState().setTitle('Saved Shapes'); store.getState().setTitle('Saved Morphazoid');
    expect(setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem.mock.calls[0]![0]).toBe(PROJECT_STORAGE_KEY);
    const saved = JSON.parse(setItem.mock.calls[0]![1]) as Record<string, unknown>;
    expect(saved.title).toBe('Saved Morphazoid'); expect(saved.selection).toBeUndefined(); expect(saved.revision).toBeUndefined();
    setItem.mockImplementation(() => { throw new Error('Quota exceeded'); });
    store.getState().setTitle('Quota'); store.flushPersistence();
    expect(store.getState().persistenceState).toBe('failed');
    expect(store.getState().error).toContain('Autosave failed');
  });
  it('recovers corrupt saved data with a visible diagnostic', () => {
    const store = createProjectStore({ storage: { getItem: () => '{', setItem: () => {} } }); stores.push(store);
    expect(store.getState().document.id).toBe(PRESETS[0]!.id);
    expect(store.getState().error).toContain('could not be restored');
  });
});

describe('object identity', () => {
  it('switches a legacy Synth patch to event modes in one undo step without taking over an occupied input', () => {
    const store = fresh();
    store.getState().disconnect('mapping-notes-to-voices-notes');
    const before = store.getState().document;
    store.getState().setParameter('mapping', 'playingMode', 'notes');
    expect(store.getState().document.edges.filter(edge => edge.target.nodeId === 'voices' && edge.target.portId === 'notes')).toHaveLength(1);
    store.getState().undo(); expect(store.getState().document).toEqual(before);
    store.getState().redo();
    const route = store.getState().document.edges.find(edge => edge.target.nodeId === 'voices' && edge.target.portId === 'notes')!;
    store.getState().setParameter('mapping', 'playingMode', 'triggers');
    expect(store.getState().document.edges.filter(edge => edge.target.nodeId === 'voices' && edge.target.portId === 'notes')).toEqual([route]);
  });
  it('duplicates parameters with a fresh persistent identity and independent edits', () => {
    const store = fresh();
    store.getState().renameNode('geometry', 'Outer shape');
    const id = store.getState().duplicateNode('geometry')!;
    expect(id).not.toBe('geometry');
    expect(store.getState().selection).toBe(id);
    expect(store.getState().document.nodes.find(node => node.id === id)?.label).toBe('Outer shape 2');
    store.getState().setParameter(id, 'curvature', -.4);
    store.getState().renameNode(id, 'Inner shape');
    const restored = parseGraphDocument(serializeGraphDocument(store.getState().document));
    expect(restored.nodes.find(node => node.id === id)).toMatchObject({ id, label: 'Inner shape', params: { curvature: -.4 } });
    expect(restored.nodes.find(node => node.id === 'geometry')).toMatchObject({ label: 'Outer shape', params: { curvature: 0 } });
    expect(restored.edges.every(edge => edge.source.nodeId !== id && edge.target.nodeId !== id)).toBe(true);
    expect(restored.performance.widgets.filter(widget => widget.target.nodePath[0] === 'geometry').length).toBeGreaterThan(0);
    store.getState().undo(); store.getState().undo(); store.getState().undo();
    expect(store.getState().document.nodes.some(node => node.id === id)).toBe(false);
    store.getState().redo();
    expect(store.getState().document.nodes.some(node => node.id === id)).toBe(true);
  });
  it('adds a complete second instrument with its own cables, view bindings and performance controls', () => {
    const store = fresh(); const original = store.getState().document;
    expect(store.getState().addInstrument(PRESETS[0]!)).toBe(true);
    const combined = store.getState().document;
    expect(combined.nodes).toHaveLength(original.nodes.length * 2);
    const originals = new Set(original.nodes.map(node => node.id));
    const additions = new Set(combined.nodes.filter(node => !originals.has(node.id)).map(node => node.id));
    expect(additions.size).toBe(original.nodes.length);
    for (const edge of combined.edges.slice(original.edges.length)) { expect(additions.has(edge.source.nodeId)).toBe(true); expect(additions.has(edge.target.nodeId)).toBe(true); }
    for (const node of combined.nodes.filter(node => additions.has(node.id))) for (const binding of Object.values(node.viewBindings ?? {})) expect(additions.has(binding.nodePath[0])).toBe(true);
    for (const widget of combined.performance.widgets.slice(original.performance.widgets.length)) expect(additions.has(widget.target.nodePath[0])).toBe(true);
    expect(parseGraphDocument(serializeGraphDocument(combined))).toEqual(combined);
    store.getState().undo(); expect(store.getState().document).toEqual(original);
    store.getState().redo(); expect(store.getState().document).toEqual(combined);
  });
  it('preserves old authored curvature and adds only missing gesture bindings from connected nodes', () => {
    const old = cloneGraphDocument(PRESETS[0]!);
    old.nodes.find(node => node.id === 'geometry')!.params.curvature = .15;
    old.nodes.find(node => node.id === 'view')!.viewBindings = { curvature: { nodePath: ['geometry'], paramId: 'curvature' } };
    const restored = parseGraphDocument(old);
    expect(restored.nodes.find(node => node.id === 'geometry')!.params.curvature).toBe(.15);
    expect(restored.nodes.find(node => node.id === 'view')!.viewBindings).toMatchObject({ rotation: { nodePath: ['geometry'], paramId: 'rotationDeg' }, scrub: { nodePath: ['reader'], paramId: 'phaseOffset' } });
  });
});
