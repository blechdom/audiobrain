export interface Point { x: number; y: number }
export interface BranchSegment { start: Point; end: Point; depth: number; heading: number; cumulativeTurn: number; parentIndex: number | null; children: number[]; generation: number; startDistance: number; endDistance: number; subtreeEndDistance: number; forkDepth: number; powerShare: number; voiceKey: string; index: number; }
export interface BranchTrace { instructions: string; segments: BranchSegment[]; duration: number; rootIndices: number[]; bounds: { minX: number; maxX: number; minY: number; maxY: number }; }
export interface BranchHead extends Point { cumulativeTurn: number; index: number; powerShare: number; voiceKey: string; progress: number; segment: BranchSegment; }
export function expandLSystem(axiom: string, rules: Record<string, string>, iterations: number, maxSymbols?: number): string;
export function traceLSystem(options: { axiom: string; angle: number; lengthScale: number; drawSymbols?: string; moveSymbols?: string; turnAsymmetry?: number; maxSymbols: number }): BranchTrace;
export function branchingSnapshotAtPhase(trace: BranchTrace, phase: number): { phase: number; distance: number; heads: BranchHead[] };
export function branchAngleFrequency(heading: number, rootHz: number, octavesPerTurn: number): number;
export function branchVoiceGain(powerShare: number, activePower?: number, combinedGain?: number): number;
