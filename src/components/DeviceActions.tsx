import { useSyncExternalStore } from 'react';
import type { AudioBrainRuntime } from '../runtime/AudioBrainRuntime';
import { useRuntime } from './RuntimeContext';

export function DeviceActions({ kind }: { kind: string }) {
  const runtime = useRuntime();
  if (!runtime) return null;
  return <LiveDeviceActions runtime={runtime} kind={kind} />;
}

function LiveDeviceActions({ runtime, kind }: { runtime: AudioBrainRuntime; kind: string }) {
  const snapshot = useSyncExternalStore((listener) => runtime.subscribe(listener), () => runtime.getSnapshot());
  const run = (operation: Promise<void>) => { void operation.catch(() => { /* Runtime publishes actionable errors. */ }); };
  if (kind === 'audio.output') return <button className="node-device-button nodrag" onClick={() => run(snapshot.audioState === 'running' ? runtime.stopAudio() : runtime.startAudio())}>{snapshot.audioState === 'running' ? 'Disable audio' : 'Enable audio'}</button>;
  if (kind === 'audio.input') return <div className="node-device-actions nodrag"><span>{snapshot.capabilities.microphone}</span><button className="node-device-button" onClick={() => run(runtime.enableMicrophone())}>Enable microphone</button><button className="node-device-button" onClick={() => runtime.disableMicrophone()}>Stop microphone</button></div>;
  if (kind === 'io.midi.in' || kind === 'io.midi.out') return <div className="node-device-actions nodrag"><span>{snapshot.capabilities.midi}</span><button className="node-device-button" onClick={() => run(runtime.enableMidi())}>Enable MIDI</button><button className="node-device-button" onClick={() => runtime.disableMidi()}>Disable MIDI</button></div>;
  if (kind.startsWith('io.osc.') || kind.startsWith('io.brain.')) return <p className="node-connection-hint">Pair this route in Connections.</p>;
  return null;
}
