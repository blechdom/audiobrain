import index from '../../contracts/morphazoid-preset-index.json';
import { PRESETS } from '../graph/presets';
import type { GraphDocument } from '../graph/types';
import type { PresetLibraryEntry } from '../components/PresetLibrary';
import { assessFamily, reconstructPreset } from './adapters';
import { graphPresetDefinition, parsePresetDefinition, serializePresetDefinition } from './definitions';
import type { JsonValue, PresetDefinition, PresetSource } from './types';

interface ArchiveFamily {
  id: string;
  label: string;
  category: string;
  source: Omit<PresetSource, 'repository' | 'revision'>;
  entries: { id: string; name: string; sourceId: string; raw: JsonValue }[];
}
interface Archive {
  source: { repository: string; revision: string };
  families: ArchiveFamily[];
  notices: { path: string; sha256: string; text: string }[];
}
let archiveRequest: Promise<Archive> | undefined;
function loadArchive(): Promise<Archive> {
  // Large source records (including Composer graphs) are fetched only when
  // rebuilding or exporting a source preset, not while starting an instrument.
  archiveRequest ??= import('../../contracts/morphazoid-presets.json').then(module => module.default as unknown as Archive).catch((error: unknown) => { archiveRequest = undefined; throw error; });
  return archiveRequest;
}

export const PRESET_LIBRARY_ENTRIES: PresetLibraryEntry[] = [
  ...PRESETS.map(graph => ({ id: graph.id, title: graph.title, description: graph.description, family: 'AudioBrain examples', category: 'instrument', origin: 'audiobrain' as const, status: 'ready' as const, requirements: [] })),
  ...index.families.flatMap(family => {
    const assessment = assessFamily(family.id);
    return family.entries.map(entry => ({
      id: entry.id, title: entry.name, description: `${'description' in entry ? entry.description : ''} ${assessment.description}`.trim(),
      family: family.label, category: family.category, origin: 'morphazoid' as const,
      status: assessment.ready ? 'ready' as const : 'blocked' as const,
      requirements: assessment.requirements,
      source: { page: family.source.path, url: `${index.source.repository}/blob/${index.source.revision}/${family.source.path}`, revision: index.source.revision },
    }));
  }),
];

export async function getPresetDefinition(id: string): Promise<PresetDefinition> {
  const example = PRESETS.find(preset => preset.id === id);
  if (example) return graphPresetDefinition(example);
  if (!PRESET_LIBRARY_ENTRIES.some(entry => entry.id === id)) throw new Error(`Unknown preset ${id}`);
  const archive = await loadArchive();
  for (const family of archive.families) {
    const entry = family.entries.find(entry => entry.id === id);
    if (!entry) continue;
    return parsePresetDefinition({
      documentType: 'audiobrain.instrument-preset', schemaVersion: 1, id: entry.id, title: entry.name,
      recipe: { kind: 'morphazoid', familyId: family.id, sourceId: entry.sourceId, category: family.category, settings: entry.raw,
        source: { repository: archive.source.repository, revision: archive.source.revision, ...family.source, notices: archive.notices } },
    });
  }
  throw new Error(`Archived preset ${id} is unavailable`);
}
export async function buildPresetGraph(id: string): Promise<GraphDocument> {
  return reconstructPreset(await getPresetDefinition(id));
}
export async function exportPresetDefinition(id: string): Promise<string> {
  return serializePresetDefinition(await getPresetDefinition(id));
}
export { reconstructPreset, parsePresetDefinition, serializePresetDefinition, graphPresetDefinition };
export type { PresetDefinition, PresetOrigin, PresetSource } from './types';
