import { buildShape, pointAtPath, directedCornerEnvelopeProfile, type ShapePath } from './morphazoid/geometry.js';
import { expandLSystem, traceLSystem, branchingSnapshotAtPhase, branchAngleFrequency, branchVoiceGain, type BranchTrace } from './morphazoid/l-system.js';
import { generateGraph, type GraphModel } from './morphazoid/graph-delay.js';
import { scheduleGraphPulse, graphSynthVoice, type GraphEvent } from './morphazoid/graph-instruments.js';
import type { FeatureSnapshot, GeometrySnapshot, NoteTarget, VoiceTarget } from '../runtime/types';

export const MAX_SYMBOLS = 12_000;
export const MAX_BRANCHES = 1024;
export const MAX_EVENT_BATCH = 256;
export const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, Number.isFinite(value) ? value : low));
export const wrap = (value: number) => ((value % 1) + 1) % 1;

export interface ShapeGeometry { family: 'shape'; path: ShapePath; snapshot: GeometrySnapshot }
export interface BranchGeometry { family: 'branch'; trace: BranchTrace; snapshot: GeometrySnapshot }
export interface GraphGeometry { family: 'graph'; graph: GraphModel; snapshot: GeometrySnapshot }
export type Geometry = ShapeGeometry | BranchGeometry | GraphGeometry;
export interface GeometryFeature extends FeatureSnapshot {
  turn?: number; cornerPhase?: number; cornerStrength?: number; duration?: number;
  powerShare?: number; graphEvent?: GraphEvent; graph?: GraphModel;
}

export function shapeGeometry(sides: number, curvature: number): ShapeGeometry {
  const path = buildShape({ sides: Math.round(clamp(sides, 3, 16)), curvature: clamp(curvature, 0, 1), samplesPerEdge: 16 });
  const points = path.points.map((point, index) => ({ id: `p${index}`, x: point.x, y: -point.y }));
  return { family: 'shape', path, snapshot: { kind: 'path', points, segments: points.map((point, index) => ({ id: `s${index}`, from: point.id, to: points[(index + 1) % points.length]!.id })) } };
}

export function shapeFeatures(shape: ShapeGeometry, phase: number, heads: number): GeometryFeature[] {
  return Array.from({ length: Math.round(clamp(heads, 1, 8)) }, (_, index) => {
    const contact = pointAtPath(shape.path, phase + index / heads);
    const envelope = directedCornerEnvelopeProfile(shape.path, contact, 1);
    return { id: `head:${index}`, x: contact.x, y: -contact.y, phase: contact.u, cornerPhase: envelope.phase, cornerStrength: envelope.strength, strength: 1 };
  });
}

export function shapeVoices(features: GeometryFeature[], rootHz: number, octaves: number): VoiceTarget[] {
  return features.map((feature) => {
    // A rounded circle sustains; corners breathe on their own directed edge phase.
    // This explicit simple envelope is Audiobrain's first native voice adapter.
    const phase = feature.cornerPhase ?? 0;
    const envelope = phase < 0.08 ? 0.3 + phase / 0.08 * 0.7 : 0.24 + 0.76 * Math.exp(-(phase - 0.08) * 5);
    const corner = clamp(feature.cornerStrength ?? 0, 0, 1);
    return { id: feature.id, frequency: clamp(rootHz * 2 ** (feature.y * octaves * 0.5), 20, 20_000), amplitude: (0.32 / Math.sqrt(Math.max(1, features.length))) * (1 - corner + corner * envelope), pan: clamp(feature.x * 0.85, -1, 1), brightness: (1 + feature.y) * 0.5 };
  });
}

export function expandGrammar(axiom: string, ruleText: string, iterations: number): string {
  const rules: Record<string, string> = {};
  for (const line of ruleText.split(/[\n;]/).map((value) => value.trim()).filter(Boolean)) {
    const match = /^(.)(?:\s*)(?:->|→|=)\s*(.*)$/.exec(line);
    if (!match) throw new Error(`Invalid production rule: ${line.slice(0, 50)}. Use X -> replacement.`);
    rules[match[1]!] = match[2]!;
  }
  const expanded = expandLSystem(axiom, rules, Math.round(clamp(iterations, 0, 8)), MAX_SYMBOLS);
  let stack = 0;
  for (const symbol of expanded) { if (symbol === '[') stack++; if (symbol === ']' && --stack < 0) throw new Error('L-System has an unmatched closing bracket.'); }
  if (stack !== 0) throw new Error('L-System has unmatched branch brackets.');
  return expanded;
}

