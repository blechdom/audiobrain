import type { CompiledGraph, CompiledNode, GraphParams } from '../graph';
import { shapeGeometry, shapeFeatures, shapeVoices, expandGrammar, branchGeometry, branchFeatures, branchEvents, branchNotes, graphGeometry, graphRouteEvents, graphEvents, graphNotes, clamp, type Geometry, type GeometryFeature, type ShapeGeometry, type BranchGeometry, type GraphGeometry } from '../instruments/geometry';
import type { GraphEvent } from '../instruments/morphazoid/graph-instruments.js';
import type { NodeSnapshot, NoteTarget, VoiceTarget } from './types';

interface Features { features: GeometryFeature[]; events: GeometryFeature[]; geometry?: Geometry }
export interface AudioEvaluation { id: string; kind: string; params: GraphParams; voices?: VoiceTarget[]; notes?: NoteTarget[] }
export interface Evaluation { snapshots: Record<string, NodeSnapshot>; audio: AudioEvaluation[]; bpm: number; midi: { id: string; notes: NoteTarget[]; channel: number }[] }
interface EvalContext {
  time: number; start: number; end: number; levels: Record<string, number>;
  controls: ReadonlyMap<string, number>; midiNotes: ReadonlyMap<string, NoteTarget[]>;
}

