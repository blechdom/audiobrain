import type { GraphDocument } from '../graph/types';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface PresetSource {
  repository: string;
  revision: string;
  path: string;
  exportName: string;
  sha256: string;
  notices?: { path: string; sha256: string; text: string }[];
}
export interface SourceRecipe {
  kind: 'morphazoid';
  familyId: string;
  sourceId: string;
  category: string;
  settings: JsonValue;
  source: PresetSource;
}
export interface PresetDefinition {
  documentType: 'audiobrain.instrument-preset';
  schemaVersion: 1;
  id: string;
  title: string;
  description?: string;
  recipe: SourceRecipe | { kind: 'graph'; graph: GraphDocument };
}
/** Source snapshots are provenance, never a second live parameter store. */
export interface PresetOrigin {
  instanceId: string;
  presetId: string;
  title: string;
  adapterVersion: 1;
  nodeIds: string[];
  recipe: SourceRecipe;
}
export interface PresetAssessment {
  ready: boolean;
  requirements: string[];
  description: string;
}