function branchPoint(point: { x: number; y: number }, trace: BranchTrace) {
  const { minX, maxX, minY, maxY } = trace.bounds;
  const scale = Math.max(1e-6, maxX - minX, maxY - minY) * 0.55;
  return { x: (point.x - (minX + maxX) / 2) / scale, y: (point.y - (minY + maxY) / 2) / scale };
}

export function branchGeometry(text: string, angleDeg: number, lengthScale: number): BranchGeometry {
  if (text.length > MAX_SYMBOLS) throw new Error(`L-System exceeds ${MAX_SYMBOLS} symbols.`);
  const trace = traceLSystem({ axiom: text, angle: angleDeg, lengthScale, maxSymbols: MAX_SYMBOLS });
  if (trace.segments.length > MAX_BRANCHES) throw new Error(`L-System exceeds ${MAX_BRANCHES} branches; reduce iterations.`);
  if (!trace.segments.length) throw new Error('L-System needs at least one F drawing symbol.');
  const { minX, maxX, minY, maxY } = trace.bounds;
  if (!Number.isFinite(trace.duration) || !Number.isFinite(maxX - minX) || !Number.isFinite(maxY - minY)
    || trace.segments.some((segment) => ![segment.start.x, segment.start.y, segment.end.x, segment.end.y, segment.startDistance, segment.endDistance].every(Number.isFinite))) {
    throw new Error('L-System branch scale exceeds the finite geometry range. Reduce repeated length scaling.');
  }
  const points = trace.segments.flatMap((segment) => [{ id: `start:${segment.index}`, ...branchPoint(segment.start, trace) }, { id: `end:${segment.index}`, ...branchPoint(segment.end, trace) }]);
  return { family: 'branch', trace, snapshot: { kind: 'path', points, segments: trace.segments.map((segment) => ({ id: `branch:${segment.index}`, from: `start:${segment.index}`, to: `end:${segment.index}` })) } };
}

export function branchFeatures(geometry: BranchGeometry, phase: number): GeometryFeature[] {
  return branchingSnapshotAtPhase(geometry.trace, phase).heads.slice(0, 64).map((head) => ({ id: head.voiceKey, ...branchPoint(head, geometry.trace), phase: head.progress, strength: Math.sqrt(head.powerShare), segmentId: `branch:${head.index}`, turn: head.cumulativeTurn, powerShare: head.powerShare }));
}

/** Half-open scheduling intervals ensure a boundary attack is emitted exactly once. */
export function branchEvents(geometry: BranchGeometry, start: number, end: number, speed: number): GeometryFeature[] {
  const trace = geometry.trace;
  const rate = clamp(speed, 0.05, 4);
  const events: GeometryFeature[] = [];
  for (let cycle = Math.floor(start * rate); cycle <= Math.floor(end * rate); cycle++) {
    for (const segment of trace.segments) {
      const time = (cycle + segment.startDistance / trace.duration) / rate;
      if (time < start - 1e-9 || time >= end - 1e-9) continue;
      const duration = clamp((segment.endDistance - segment.startDistance) / trace.duration / rate, 0.035, 2);
      events.push({ id: `branch:${cycle}:${segment.index}`, ...branchPoint(segment.start, trace), segmentId: `branch:${segment.index}`, time, duration, turn: segment.cumulativeTurn, powerShare: segment.powerShare, strength: Math.sqrt(segment.powerShare) });
      if (events.length >= MAX_EVENT_BATCH) return events;
    }
  }
  return events.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
}

