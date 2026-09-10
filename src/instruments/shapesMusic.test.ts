import { describe, expect, it } from 'vitest';
import { SHAPES_FM_DRUM_BANK, shapeDrumIndex, shapeDrumVoice, shapeNoteEvents } from './shapesMusic';
import type { GeometryFeature } from './geometry';

const contact = (overrides: Partial<GeometryFeature> = {}): GeometryFeature => ({ id: 'head:0', time: 0.25, x: 0, y: 0, pitch01: 0.5, pan: 0, drive: 0.5, sourceStrength: 1, edgeIndex: 0, ...overrides });
const options = { mode: 'notes' as const, rootHz: 110, rangeOctaves: 3 };

describe('source Shapes note and percussion mapping', () => {
  it('emits no attacks without geometric entries and retains exact encounter times', () => {
    expect(shapeNoteEvents([], options)).toEqual([]);
    const note = shapeNoteEvents([contact()], options)[0]!;
    expect(note.time).toBe(0.25);
    expect(note.frequency).toBeCloseTo(110 * 2 ** 1.5);
    expect(note.attack).toBe(0.004);
    expect(note.duration).toBeCloseTo(0.072 * (0.62 + 0.35 * 0.12));
    expect(note.articulation).toBe('shapes');
  });

  it('bounds simultaneous source note peaks without replacing contacts by beats', () => {
    const notes = shapeNoteEvents(Array.from({ length: 12 }, (_, index) => contact({ id: `head:${index}` })), options);
    expect(notes).toHaveLength(8);
    expect(notes.reduce((sum, note) => sum + note.amplitude, 0)).toBeCloseTo(0.68);
    expect(new Set(notes.map(note => note.sourceId)).size).toBe(8);
    expect(notes.every(note => note.time === 0.25)).toBe(true);
  });

  it('retains the source sixteen-voice bank and independent feature/position/incidence routes', () => {
    expect(SHAPES_FM_DRUM_BANK).toHaveLength(16);
    expect(SHAPES_FM_DRUM_BANK[0]).toMatchObject({ id: 'sub-kick', frequency: 48, modRatio: 1, modIndex: 4.8, pitchBend: 2.6 });
    expect(SHAPES_FM_DRUM_BANK[11]).toMatchObject({ id: 'glass-bell', frequency: 784, decay: 1.25 });
    const feature = contact({ edgeIndex: 11, pan: -1, pitch01: 0.8, drive: 0.2 });
    expect(shapeDrumIndex(feature, 'feature')).toBe(11);
    expect(shapeDrumIndex(feature, 'position')).toBe(12);
    expect(shapeDrumIndex(feature, 'incidence')).toBe(3);
  });

  it('maps geometric height to drum tuning, contact drive to noise and stereo position to tone', () => {
    const low = shapeDrumVoice(contact({ pitch01: 0, drive: 0, pan: -1 }), { ...options, mode: 'triggers', tuningDepth: 24, triggerCharacter: 1 });
    const high = shapeDrumVoice(contact({ pitch01: 1, drive: 1, pan: 1 }), { ...options, mode: 'triggers', tuningDepth: 24, triggerCharacter: 1 });
    expect(high.frequency / low.frequency).toBeCloseTo(4);
    expect(high.noise).toBeGreaterThan(low.noise);
    expect(high.tone).toBeGreaterThan(low.tone);
    const notes = shapeNoteEvents(Array.from({ length: 10 }, (_, index) => contact({ id: `head:${index}` })), { ...options, mode: 'triggers', hitCap: 3 });
    expect(notes).toHaveLength(3);
    expect(notes.every(note => note.articulation === 'drum' && note.drum?.id === 'sub-kick')).toBe(true);
  });
});
