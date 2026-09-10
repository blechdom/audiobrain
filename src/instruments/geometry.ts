import { buildShape, pointAtPath, directedCornerEnvelopeProfile, horizontalIntersections, verticalIntersections, rayIntersections, shapes2dContactContourDirection, type PathContact, type ShapePath } from './morphazoid/geometry.js';
import { expandLSystem, traceLSystem, branchingSnapshotAtPhase, branchAngleFrequency, branchVoiceGain, type BranchTrace } from './morphazoid/l-system.js';
import { generateGraph, type GraphModel } from './morphazoid/graph-delay.js';
import { scheduleGraphPulse, graphSynthVoice, type GraphEvent } from './morphazoid/graph-instruments.js';
import type { FeatureSnapshot, GeometrySnapshot, NoteTarget, ShapeReaderSnapshot, VoiceTarget } from '../runtime/types';

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
  pitch01?: number; pan?: number; drive?: number; sourceStrength?: number;
  edgeIndex?: number; regionKey?: string; sourceEnvelope?: number;
}

export interface ShapeHead {
  headIndex: number;
  travel: number;
  direction: 1 | -1;
  axis: 'vertical' | 'horizontal';
  reader?: ShapeReaderSnapshot['type'];
}
export interface ShapeReading { features: GeometryFeature[]; readers: ShapeReaderSnapshot[] }

/** Match shapes-state.js: ping-pong folds continuous travel before reading. */
export function foldShapePhase(travel: number, motion: 'loop' | 'pingpong'): number {
  if (motion === 'loop') return wrap(travel);
  const folded = ((travel % 2) + 2) % 2;
  return folded <= 1 ? folded : 2 - folded;
}

/** Canonical 2D scene/contact math, adapted to the host's Cartesian snapshots. */
export function readShape(shape: ShapeGeometry, defaultReader: ShapeReaderSnapshot['type'], motion: 'loop' | 'pingpong', heads: readonly ShapeHead[], divisions = 1, stableTurns = false): ShapeReading {
  const features: GeometryFeature[] = [], readers: ShapeReaderSnapshot[] = [];
  const path = shape.path;
  for (const head of heads) {
    const type = head.reader ?? defaultReader;
    // The source rhythm reader uses the one-sided limit at a closed contour's
    // ping-pong endpoint, so phase 1 cannot become a false phase-0 loop entry.
    const atOddTurn = Math.abs(head.travel - Math.round(head.travel)) <= 1e-10 && Math.abs(Math.round(head.travel) % 2) === 1;
    const phaseTravel = stableTurns && path.closed && motion === 'pingpong' && atOddTurn ? head.travel - 1e-9 : head.travel;
    const phase = foldShapePhase(phaseTravel, motion);
    const nextPhase = foldShapePhase(head.travel + head.direction * 1e-5, motion);
    const direction = motion === 'pingpong' && Math.abs(nextPhase - phase) > 1e-9
      ? (Math.sign(nextPhase - phase) as 1 | -1) : head.direction;
    const reader: ShapeReaderSnapshot = { id: `head:${head.headIndex}`, headIndex: head.headIndex, type, phase, travel: head.travel, direction };
    let contacts: PathContact[];
    if (type === 'line') {
      const horizontal = head.axis === 'horizontal';
      const coordinate = horizontal
        ? path.bounds.minY + path.bounds.height * phase
        : path.bounds.minX + path.bounds.width * phase;
      contacts = horizontal ? horizontalIntersections(path, coordinate) : verticalIntersections(path, coordinate);
      reader.axis = head.axis;
      reader.coordinate = horizontal ? -coordinate : coordinate;
      reader.start = horizontal ? { x: -1.2, y: -coordinate } : { x: coordinate, y: -1.2 };
      reader.end = horizontal ? { x: 1.2, y: -coordinate } : { x: coordinate, y: 1.2 };
    } else if (type === 'radar') {
      const angle = phase * Math.PI * 2 - Math.PI / 2;
      contacts = rayIntersections(path, angle);
      reader.angle = -angle;
      reader.start = { x: 0, y: 0 };
      reader.end = { x: Math.cos(angle) * 1.2, y: -Math.sin(angle) * 1.2 };
    } else contacts = [pointAtPath(path, phase, { pingPong: false })];

    for (const [contactIndex, contact] of contacts.entries()) {
      const contourDirection = shapes2dContactContourDirection({ ...contact, scanAxis: type === 'line' ? head.axis : type === 'radar' ? 'radial' : 'path' }, { reader: type, phaseRate: direction, intendedPhaseDirection: direction });
      const envelope = directedCornerEnvelopeProfile(path, contact, contourDirection);
      features.push({
        // Keep the original point IDs stable; intersection voices are scoped
        // by reader kind, head and source-sorted contact rather than array-wide index.
        id: type === 'points' ? reader.id : `${type}:${reader.id}:contact:${contactIndex}`,
        headId: reader.id, headIndex: head.headIndex, contactIndex,
        x: contact.x, y: -contact.y, phase: contact.u,
        cornerPhase: envelope.phase, cornerStrength: envelope.strength, strength: 1,
        pitch01: clamp(1 - (contact.y - path.bounds.minY) / Math.max(path.bounds.height, .001), 0, 1),
        pan: clamp((contact.x - path.bounds.minX) / Math.max(path.bounds.width, .001) * 2 - 1, -1, 1),
        drive: clamp(contact.cornerStrength ?? contact.segmentT ?? .5, 0, 1),
        sourceStrength: clamp(.28 + (contact.cornerStrength ?? .35) * .62, 0, 1),
        edgeIndex: contact.segmentIndex,
        sourceEnvelope: path.shapeType === 'circle' ? .12 : (.18 + .5 * clamp(envelope.strength, 0, 1)) * (1 - clamp(envelope.phase, 0, 1)),
        regionKey: `2d:${shapeContactRegion(path, contact, divisions)}:head:${head.headIndex}`,
      });
    }
    readers.push(reader);
  }
  return { features, readers };
}

