import { describe, expect, it } from 'vitest';
import sourceFixtures from './__fixtures__/shapes-readers.json';
import { foldShapePhase, readShape, shapeEvents, shapeGeometry, shapeVoices, type ShapeHead } from './geometry';

describe('canonical Morphazoid reader parity', () => {
  for (const { input, readers, contacts } of sourceFixtures.fixtures) {
    it(input.name, () => {
      const directions = 'directions' in input ? input.directions : undefined;
      const axes = 'axes' in input ? input.axes : undefined;
      const heads: ShapeHead[] = input.offsets.map((offset, headIndex) => ({
        headIndex, travel: input.phase * (directions?.[headIndex] ?? 1) + offset,
        direction: directions?.[headIndex] === -1 ? -1 : 1,
        axis: axes?.[headIndex] === 'horizontal' ? 'horizontal' : 'vertical',
      }));
      const reader = input.reader === 'line' || input.reader === 'radar' ? input.reader : 'points';
      const actual = readShape(shapeGeometry(input.sides, 0), reader, input.motion === 'pingpong' ? 'pingpong' : 'loop', heads);
      expect(actual.features).toHaveLength(contacts.length);
      expect(actual.readers).toHaveLength(readers.length);
      for (const [index, expected] of contacts.entries()) {
        const contact = actual.features[index]!;
        expect(contact.headIndex).toBe(expected.headIndex);
        for (const key of ['x', 'y', 'phase', 'cornerPhase', 'cornerStrength'] as const) expect(contact[key]).toBeCloseTo(expected[key], 10);
      }
      for (const [index, expected] of readers.entries()) {
        expect(actual.readers[index]!.phase).toBeCloseTo(expected.phase, 10);
        expect(actual.readers[index]!.travel).toBeCloseTo(expected.travel, 10);
      }
    });
  }

  it('reads a mixed point, line and radar family into matching independent voices', () => {
    const shape = shapeGeometry(4, 0);
    const heads: ShapeHead[] = [
      { headIndex: 0, travel: .1, direction: 1, axis: 'vertical', reader: 'points' },
      { headIndex: 1, travel: .5, direction: -1, axis: 'vertical', reader: 'line' },
      { headIndex: 2, travel: .1, direction: -1, axis: 'horizontal', reader: 'radar' },
    ];
    const { features, readers } = readShape(shape, 'points', 'loop', heads);
    expect(readers.map(reader => reader.type)).toEqual(['points', 'line', 'radar']);
    expect(features.map(contact => contact.headIndex)).toEqual([0, 1, 1, 2]);
    expect(new Set(features.map(contact => contact.id)).size).toBe(4);
    expect(features[0]!.id).toBe('head:0'); // Existing point-voice ownership survives the upgrade.
    expect(features[0]!.x).toBeCloseTo(.4);
    expect(features[3]!.x).toBeCloseTo(.4208077798377321);
    expect(readers[0]!.start).toBeUndefined();
    expect(readers[1]!.start).toEqual({ x: 0, y: -1.2 });
    expect(readers[2]!.end!.y).toBeGreaterThan(0);
    const voices = shapeVoices(features, 110, 3);
    expect(voices.map(voice => voice.id)).toEqual(features.map(contact => contact.id));
    expect(voices[0]!.frequency).not.toBeCloseTo(voices[3]!.frequency, 5);
    expect(voices.every(voice => Number.isFinite(voice.amplitude) && voice.amplitude >= 0)).toBe(true);
  });

  it('changes directed corner envelopes when a scan reverses without changing its intersections', () => {
    const shape = shapeGeometry(4, 0);
    const head: ShapeHead = { headIndex: 0, travel: .35, direction: 1, axis: 'vertical' };
    const forward = readShape(shape, 'line', 'loop', [head]).features;
    const reverse = readShape(shape, 'line', 'loop', [{ ...head, direction: -1 }]).features;
    expect(forward).toHaveLength(2);
    expect(forward.map(({ x, y, id }) => ({ x, y, id }))).toEqual(reverse.map(({ x, y, id }) => ({ x, y, id })));
    expect(forward.map(contact => contact.cornerPhase)).not.toEqual(reverse.map(contact => contact.cornerPhase));
    // Opposite contour directions on a symmetric scan share the same release
    // distance; treating both contacts as forward would make these asymmetric.
    expect(forward[0]!.cornerPhase).toBeCloseTo(forward[1]!.cornerPhase!);
  });

  it('preserves circles, open contours, inward curvature and the source side limit', () => {
    const line = shapeGeometry(2, 0), circle = shapeGeometry(1, 0), inward = shapeGeometry(32, -1);
    expect(line.path.closed).toBe(false);
    expect(line.snapshot.segments).toHaveLength(line.snapshot.points.length - 1);
    expect(line.snapshot.segments.at(-1)!.to).toBe(line.snapshot.points.at(-1)!.id);
    expect(circle.path.closed).toBe(true);
    expect(circle.path.vertexIndices).toHaveLength(0);
    expect(circle.snapshot.points.every(point => Math.abs(Math.hypot(point.x, point.y) - 1) < 1e-10)).toBe(true);
    expect(inward.path.vertexIndices).toHaveLength(32);
    expect(Math.hypot(inward.path.points[16]!.x, inward.path.points[16]!.y)).toBeLessThan(.3);
    expect(foldShapePhase(-.2, 'loop')).toBeCloseTo(.8);
    expect(foldShapePhase(-.2, 'pingpong')).toBeCloseTo(.2);
  });

  it('rotates and translates the real contour while radar rays retain their shared origin', () => {
    const shape = shapeGeometry(4, 0, { rotationDeg: 90, positionX: .3, positionY: .2 });
    expect(shape.snapshot.origin).toEqual({ x: .3, y: .2 });
    expect(shape.snapshot.points[0]!.x).toBeCloseTo(1.3);
    expect(shape.snapshot.points[0]!.y).toBeCloseTo(.2);
    const head: ShapeHead = { headIndex: 0, travel: .25, direction: 1, axis: 'vertical' };
    const radar = readShape(shape, 'radar', 'loop', [head]);
    expect(radar.readers[0]!.start).toEqual({ x: 0, y: 0 });
    expect(radar.features[0]!.y).toBeCloseTo(0);
    expect(radar.features[0]!.x).toBeCloseTo(1.1);
    const scan = readShape(shape, 'line', 'loop', [{ ...head, travel: .5 }]);
    expect(scan.readers[0]!.coordinate).toBeCloseTo(.3);
    expect(scan.features.every(feature => Math.abs(feature.x - .3) < 1e-10)).toBe(true);
    const transformed = shapeGeometry(4, 0, { aspect: 1, skew: .5 });
    expect(transformed.snapshot.points).not.toEqual(shapeGeometry(4, 0).snapshot.points);
  });

  it('maps source pitch from the contour bounds and retains explicit legacy centered pitch', () => {
    const shape = shapeGeometry(4, 0, { positionX: .2, positionY: .3 });
    const contacts = readShape(shape, 'points', 'loop', [{ headIndex: 0, travel: 0, direction: 1, axis: 'vertical' }]).features;
    expect(contacts[0]!.pitch01).toBe(1);
    const canonical = shapeVoices(contacts, 110, 2, 'shape')[0]!;
    const legacy = shapeVoices(contacts, 110, 2, 'centered')[0]!;
    expect(canonical.frequency).toBe(440);
    expect(canonical.pan).toBeCloseTo(0);
    expect(legacy.frequency).toBeCloseTo(110 * 2 ** 1.3);
    expect(legacy.pan).toBeCloseTo(.17);
    expect(canonical.amplitude).toBeCloseTo(.43);
  });
});

