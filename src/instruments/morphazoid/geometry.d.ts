export interface Point { x: number; y: number }
export interface ShapePath { points: Point[]; closed: boolean; totalLength: number; vertexIndices: number[]; vertexDistances: number[]; cornerStrengths: number[]; }
export interface PathContact extends Point { distance: number; u: number; cornerStrength: number; cornerIndex: number; }
export function buildShape(options: { sides: number; curvature: number; samplesPerEdge?: number }): ShapePath;
export function pointAtPath(path: ShapePath, progress: number): PathContact;
export function directedCornerEnvelopeProfile(path: ShapePath, contact: PathContact, contourDirection?: number): { phase: number; strength: number; edgeFraction: number };