/** Pure bounded dataflow apart from memoized geometry and rate/phase anchors. */
export class GraphEvaluator {
  private cache = new Map<string, { key: string; value: unknown }>();
  private phases = new Map<string, { rate: number; anchor: number; phase: number }>();
  readonly graph: CompiledGraph;
  constructor(graph: CompiledGraph, previous?: GraphEvaluator) {
    this.graph = graph;
    if (previous) {
      const ids = new Set(graph.nodes.map(({ node }) => node.id));
      this.cache = new Map([...previous.cache].filter(([id]) => ids.has(id) || (id.endsWith(':routes') && ids.has(id.slice(0, -7)))));
      this.phases = new Map([...previous.phases].filter(([id]) => ids.has(id)).map(([id, phase]) => [id, { ...phase }]));
    }
  }
  reset(): void { this.phases.clear(); }
  private memo<T>(id: string, key: unknown, factory: () => T): T {
    const signature = JSON.stringify(key);
    const cached = this.cache.get(id);
    if (cached?.key === signature) return cached.value as T;
    const value = factory(); this.cache.set(id, { key: signature, value }); return value;
  }
  private phase(id: string, rate: number, time: number): { value: number; offset: number } {
    let anchor = this.phases.get(id);
    if (!anchor) { anchor = { rate, anchor: 0, phase: 0 }; this.phases.set(id, anchor); }
    if (rate !== anchor.rate) { anchor.phase += (time - anchor.anchor) * anchor.rate; anchor.anchor = time; anchor.rate = rate; }
    return { value: anchor.phase + (time - anchor.anchor) * rate, offset: anchor.anchor - anchor.phase / rate };
  }
  evaluate(context: EvalContext): Evaluation {
    const values = new Map<string, unknown>();
    const snapshots: Record<string, NodeSnapshot> = {};
    const audio: AudioEvaluation[] = [], midi: Evaluation['midi'] = [];
    let bpm = 120;
    for (const compiled of this.graph.nodes) {
      const { node, definition } = compiled;
      const input = <T>(name: string): T | undefined => {
        const binding = compiled.inputs[name];
        return binding ? values.get(`${binding.sourceNodeId}/${binding.sourcePortId}`) as T | undefined : undefined;
      };
      const output = (name: string, value: unknown) => values.set(`${node.id}/${name}`, value);
      const params = this.params(compiled, input);
      const num = (id: string) => Number(params[id]);
      const snapshot: NodeSnapshot = { params: Object.fromEntries(Object.entries(params).filter((entry): entry is [string, number] => typeof entry[1] === 'number')) };
      snapshots[node.id] = snapshot;
      switch (node.kind) {
        case 'transport': bpm = num('bpm'); output('state', { bpm, time: context.time }); snapshot.value = context.time * bpm / 60; break;
        case 'control.constant': output('value', num('value')); snapshot.value = num('value'); break;
        case 'control.lfo': {
          const phase = this.phase(node.id, num('rateHz'), context.time).value;
          const value = num('min') + (0.5 + Math.sin(phase * Math.PI * 2) * 0.5) * (num('max') - num('min'));
          output('value', value); snapshot.value = value; break;
        }
        case 'control.map': {
          const incoming = input<number>('value');
          if (incoming === undefined) { output('value', undefined); break; }
          const span = num('inMax') - num('inMin');
          const fraction = span === 0 ? 0 : clamp((incoming - num('inMin')) / span, 0, 1);
          const value = num('outMin') + fraction * (num('outMax') - num('outMin'));
          output('value', value); snapshot.value = value; break;
        }
        case 'shapes.geometry': {
          const geometry = this.memo(node.id, [num('sides'), num('curvature')], () => shapeGeometry(num('sides'), num('curvature')));
          output('path', geometry); snapshot.geometry = geometry.snapshot; break;
        }
        case 'shapes.reader': {
          const geometry = input<ShapeGeometry>('path');
          if (!geometry || geometry.family !== 'shape') throw new Error('Shape Reader requires a Shapes contour.');
          const phase = this.phase(node.id, num('rateHz'), context.time).value;
          const features = shapeFeatures(geometry, phase, num('heads'));
          output('features', { features, events: [], geometry } satisfies Features); snapshot.geometry = geometry.snapshot; snapshot.features = features; break;
        }
        case 'shapes.mapping': {
          const features = input<Features>('features'); const voices = shapeVoices(features?.features ?? [], num('rootHz'), num('rangeOctaves'));
          output('voices', voices); snapshot.features = features?.features; break;
        }
        case 'lsystem.grammar': output('text', this.memo(node.id, params, () => expandGrammar(String(params.axiom), String(params.rules), num('iterations')))); break;
        case 'lsystem.geometry': {
          const text = input<string>('text') ?? '';
          const geometry = this.memo(node.id, [text, params], () => branchGeometry(text, num('angleDeg'), num('lengthScale')));
          output('path', geometry); snapshot.geometry = geometry.snapshot; break;
        }
        case 'lsystem.frontier': {
          const geometry = input<BranchGeometry>('path');
          if (!geometry || geometry.family !== 'branch') throw new Error('L-System Frontier requires branch paths with parent and distance metadata.');
          const rate = num('speed'), phase = this.phase(node.id, rate, context.time);
          const features = branchFeatures(geometry, phase.value);
          const events = branchEvents(geometry, context.start - phase.offset, context.end - phase.offset, rate).map((event) => ({ ...event, time: (event.time ?? 0) + phase.offset }));
          output('features', { features, events, geometry } satisfies Features); snapshot.geometry = geometry.snapshot; snapshot.features = features; snapshot.activeIds = features.flatMap((feature) => feature.segmentId ? [feature.segmentId] : []); break;
        }
        case 'mapping.branchNotes': {
          const features = input<Features>('features');
          if (features?.geometry?.family !== 'branch') throw new Error('Branches to Notes requires branch distance and power-share metadata.');
          output('notes', branchNotes(features.events, num('rootHz'), num('semitonesPerTurn'))); break;
        }
        case 'graph.topology': {
          const geometry = this.memo(node.id, params, () => graphGeometry(num('layers'), num('nodesPerLayer'), num('seed')));
          output('graph', geometry); snapshot.geometry = geometry.snapshot; break;
        }
        case 'graph.walk': {
          const geometry = input<GraphGeometry>('graph');
          if (!geometry || geometry.family !== 'graph') throw new Error('Graph Walk requires a directed topology.');
          const routes = this.memo<GraphEvent[]>(`${node.id}:routes`, [geometry.graph, num('edgeSeconds')], () => graphRouteEvents(geometry, num('edgeSeconds')));
          const transport = input<{ bpm: number }>('transport');
          const tempo = transport?.bpm ?? bpm;
          const events = graphEvents(geometry, routes, context.start, context.end, tempo);
          const features = graphEvents(geometry, routes, Math.max(0, context.time - 0.16), context.time + 0.001, tempo).map((event) => ({ ...event, strength: (event.strength ?? 1) * Math.max(0, 1 - (context.time - (event.time ?? 0)) / 0.16) }));
          output('features', { features, events, geometry } satisfies Features); snapshot.geometry = geometry.snapshot; snapshot.features = features; snapshot.activeIds = features.flatMap((feature) => feature.segmentId ? [feature.segmentId] : []); break;
        }
        case 'mapping.graphNotes': {
          const features = input<Features>('features');
          if (features?.geometry?.family !== 'graph') throw new Error('Graph to Notes requires directed route and cumulative-turn metadata.');
          output('notes', graphNotes(features.events, num('rootHz'), num('semitonesPerTurn'))); break;
        }
        case 'voice.continuous': audio.push({ id: node.id, kind: node.kind, params, voices: input<VoiceTarget[]>('voices') ?? [] }); break;
        case 'voice.poly': case 'voice.graph': audio.push({ id: node.id, kind: node.kind, params, notes: input<NoteTarget[]>('notes') ?? [] }); break;
        case 'analysis.level': { const level = context.levels[node.id] ?? 0; snapshot.level = snapshot.value = level; output('level', level); break; }
        case 'view.shapes': case 'view.path': case 'view.graph': {
          const geometry = input<Geometry>('path') ?? input<Geometry>('graph');
          const features = input<Features>('features'); snapshot.geometry = geometry?.snapshot;
          snapshot.features = features?.features ?? []; snapshot.activeIds = features?.features.flatMap((feature) => feature.segmentId ? [feature.segmentId] : []); break;
        }
        case 'io.midi.in': { output('notes', context.midiNotes.get(node.id) ?? []); const value = context.controls.get(node.id); output('value', value); snapshot.value = value; break; }
        case 'io.midi.out': midi.push({ id: node.id, notes: input<NoteTarget[]>('notes') ?? [], channel: num('channel') }); break;
        case 'io.osc.in': case 'io.brain.in': { const value = context.controls.get(node.id); output('value', value); snapshot.value = value; break; }
        case 'io.osc.out': case 'io.brain.out': snapshot.value = input<number>('value') ?? 0; break;
        default:
          if (node.kind.startsWith('audio.')) audio.push({ id: node.id, kind: node.kind, params });
          else throw new Error(`Runtime does not implement ${definition.title}.`);
      }
    }
    return { snapshots, audio, bpm, midi };
  }
  private params(compiled: CompiledNode, input: <T>(name: string) => T | undefined): GraphParams {
    const result: GraphParams = {};
    for (const param of compiled.definition.params) {
      const literal = compiled.node.params[param.id] ?? param.default;
      if (param.type === 'number' || param.type === 'integer') {
        const connected = input<number>(param.id);
        const value = clamp(connected === undefined ? Number(literal) : connected, param.min, param.max);
        result[param.id] = param.type === 'integer' ? Math.round(value) : value;
      } else result[param.id] = literal;
    }
    return result;
  }
}
