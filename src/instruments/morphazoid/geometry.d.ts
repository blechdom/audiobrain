export interface Point { x: number; y: number }
export interface ShapePath {
  points: Point[]; closed: boolean; totalLength: number; vertexIndices: number[]; shapeType: 'circle' | 'polygon' | 'star';
  vertexDistances: number[]; cornerStrengths: number[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number; center: Point };
}
export interface PathContact extends Point {
  distance: number; u: number; cornerStrength: number; cornerIndex: number;
  tangent: Point; segmentIndex: number; segmentT: number;
}
export function buildShape(options: {
  sides: number; curvature: number; samplesPerEdge?: number; shapeType?: 'circle' | 'polygon' | 'star';
  starDepth?: number; aspect?: number; skew?: number; asymmetry?: number; rotationDeg?: number;
}): ShapePath;
export function pointAtPath(path: ShapePath, progress: number, options?: { pingPong?: boolean }): PathContact;
export function verticalIntersections(path: ShapePath, coordinate: number, epsilon?: number): PathContact[];
export function horizontalIntersections(path: ShapePath, coordinate: number, epsilon?: number): PathContact[];
export function rayIntersections(path: ShapePath, angle: number, origin?: Point, epsilon?: number): PathContact[];
export function shapes2dContactContourDirection(contact: PathContact & { scanAxis?: string }, options?: {
  reader?: 'points' | 'line' | 'radar'; phaseRate?: number; rotationRate?: number; intendedPhaseDirection?: number;
}): 1 | -1;
export function directedCornerEnvelopeProfile(path: ShapePath, contact: PathContact, contourDirection?: number): { phase: number; strength: number; edgeFraction: number };
