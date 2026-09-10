import type { NoteTarget } from '../runtime/types';
import type { GeometryFeature } from './geometry';

/** Source bank and mapping adapted from Morphazoid src/fm-drums.js and
 * combo-app.js at81d3530. MIT; see morphazoid/LICENSE and docs/PROVENANCE.md.
 * The host owns AudioContext/output; no source app or device lifecycle is copied.
 */
export interface ShapeDrumVoice {
  id: string; name: string; family: string; frequency: number; attack: number; decay: number;
  modRatio: number; modIndex: number; pitchBend: number; noise: number; tone: number; level: number;
}
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const BANK_ROWS: readonly (readonly [string, string, string, string, string, number, number, number, number, number, number, number, number, number])[] = [
  ["sub-kick", "Sub Kick", "1", "kick", "#ff8a61", 48, .002, .62, 1, 4.8, 2.6, .02, .34, .92],
  ["fm-kick", "FM Kick", "2", "kick", "#ffad69", 63, .001, .34, 1.5, 7.2, 3.8, .03, .55, .86],
  ["snap-snare", "Snap Snare", "3", "snare", "#ff7aa6", 176, .002, .28, 1.82, 6.4, 1.1, .68, .62, .74],
  ["wide-clap", "Wide Clap", "4", "snare", "#de75b8", 238, .006, .19, 2.7, 3.1, .35, .92, .76, .68],
  ["low-tom", "Low Tom", "q", "tom", "#e8c46b", 82, .003, .52, 1.37, 4.4, 1.6, .04, .43, .82],
  ["mid-tom", "Mid Tom", "w", "tom", "#dbd86b", 124, .003, .42, 1.41, 5.1, 1.35, .035, .51, .78],
  ["high-tom", "High Tom", "e", "tom", "#b8df77", 191, .002, .31, 1.58, 5.8, 1.1, .025, .61, .74],
  ["closed-hat", "Closed Hat", "r", "hat", "#5fe8c4", 4820, .001, .075, 1.414, 9.2, 0, .74, .88, .42],
  ["open-hat", "Open Hat", "a", "hat", "#55d6d0", 4210, .002, .44, 1.618, 8.1, 0, .66, .8, .4],
  ["rim-shot", "Rim Shot", "s", "metal", "#70d8e7", 510, .001, .105, 2.91, 5.7, .15, .12, .72, .62],
  ["cowbell", "Cowbell", "d", "metal", "#7db4ff", 563, .002, .29, 1.48, 3.4, 0, .03, .67, .56],
  ["glass-bell", "Glass Bell", "f", "bell", "#91a6ff", 784, .004, 1.25, 2.76, 6.8, 0, .01, .82, .5],
  ["soft-chime", "Soft Chime", "z", "bell", "#b299ff", 1047, .018, 1.8, 3.03, 4.6, -.08, 0, .72, .44],
  ["bronze-gong", "Bronze Gong", "x", "bell", "#c79bff", 147, .012, 2.35, 1.71, 12.8, -.12, .035, .46, .62],
  ["laser-zap", "Laser Zap", "c", "effect", "#e883ee", 329, .001, .38, 4.2, 10.6, 5.2, .02, .74, .56],
  ["scrap-metal", "Scrap Metal", "v", "metal", "#ff82c8", 927, .001, .64, 2.23, 14.2, -.35, .28, .84, .46],
];
export const SHAPES_FM_DRUM_BANK: readonly ShapeDrumVoice[] = BANK_ROWS.map(([id, name, , family, , frequency, attack, decay, modRatio, modIndex, pitchBend, noise, tone, level]) => Object.freeze({ id, name, family, frequency, attack, decay, modRatio, modIndex, pitchBend, noise, tone, level }));

export interface ShapeNoteOptions {
  mode: 'notes' | 'triggers'; rootHz: number; rangeOctaves: number; character?: number;
  rateHz?: number; sides?: number; divisions?: number;
  triggerMapping?: 'feature' | 'position' | 'incidence'; tuningDepth?: number;
  triggerCharacter?: number; hitCap?: number;
}

