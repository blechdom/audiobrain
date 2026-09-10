import type { GeometrySnapshot, ShapeReaderSnapshot } from '../runtime/types';

export interface ViewPoint { x: number; y: number }
export const wrapShapePhase = (phase: number) => ((phase % 1) + 1) % 1;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Seek one head without storing clocks or changing the other heads' offsets. */
export function shapePhaseAdjustment(reader: ShapeReaderSnapshot, savedAdjustment: number, desiredPhase: number, pingpong: boolean): number {
  const period = pingpong ? 2 : 1;
  const cycleTravel = ((reader.travel % period) + period) % period;
  const desiredTravel = pingpong && cycleTravel > 1 ? 2 - desiredPhase : desiredPhase;
  return ((savedAdjustment + desiredTravel - cycleTravel) % period + period) % period;
}

/** Inverse of the renderer's actual reader geometry, in +Y-up coordinates. */
export function shapePhaseAtPoint(geometry: GeometrySnapshot, reader: ShapeReaderSnapshot, point: ViewPoint): number {
  if (reader.type === 'radar') {
    const origin = reader.start ?? { x: 0, y: 0 };
    return wrapShapePhase((Math.PI / 2 - Math.atan2(point.y - origin.y, point.x - origin.x)) / (Math.PI * 2));
  }
  if (reader.type === 'line') {
    const coordinates = geometry.points.map((vertex) => reader.axis === 'horizontal' ? vertex.y : vertex.x);
    const min = Math.min(...coordinates), max = Math.max(...coordinates);
    if (max - min < 1e-9) return 0;
    return clamp(reader.axis === 'horizontal' ? (max - point.y) / (max - min) : (point.x - min) / (max - min));
  }
  const points = new Map(geometry.points.map((vertex) => [vertex.id, vertex]));
  let total = 0, bestDistance = Infinity, closestTravel = 0;
  for (const segment of geometry.segments) {
    const from = points.get(segment.from), to = points.get(segment.to);
    if (!from || !to) continue;
    const dx = to.x - from.x, dy = to.y - from.y;
    const squared = dx * dx + dy * dy, length = Math.sqrt(squared);
    const amount = squared < 1e-12 ? 0 : clamp(((point.x - from.x) * dx + (point.y - from.y) * dy) / squared);
    const distance = Math.hypot(point.x - from.x - dx * amount, point.y - from.y - dy * amount);
    if (distance < bestDistance) { bestDistance = distance; closestTravel = total + length * amount; }
    total += length;
  }
  return total > 1e-9 ? closestTravel / total : 0;
}

export function pointHitsShape(geometry: GeometrySnapshot, point: ViewPoint): boolean {
  const points = new Map(geometry.points.map((vertex) => [vertex.id, vertex]));
  let inside = false;
  for (const segment of geometry.segments) {
    const from = points.get(segment.from), to = points.get(segment.to);
    if (!from || !to) continue;
    const dx = to.x - from.x, dy = to.y - from.y, squared = dx * dx + dy * dy;
    const amount = squared < 1e-12 ? 0 : clamp(((point.x - from.x) * dx + (point.y - from.y) * dy) / squared);
    if (Math.hypot(point.x - from.x - dx * amount, point.y - from.y - dy * amount) < .09) return true;
    if ((from.y > point.y) !== (to.y > point.y) && point.x < (to.x - from.x) * (point.y - from.y) / (to.y - from.y) + from.x) inside = !inside;
  }
  const closed = geometry.segments.length > 0 && geometry.segments.at(-1)?.to === geometry.segments[0]?.from;
  return closed && inside;
}
