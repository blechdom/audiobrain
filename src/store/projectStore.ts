import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  PRESETS, GRAPH_LIMITS, cloneGraphDocument, createId, createNode, getOperatorDefinition,
  normalizeParameterValue, parseGraphDocument, parseWidgetLayout, serializeGraphDocument, tryCompileGraph, validateConnection,
  type GraphDocument, type GraphEndpoint, type GraphPosition, type ParameterValue, type WidgetLayout, type PerformanceWidget,
} from '../graph';

export const PROJECT_STORAGE_KEY = 'audiobrain.project.v1';
export type PersistenceState = 'saved' | 'pending' | 'failed';
export interface ProjectStoreState {
  document: GraphDocument;
  revision: number;
  selection: string | null;
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  error: string | null;
  persistenceState: PersistenceState;
  setParameter: (nodeId: string, paramId: string, value: ParameterValue) => void;
  setTitle: (title: string) => void;
  addNode: (kind: string, position?: GraphPosition) => string | null;
  duplicateNode: (id: string) => string | null;
  renameNode: (id: string, label: string) => void;
  removeNode: (id: string) => void;
  connect: (source: GraphEndpoint, target: GraphEndpoint) => boolean;
  disconnect: (edgeId: string) => void;
  moveNode: (id: string, position: GraphPosition) => void;
  selectNode: (id: string | null) => void;
  loadProject: (document: unknown) => boolean;
  addInstrument: (document: GraphDocument) => boolean;
  undo: () => void;
  redo: () => void;
  beginGesture: (id?: string) => void;
  endGesture: (id?: string) => void;
  pinParameter: (nodeId: string, paramId: string) => void;
  pinView: (nodeId: string, viewId: string) => void;
  removeWidget: (id: string) => void;
  moveWidget: (id: string, layout: WidgetLayout) => void;
  bindView: (nodeId: string, intentId: string, targetNodeId: string, paramId: string) => void;
  clearError: () => void;
}
export interface ProjectStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface CreateProjectStoreOptions { initialDocument?: GraphDocument; storage?: ProjectStorage | null; autosaveDelayMs?: number; historyLimit?: number }
export interface ProjectStoreApi extends StoreApi<ProjectStoreState> { flushPersistence: () => boolean; dispose: () => void }
function browserStorage(): ProjectStorage | null { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : 'The project could not be updated'; }
export function createProjectStore(options: CreateProjectStoreOptions = {}): ProjectStoreApi {
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const storageUnavailable = options.storage === undefined && typeof window !== 'undefined' && storage === null;
  let initial = cloneGraphDocument(options.initialDocument ?? PRESETS[0]!);
  let startupError: string | null = storageUnavailable ? 'Local autosave is unavailable. Export the project JSON to keep your work.' : null;
  if (storage && !options.initialDocument) {
    try {
      const saved = storage.getItem(PROJECT_STORAGE_KEY);
      if (saved) initial = parseGraphDocument(saved);
    } catch (error) { startupError = `Saved project could not be restored: ${errorMessage(error)}`; }
  }
  initial = parseGraphDocument(initial);
  const past: GraphDocument[] = [];
  const future: GraphDocument[] = [];
  let gesture: { id: string; start: GraphDocument; recorded: boolean } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let schedule = (): void => {};
  const store = createStore<ProjectStoreState>()((set, get) => {
    const counts = () => ({ canUndo: past.length > 0, canRedo: future.length > 0, undoCount: past.length, redoCount: future.length });
    const diagnostic = (document: GraphDocument): string | null => { const result = tryCompileGraph(document); return result.ok ? null : result.issues.map(issue => issue.message).join('\n'); };
    const savePast = (document: GraphDocument) => { past.push(cloneGraphDocument(document)); if (past.length > (options.historyLimit ?? 100)) past.shift(); };
    const commit = (document: GraphDocument, selection = get().selection): boolean => {
      try {
        const normalized = parseGraphDocument(document);
        if (JSON.stringify(normalized) === JSON.stringify(get().document)) return true;
        if (!gesture || !gesture.recorded) { savePast(gesture?.start ?? get().document); if (gesture) gesture.recorded = true; }
        future.length = 0;
        set({ document: normalized, revision: get().revision + 1, selection, ...counts(), error: diagnostic(normalized), persistenceState: storage ? 'pending' : storageUnavailable ? 'failed' : 'saved' });
        schedule(); return true;
      } catch (error) { set({ error: errorMessage(error) }); return false; }
    };
    const pin = (nodeId: string, kind: PerformanceWidget['kind'], targetId: string) => {
      const document = cloneGraphDocument(get().document);
      if (document.performance.widgets.length >= GRAPH_LIMITS.maxWidgets) { set({ error: `At most ${GRAPH_LIMITS.maxWidgets} performance controls can be pinned` }); return; }
      const field = kind === 'param' ? 'paramId' : kind === 'view' ? 'viewId' : 'portId';
      if (document.performance.widgets.some(widget => widget.kind === kind && widget.target.nodePath[0] === nodeId && widget.target[field] === targetId)) return;
      const w = Math.min(kind === 'view' ? 8 : 4, document.performance.columns);
      const h = kind === 'view' ? 6 : 1;
      let layout: WidgetLayout | undefined;
      for (let y = 0; y <= GRAPH_LIMITS.maxRows - h && !layout; y++) {
        for (let x = 0; x <= document.performance.columns - w && !layout; x++) {
          if (document.performance.widgets.every(({ layout: b }) => !(x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y))) layout = { x, y, w, h };
        }
      }
      if (!layout) { set({ error: 'The performance surface is full' }); return; }
      document.performance.widgets.push({ id: createId('widget'), kind, target: { nodePath: [nodeId], [field]: targetId }, layout });
      commit(document);
    };
    return {
      document: initial, revision: 0, selection: null, ...counts(), error: startupError ?? diagnostic(initial), persistenceState: startupError ? 'failed' : 'saved',
      setParameter(nodeId, paramId, value) {
        try {
          const document = cloneGraphDocument(get().document);
          const node = document.nodes.find(node => node.id === nodeId);
          if (!node) throw new Error(`Missing node ${nodeId}`);
          const parameter = getOperatorDefinition(node.kind).params.find(parameter => parameter.id === paramId);
          if (!parameter) throw new Error(`Unknown parameter ${paramId}`);
          node.params[paramId] = normalizeParameterValue(value, parameter);
          // Choosing an event mode in an older Synth patch also supplies its
          // missing optional event cable. Existing input ownership is preserved.
          if (node.kind === 'shapes.mapping' && paramId === 'playingMode' && value !== 'continuous') {
            for (const edge of [...document.edges]) {
              if (edge.source.nodeId !== nodeId || edge.source.portId !== 'voices' || edge.target.portId !== 'voices') continue;
              const bank = document.nodes.find(candidate => candidate.id === edge.target.nodeId && candidate.kind === 'voice.continuous');
              if (bank && !document.edges.some(candidate => candidate.target.nodeId === bank.id && candidate.target.portId === 'notes')) {
                document.edges.push({ id: createId('edge'), source: { nodeId, portId: 'notes' }, target: { nodeId: bank.id, portId: 'notes' } });
              }
            }
          }
          commit(document);
        } catch (error) { set({ error: errorMessage(error) }); }
      },
      setTitle(title) { commit({ ...get().document, title }); },
      addNode(kind, position) {
        try {
          const node = createNode(kind, position ?? { x: 100 + get().document.nodes.length * 24, y: 80 + get().document.nodes.length * 24 });
          return commit({ ...get().document, nodes: [...get().document.nodes, node] }, node.id) ? node.id : null;
        } catch (error) { set({ error: errorMessage(error) }); return null; }
      },
      duplicateNode(id) {
        const document = cloneGraphDocument(get().document);
        const source = document.nodes.find(node => node.id === id);
        if (!source) { set({ error: `Missing node ${id}` }); return null; }
        const copy = structuredClone(source);
        copy.id = createId('node');
        const base = source.label ?? getOperatorDefinition(source.kind).title;
        let suffix = 2;
        do { copy.label = `${base.slice(0, 85)} ${suffix++}`; } while (document.nodes.some(node => node.label === copy.label));
        copy.position = { x: source.position.x + 48, y: source.position.y + 48 };
        for (const binding of Object.values(copy.viewBindings ?? {})) if (binding.nodePath[0] === id) binding.nodePath = [copy.id];
        document.nodes.push(copy);
        return commit(document, copy.id) ? copy.id : null;
      },
      renameNode(id, label) {
        const document = cloneGraphDocument(get().document);
        const node = document.nodes.find(node => node.id === id);
        if (!node) { set({ error: `Missing node ${id}` }); return; }
        if (label.trim()) node.label = label.trim(); else delete node.label;
        commit(document);
      },
      removeNode(id) {
        const document = cloneGraphDocument(get().document);
        document.nodes = document.nodes.filter(node => node.id !== id);
        document.edges = document.edges.filter(edge => edge.source.nodeId !== id && edge.target.nodeId !== id);
        document.performance.widgets = document.performance.widgets.filter(widget => widget.target.nodePath[0] !== id);
        for (const node of document.nodes) if (node.viewBindings) for (const [intent, binding] of Object.entries(node.viewBindings)) if (binding.nodePath[0] === id) delete node.viewBindings[intent];
        commit(document, get().selection === id ? null : get().selection);
      },
      connect(source, target) {
        const validation = validateConnection(get().document, source, target);
        if (!validation.valid) { set({ error: validation.message ?? 'Invalid connection' }); return false; }
        return commit({ ...get().document, edges: [...get().document.edges, { id: createId('edge'), source, target }] });
      },
      disconnect(edgeId) { commit({ ...get().document, edges: get().document.edges.filter(edge => edge.id !== edgeId) }); },
      moveNode(id, position) { commit({ ...get().document, nodes: get().document.nodes.map(node => node.id === id ? { ...node, position } : node) }); },
      selectNode(id) { set({ selection: id === null || get().document.nodes.some(node => node.id === id) ? id : null }); },
      loadProject(value) {
        gesture = null;
        try {
          const document = parseGraphDocument(value);
          const result = tryCompileGraph(document);
          // An unfinished draft can omit an input; corrupt topology must not
          // replace the current instrument during an import.
          if (!result.ok) {
            const fatal = result.issues.filter(issue => issue.code !== 'required-input');
            if (fatal.length) throw new Error(fatal.map(issue => issue.message).join('\n'));
          }
          return commit(document, null);
        } catch (error) { set({ error: errorMessage(error) }); return false; }
      },
      addInstrument(source) {
        try {
          const addition = parseGraphDocument(source);
          const document = cloneGraphDocument(get().document);
          const ids = new Map(addition.nodes.map(node => [node.id, createId('node')]));
          const y = document.nodes.reduce((max, node) => Math.max(max, node.position.y + 420), 0);
          const row = document.performance.widgets.reduce((max, widget) => Math.max(max, widget.layout.y + widget.layout.h), 0);
          const instance = document.nodes.filter(node => node.kind === addition.nodes[0]?.kind).length + 1;
          for (const node of addition.nodes) {
            node.id = ids.get(node.id)!;
            node.label = `${(node.label ?? getOperatorDefinition(node.kind).title).slice(0, 85)} ${instance}`;
            node.position.y += y;
            for (const binding of Object.values(node.viewBindings ?? {})) binding.nodePath = [ids.get(binding.nodePath[0])!];
          }
          for (const edge of addition.edges) { edge.id = createId('edge'); edge.source.nodeId = ids.get(edge.source.nodeId)!; edge.target.nodeId = ids.get(edge.target.nodeId)!; }
          for (const widget of addition.performance.widgets) { widget.id = createId('widget'); widget.target.nodePath = [ids.get(widget.target.nodePath[0])!]; widget.layout.y += row; }
          document.nodes.push(...addition.nodes); document.edges.push(...addition.edges); document.performance.widgets.push(...addition.performance.widgets);
          return commit(document, addition.nodes[0]?.id ?? null);
        } catch (error) { set({ error: errorMessage(error) }); return false; }
      },
      beginGesture(id = 'gesture') { if (gesture?.id !== id) gesture = { id, start: cloneGraphDocument(get().document), recorded: false }; },
      endGesture(id) { if (id === undefined || gesture?.id === id) gesture = null; },
      undo() { gesture = null; const document = past.pop(); if (!document) return; future.push(cloneGraphDocument(get().document)); set({ document, revision: get().revision + 1, selection: null, ...counts(), error: diagnostic(document), persistenceState: storage ? 'pending' : storageUnavailable ? 'failed' : 'saved' }); schedule(); },
      redo() { gesture = null; const document = future.pop(); if (!document) return; savePast(get().document); set({ document, revision: get().revision + 1, selection: null, ...counts(), error: diagnostic(document), persistenceState: storage ? 'pending' : storageUnavailable ? 'failed' : 'saved' }); schedule(); },
      pinParameter(nodeId, paramId) { pin(nodeId, 'param', paramId); },
      pinView(nodeId, viewId) { pin(nodeId, 'view', viewId); },
      removeWidget(id) { commit({ ...get().document, performance: { ...get().document.performance, widgets: get().document.performance.widgets.filter(widget => widget.id !== id) } }); },
      moveWidget(id, layout) {
        try {
          const normalized = parseWidgetLayout(layout, get().document.performance.columns);
          commit({ ...get().document, performance: { ...get().document.performance, widgets: get().document.performance.widgets.map(widget => widget.id === id ? { ...widget, layout: normalized } : widget) } });
        } catch (error) { set({ error: errorMessage(error) }); }
      },
      bindView(nodeId, intentId, targetNodeId, paramId) {
        commit({ ...get().document, nodes: get().document.nodes.map(node => node.id === nodeId ? { ...node, viewBindings: { ...node.viewBindings, [intentId]: { nodePath: [targetNodeId], paramId } } } : node) });
      },
      clearError() { set({ error: null }); },
    };
  });
  const flushPersistence = (): boolean => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!storage || disposed) return true;
    try { storage.setItem(PROJECT_STORAGE_KEY, serializeGraphDocument(store.getState().document)); store.setState({ persistenceState: 'saved' }); return true; }
    catch (error) { store.setState({ persistenceState: 'failed', error: `Autosave failed: ${errorMessage(error)}` }); return false; }
  };
  schedule = () => { if (timer) clearTimeout(timer); if (storage && !disposed) timer = setTimeout(flushPersistence, options.autosaveDelayMs ?? 300); };
  const flushOnHide = () => { if (typeof document === 'undefined' || document.visibilityState === 'hidden') flushPersistence(); };
  if (typeof window !== 'undefined') { window.addEventListener('pagehide', flushPersistence); document.addEventListener('visibilitychange', flushOnHide); }
  return Object.assign(store, { flushPersistence, dispose() { flushPersistence(); disposed = true; if (typeof window !== 'undefined') { window.removeEventListener('pagehide', flushPersistence); document.removeEventListener('visibilitychange', flushOnHide); } } });
}
export const projectStore = createProjectStore();
export const useProjectStore = <T = ProjectStoreState>(selector: (state: ProjectStoreState) => T = (state) => state as unknown as T): T => useStore(projectStore, selector);
