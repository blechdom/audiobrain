import type { GraphModel } from './graph-delay.js';
export interface GraphEvent { nodeId: number; time: number; departTime: number; arrivalEdgeId: number | null; previousNodeId: number | null; amplitude: number; localTurn: number; cumulativeTurn: number; cumulativeSemitones: number; depth: number; pathId?: string; pathKey?: string; feedbackCount: number; }
export function scheduleGraphPulse(graph: GraphModel, options: Record<string, unknown>): GraphEvent[];
export function graphSynthVoice(event: GraphEvent, graph: GraphModel, options: Record<string, unknown>): { frequency: number; inAudibleRange: boolean; gain: number; pan: number; brightness: number };
