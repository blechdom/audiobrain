export interface GraphNode { id: number; x: number; y: number }
export interface GraphEdge { id: number; from: number; to: number; feedbackEdge?: boolean; cyclic?: boolean }
export interface GraphModel { type: string; nodes: GraphNode[]; edges: GraphEdge[]; indegree: number[]; outdegree: number[]; cyclicIndegree: number[]; entries: number[] }
export function generateGraph(options: { type: string; nodeCount: number; maxNodes: number; density: number; seed: number }): GraphModel;