export function branchNotes(events: GeometryFeature[], rootHz: number, semitonesPerTurn: number): NoteTarget[] {
  return events.map((event) => ({ id: event.id, time: event.time ?? 0, duration: event.duration ?? 0.2, frequency: branchAngleFrequency(event.turn ?? 0, rootHz, semitonesPerTurn / 12), amplitude: branchVoiceGain(event.powerShare ?? 1, 1, 0.34), pan: clamp(event.x * 0.8, -1, 1), brightness: clamp(0.35 + Math.abs(event.turn ?? 0) / (Math.PI * 4), 0, 1), articulation: 'branch' }));
}

export function graphGeometry(layers: number, nodesPerLayer: number, seed: number): GraphGeometry {
  const width = Math.round(clamp(nodesPerLayer, 1, 8));
  const columns = Math.round(clamp(layers, 2, 8));
  const graph = generateGraph({ type: 'dag', nodeCount: Math.max(3, width * columns), maxNodes: 64, density: 0.36, seed });
  // Retain Morphazoid's seeded directed edges and normalize its layout to the
  // explicit layer controls. IDs, degrees and route-turn evaluation stay intact.
  graph.nodes = graph.nodes.map((node, index) => ({ ...node, x: 0.08 + Math.floor(index / width) / Math.max(1, Math.ceil(graph.nodes.length / width) - 1) * 0.84, y: width === 1 ? 0.5 : 0.12 + (index % width) / (width - 1) * 0.76 }));
  return { family: 'graph', graph, snapshot: { kind: 'graph', points: graph.nodes.map((node) => ({ id: `node:${node.id}`, x: node.x * 2 - 1, y: 1 - node.y * 2 })), segments: graph.edges.map((edge) => ({ id: `edge:${edge.id}`, from: `node:${edge.from}`, to: `node:${edge.to}` })) } };
}

export function graphRouteEvents(geometry: GraphGeometry, edgeSeconds: number): GraphEvent[] {
  return scheduleGraphPulse(geometry.graph, { baseDelay: 4, timeScale: clamp(edgeSeconds, 0.01, 1) * 1000, dispersion: 0, timeCurve: 0.9, nodePass: 0.96, maxEvents: MAX_EVENT_BATCH, maxDepth: 64, horizonSeconds: 8, maxFeedbackPasses: 2 });
}

export function graphEvents(geometry: GraphGeometry, routes: GraphEvent[], start: number, end: number, bpm: number): GeometryFeature[] {
  const period = 240 / clamp(bpm, 20, 300);
  const horizon = routes.reduce((maximum, event) => Math.max(maximum, event.time), 0);
  const result: GeometryFeature[] = [];
  for (let pulse = Math.max(0, Math.floor((start - horizon) / period)); pulse <= Math.floor(end / period); pulse++) {
    for (let index = 0; index < routes.length; index++) {
      const route = routes[index]!;
      const time = pulse * period + route.time;
      if (time < start - 1e-9 || time >= end - 1e-9) continue;
      const node = geometry.graph.nodes[route.nodeId];
      if (!node) continue;
      result.push({ id: `pulse:${pulse}:${index}`, time, x: node.x * 2 - 1, y: 1 - node.y * 2, segmentId: route.arrivalEdgeId === null ? undefined : `edge:${route.arrivalEdgeId}`, strength: route.amplitude, turn: route.cumulativeTurn, graphEvent: route, graph: geometry.graph });
      if (result.length >= MAX_EVENT_BATCH) return result;
    }
  }
  return result.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
}

export function graphNotes(events: GeometryFeature[], rootHz: number, semitonesPerTurn: number): NoteTarget[] {
  return events.flatMap((event) => {
    if (!event.graph || !event.graphEvent) return [];
    const voice = graphSynthVoice({ ...event.graphEvent, cumulativeSemitones: (event.turn ?? 0) / (Math.PI * 2) * semitonesPerTurn }, event.graph, { rootFrequency: rootHz, quantize: false, level: 0.34, stereoSpread: 0.85 });
    return voice.inAudibleRange ? [{ id: event.id, time: event.time ?? 0, duration: 0.3, frequency: voice.frequency, amplitude: voice.gain, pan: voice.pan, brightness: voice.brightness, articulation: 'graph' as const }] : [];
  });
}
