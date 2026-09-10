import catalog from '../../contracts/operator-catalog.json';
import type { GraphParams, OperatorDefinition } from './types';

// This JSON is the public catalog and the single definition of each operator.
export const OPERATOR_DEFINITIONS = catalog.operators as OperatorDefinition[];
export const OPERATOR_CATALOG_VERSION = 2;
export const GRAPH_LIMITS = { ...catalog.limits, maxJsonBytes: 1024 * 1024 };
export const NODE_KINDS = OPERATOR_DEFINITIONS.map(({ kind }) => kind);
const operators = new Map(OPERATOR_DEFINITIONS.map((operator) => [operator.kind, operator]));
export function getOperatorDefinition(kind: string): OperatorDefinition {
  const definition = operators.get(kind);
  if (!definition) throw new Error(`Unknown operator kind: ${kind}`);
  return definition;
}
export function getDefaultParams(kind: string): GraphParams {
  return Object.fromEntries(getOperatorDefinition(kind).params.map((parameter) => [parameter.id, parameter.default]));
}