export function shapeDrumIndex(feature: GeometryFeature, mapping: ShapeNoteOptions['triggerMapping'] = 'feature'): number {
  const pitch = clamp(feature.pitch01 ?? (feature.y + 1) / 2, 0, 1);
  const pan = clamp(feature.pan ?? feature.x, -1, 1);
  if (mapping === 'position') return Math.min(3, Math.floor(pitch * 4)) * 4 + Math.min(3, Math.floor((pan + 1) * 2));
  if (mapping === 'incidence') return Math.min(15, Math.floor(clamp(feature.drive ?? 0.5, 0, 1) * 16));
  return Math.abs(Math.trunc(feature.edgeIndex ?? 0)) % 16;
}

/** Exact Shapes FM-kit contact mapping; the unchanged16-voice source bank is reusable. */
export function shapeDrumVoice(feature: GeometryFeature, options: ShapeNoteOptions): ShapeDrumVoice {
  const base = SHAPES_FM_DRUM_BANK[shapeDrumIndex(feature, options.triggerMapping)]!;
  const pitch = clamp(feature.pitch01 ?? (feature.y + 1) / 2, 0, 1);
  const pan = clamp(feature.pan ?? feature.x, -1, 1);
  const character = clamp(options.triggerCharacter ?? 0.7, 0, 1);
  const strength = clamp(feature.sourceStrength ?? feature.strength ?? 0.5, 0, 1);
  const semitones = (pitch - 0.5) * clamp(options.tuningDepth ?? 12, 0, 24);
  return {
    ...base,
    frequency: clamp(base.frequency * 2 ** (semitones / 12), 20, 12_000),
    modIndex: clamp(base.modIndex * (0.55 + character * 0.9), 0, 20),
    noise: clamp(base.noise + ((feature.drive ?? 0.5) - 0.5) * character * 0.35, 0, 1),
    tone: clamp(base.tone + pan * 0.16 * character, 0, 1),
    level: clamp(base.level * (0.68 + strength * 0.32), 0, 1),
  };
}

/** Map only actual reader-region entries, never free-running beat substitutes.
 * Events with one timestamp are the simultaneous contact group from the reader.
 */
export function shapeNoteEvents(events: readonly GeometryFeature[], options: ShapeNoteOptions): NoteTarget[] {
  const groups = new Map<number, GeometryFeature[]>();
  for (const event of events.slice(0, 256)) {
    if (!Number.isFinite(event.time)) continue;
    const time = event.time!;
    const group = groups.get(time) ?? [];
    group.push(event); groups.set(time, group);
  }
  const notes: NoteTarget[] = [];
  for (const [time, group] of [...groups].sort(([a], [b]) => a - b)) {
    const contacts = group.slice(0, options.mode === 'notes' ? 8 : Math.round(clamp(options.hitCap ?? 6, 1, 32)));
    const character = clamp(options.character ?? 0.35, 0, 1);
    const duration = Math.max(0.042, Math.max(0.072, contacts.length * 0.014) * (0.62 + character * 0.12));
    const requested = contacts.map((feature): NoteTarget => {
      const pitch = clamp(feature.pitch01 ?? (feature.y + 1) / 2, 0, 1);
      const strength = clamp(feature.sourceStrength ?? feature.strength ?? 0.5, 0, 1);
      const drum = options.mode === 'triggers' ? shapeDrumVoice(feature, options) : undefined;
      return {
        id: `shapes:${feature.id}:${time.toFixed(9)}`, sourceId: feature.headId ? `${feature.headId}:contact:${feature.contactIndex ?? 0}` : feature.id, time,
        frequency: drum?.frequency ?? clamp(options.rootHz * 2 ** (pitch * options.rangeOctaves), 20, 20_000),
        amplitude: drum?.level ?? 0.215 + strength * 0.085,
        pan: drum ? 0 : clamp((feature.pan ?? feature.x) * 0.85, -1, 1),
        brightness: clamp(feature.drive ?? 0.5, 0, 1),
        duration: drum?.decay ?? duration,
        articulation: drum ? 'drum' : 'shapes', attack: drum?.attack ?? 0.004,
        ...(drum ? { drum } : {}),
      };
    });
    // Source normalizeStrikeGains bounds phase-aligned simultaneous notes to.68.
    // Drum dynamics retain bank balance and use the host's own output headroom.
    const total = requested.reduce((sum, note) => sum + note.amplitude, 0);
    const scale = options.mode === 'notes' && total > 0.68 ? 0.68 / total : 1;
    notes.push(...requested.map((note) => ({ ...note, amplitude: note.amplitude * scale })));
    if (notes.length >= 256) return notes.slice(0, 256);
  }
  return notes;
}