describe('Shapes fixed-clock region entries', () => {
  const reading = (sides: number, motion: 'loop' | 'pingpong' = 'loop', direction: 1 | -1 = 1, divisions = 1) => {
    const shape = shapeGeometry(sides, 0);
    return (time: number) => readShape(shape, 'points', motion, [{ headIndex: 0, travel: time * direction, direction, axis: 'vertical' }], divisions, true);
  };

  it('emits one-region circle seams once at exact crossing times, including reverse travel', () => {
    for (const direction of [1, -1] as const) {
      const at = reading(1, 'loop', direction);
      expect(shapeEvents(at, 0, 1)).toHaveLength(0);
      const next = shapeEvents(at, 1, 1.5);
      expect(next).toHaveLength(1); expect(next[0]!.time).toBe(1);
      expect(next[0]!.regionKey).toBe('2d:contour:0:head:0');
    }
  });

  it('does not invent a second loop entry after a closed ping-pong turnaround', () => {
    const at = reading(4, 'pingpong');
    const before = shapeEvents(at, .995, 1), turn = shapeEvents(at, 1, 1.004), after = shapeEvents(at, 1.004, 1.02);
    expect(before).toHaveLength(0);
    expect(turn).toHaveLength(1); expect(turn[0]!.time).toBe(1);
    expect(after).toHaveLength(0);
  });

  it('retains event identity across adjacent windows and changes density with true-side divisions', () => {
    const at = reading(4, 'loop', 1, 4);
    const early = shapeEvents(at, 0, .503), late = shapeEvents(at, .503, 1.1), together = shapeEvents(at, 0, 1.1);
    expect([...early, ...late]).toEqual(together);
    expect(new Set(together.map(event => event.id)).size).toBe(together.length);
    expect(together.length).toBeGreaterThan(shapeEvents(reading(4), 0, 1.1).length);
    expect(together.every(event => event.time! >= 0 && event.time! < 1.1 && event.regionKey)).toBe(true);
  });

  it('does not strike a held position just because a new geometry is sampled', () => {
    for (const sides of [3, 7, 12]) {
      const shape = shapeGeometry(sides, .3);
      const held = () => readShape(shape, 'radar', 'loop', [{ headIndex: 0, travel: .14, direction: 1, axis: 'vertical' }]);
      expect(shapeEvents(held, .4, .6)).toHaveLength(0);
    }
  });
});
