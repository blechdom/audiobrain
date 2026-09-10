import shapes from '../../presets/morphazoid-shapes.json';
import lsystems from '../../presets/morphazoid-lsystems.json';
import graphs from '../../presets/morphazoid-graphs.json';
import { parseGraphDocument } from './model';
export const PRESETS = [shapes, lsystems, graphs].map(parseGraphDocument);
export const DEFAULT_GRAPH = PRESETS[0]!;
