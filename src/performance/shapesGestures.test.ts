import { describe, expect, it } from 'vitest';
import { foldShapePhase, readShape, shapeGeometry } from '../instruments/geometry';
import type { ShapeReaderSnapshot } from '../runtime/types';
import { pointHitsShape, shapePhaseAdjustment, shapePhaseAtPoint } from './shapesGestures';

describe('Shapes direct gestures', () => {
  it.each(['points', 'line', 'radar'] as const)('recovers the real %s reader phase after contour transforms', (type) => {
    const geometry = shapeGeometry(5, -.3, { rotationDeg: 31, positionX: .2, positionY: -.15, aspect: .1, skew: .2 });
    for (const axis of ['horizontal', 'vertical'] as const) {
      for (const phase of [.12, .38, .73]) {
        const reading = readShape(geometry, type, 'loop', [{ headIndex: 0, travel: phase, direction: 1, axis }]);
        expect(reading.features.length).toBeGreaterThan(0);
        const reader = reading.readers[0]!;
        const contact = reading.features[0]!;
        expect(shapePhaseAtPoint(geometry.snapshot, reader, contact)).toBeCloseTo(phase, 7);
      }
    }
  });
  it.each(['loop', 'pingpong'] as const)('seeks through %s wraps without changing the transport or head identity', (motion) => {
    for (const travel of [-2.8, -.4, .6, 1.2, 2.4, 3.9]) {
      const reader: ShapeReaderSnapshot = { id: 'head:2', headIndex: 2, type: 'points', direction: -1, phase: foldShapePhase(travel, motion), travel };
      for (const desired of [.02, .4, .87]) {
        const next = shapePhaseAdjustment(reader, .35, desired, motion === 'pingpong');
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThan(motion === 'pingpong' ? 2 : 1);
        expect(foldShapePhase(travel - .35 + next, motion)).toBeCloseTo(desired, 10);
      }
    }
  });
  it('distinguishes a translated closed shape from its background and an open line', () => {
    const closed = shapeGeometry(4, 0, { positionX: .3, positionY: .2 });
    expect(pointHitsShape(closed.snapshot, { x: .3, y: .2 })).toBe(true);
    expect(pointHitsShape(closed.snapshot, { x: -1.2, y: 1.2 })).toBe(false);
    const line = shapeGeometry(2, 0, { rotationDeg: 30 });
    expect(pointHitsShape(line.snapshot, line.snapshot.points[0]!)).toBe(true);
    expect(pointHitsShape(line.snapshot, { x: .5, y: .8 })).toBe(false);
  });
});
