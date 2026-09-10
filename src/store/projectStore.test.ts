import { afterEach, describe, expect, it, vi } from 'vitest';
import { cloneGraphDocument, PRESETS } from '../graph';
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
    store.getState().undo(); expect(store.getState().document.nodes[0]!.params.curvature).toBe(.15);
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
    expect(state.document.nodes.find(node => node.id === 'view')!.viewBindings).toEqual({});
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
