/** Normalized Cartesian coordinates: +X right, +Y up. Views invert Y once. */
export interface PointSnapshot { id: string; x: number; y: number }
export interface GeometrySnapshot {
  kind: 'path' | 'graph';
  points: PointSnapshot[];
  segments: { id: string; from: string; to: string }[];
  origin?: { x: number; y: number };
}
export interface FeatureSnapshot {
  id: string; x: number; y: number; phase?: number; strength?: number;
  segmentId?: string; time?: number;
  headId?: string; headIndex?: number; contactIndex?: number;
}
/** Reader geometry is already normalized to +Y up, like contour snapshots. */
export interface ShapeReaderSnapshot {
  id: string; headIndex: number; type: 'points' | 'line' | 'radar';
  phase: number; travel: number; direction: 1 | -1;
  axis?: 'vertical' | 'horizontal'; coordinate?: number; angle?: number;
  start?: { x: number; y: number }; end?: { x: number; y: number };
}
export interface NodeSnapshot {
  geometry?: GeometrySnapshot;
  features?: FeatureSnapshot[];
  readers?: ShapeReaderSnapshot[];
  level?: number;
  value?: number;
  activeIds?: string[];
  status?: string;
  params?: Record<string, number>;
}
export interface RuntimeSnapshot {
  time: number;
  beat: number;
  playing: boolean;
  audioState: 'off' | 'starting' | 'running' | 'error';
  level: number;
  voiceCount: number;
  nodes: Record<string, NodeSnapshot>;
  diagnostics: string[];
  capabilities: { midi: string; microphone: string; osc: string; brain: string };
  epoch: number;
  droppedEvents: number;
}
export interface VoiceTarget {
  id: string; frequency: number; amplitude: number; pan: number; brightness: number;
}
export interface NoteTarget extends VoiceTarget {
  time: number; duration: number; articulation: 'branch' | 'graph' | 'midi' | 'shapes' | 'drum';
  action?: 'on' | 'off';
  held?: boolean;
  sourceId?: string;
  attack?: number;
  drum?: { id: string; family: string; frequency: number; attack: number; decay: number; modRatio: number; modIndex: number; pitchBend: number; noise: number; tone: number; level: number };
}