export const SHAPE_SAMPLE_RATE = 256;
const MAX_SHAPE_SAMPLES = 1024;

/**
 * Shape rhythm entries use the source's fixed 256 Hz observation grid. Integer
 * turns/seams have an exact root inside the sample interval; ordinary region
 * entries use its endpoint. No display call, callback jitter or mutable scene
 * history owns these identities. Adjacent scheduling windows are half-open.
 */
export function shapeEvents(readAt: (time: number) => ShapeReading, start: number, end: number): GeometryFeature[] {
  if (!(end > start)) return [];
  const events: GeometryFeature[] = [];
  const firstTick = Math.max(1, Math.floor(start * SHAPE_SAMPLE_RATE));
  const lastTick = Math.ceil(end * SHAPE_SAMPLE_RATE);
  let previous = readAt((firstTick - 1) / SHAPE_SAMPLE_RATE);
  for (let tick = firstTick; tick <= lastTick && tick - firstTick < MAX_SHAPE_SAMPLES; tick++) {
    const time = tick / SHAPE_SAMPLE_RATE, beforeTime = (tick - 1) / SHAPE_SAMPLE_RATE;
    const current = readAt(time), previousKeys = new Set(previous.features.map(feature => feature.regionKey));
    const entered = new Set(current.features.filter(feature => !previousKeys.has(feature.regionKey)).map(feature => feature.regionKey));
    let seamAt: number | undefined;
    for (const head of current.readers) {
      const before = previous.readers.find(reader => reader.headIndex === head.headIndex);
      if (!before || head.travel === before.travel) continue;
      const integer = head.travel > before.travel ? Math.floor(before.travel + 1e-10) + 1 : Math.ceil(before.travel - 1e-10) - 1;
      const crossed = head.travel > before.travel ? integer <= head.travel + 1e-10 : integer >= head.travel - 1e-10;
      if (!crossed) continue;
      const at = beforeTime + (time - beforeTime) * clamp((integer - before.travel) / (head.travel - before.travel), 0, 1);
      seamAt = Math.min(seamAt ?? at, at);
      const contacts = current.features.filter(feature => feature.headIndex === head.headIndex);
      if (!contacts.some(feature => entered.has(feature.regionKey))) for (const feature of contacts) entered.add(feature.regionKey);
    }
    const at = seamAt ?? time;
    if (entered.size && at >= start - 1e-9 && at < end - 1e-9) {
      for (const feature of current.features) {
        if (!entered.has(feature.regionKey)) continue;
        events.push({ ...feature, id: `shape:${tick}:${feature.id}:${feature.regionKey ?? ''}`, time: at });
        if (events.length >= MAX_EVENT_BATCH) return events;
      }
    }
    previous = current;
  }
  return events;
}

