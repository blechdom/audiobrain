import { createContext, useContext } from 'react';
import type { AudioBrainRuntime } from '../runtime/AudioBrainRuntime';

export const RuntimeContext = createContext<AudioBrainRuntime | null>(null);
export function useRuntime() { return useContext(RuntimeContext); }