/** Same true-side division keys as shapes-scene.js, independent of samples. */
function shapeContactRegion(path: ShapePath, contact: PathContact, divisions: number): string {
  const count = Math.round(clamp(divisions, 1, 16));
  if (path.shapeType === 'circle' || path.vertexDistances.length < 2) return `contour:${Math.min(count - 1, Math.floor(wrap(contact.u) * count))}`;
  const sideCount = path.closed ? path.vertexDistances.length : path.vertexDistances.length - 1;
  const distance = clamp(contact.distance, 0, path.totalLength);
  let side = sideCount - 1;
  for (let index = 0; index < sideCount; index++) {
    if (distance < (path.vertexDistances[index + 1] ?? path.totalLength)) { side = index; break; }
  }
  const start = path.vertexDistances[side] ?? 0, end = path.vertexDistances[side + 1] ?? path.totalLength;
  const local = clamp((distance - start) / Math.max(1e-9, end - start), 0, 1);
  return `side:${side}:segment:${Math.min(count - 1, Math.floor(local * count))}`;
}

export function shapeGeometry(sides: number, curvature: number, transform: { rotationDeg?: number; aspect?: number; skew?: number; positionX?: number; positionY?: number } = {}): ShapeGeometry {
  const source = buildShape({ sides: Math.round(clamp(sides, 1, 32)), curvature: clamp(curvature, -1, 1), rotationDeg: transform.rotationDeg ?? 0, aspect: transform.aspect ?? 0, skew: transform.skew ?? 0, samplesPerEdge: 32 });
  const x = clamp(transform.positionX ?? 0, -1, 1), y = clamp(transform.positionY ?? 0, -1, 1);
  // Translation is an AudioBrain extension; the canonical contour measures and
  // tangents are unchanged, and the scanner/radar remain in the shared frame.
  const path: ShapePath = x === 0 && y === 0 ? source : {
    ...source,
    points: source.points.map(point => ({ x: point.x + x, y: point.y - y })),
    bounds: { ...source.bounds, minX: source.bounds.minX + x, maxX: source.bounds.maxX + x, minY: source.bounds.minY - y, maxY: source.bounds.maxY - y, center: { x: source.bounds.center.x + x, y: source.bounds.center.y - y } },
  };
  const points = path.points.map((point, index) => ({ id: `p${index}`, x: point.x, y: -point.y }));
  const edgePoints = path.closed ? points : points.slice(0, -1);
  return { family: 'shape', path, snapshot: { kind: 'path', points, origin: { x, y }, segments: edgePoints.map((point, index) => ({ id: `s${index}`, from: point.id, to: points[(index + 1) % points.length]!.id })) } };
}

export function shapeFeatures(shape: ShapeGeometry, phase: number, heads: number): GeometryFeature[] {
  const count = Math.round(clamp(heads, 1, 12));
  return readShape(shape, 'points', 'loop', Array.from({ length: count }, (_, headIndex) => ({ headIndex, travel: phase + headIndex / count, direction: 1, axis: 'vertical' }))).features;
}

export function shapeVoices(features: GeometryFeature[], rootHz: number, octaves: number, pitchMapping: 'shape' | 'centered' = 'centered'): VoiceTarget[] {
  const audibleCount = features.filter(feature => (feature.sourceEnvelope ?? .12) > 0).length;
  return features.map((feature) => {
    const pitch = pitchMapping === 'shape' ? (feature.pitch01 ?? clamp((feature.y + 1) * .5, 0, 1)) * octaves : feature.y * octaves * .5;
    return { id: feature.id, frequency: clamp(rootHz * 2 ** pitch, 20, 20_000), amplitude: (feature.sourceEnvelope ?? .12) / Math.sqrt(Math.max(1, audibleCount)), pan: clamp((pitchMapping === 'shape' ? feature.pan ?? feature.x : feature.x) * .85, -1, 1), brightness: feature.drive ?? (1 + feature.y) * .5 };
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
