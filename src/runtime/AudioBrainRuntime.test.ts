import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioBrainRuntime, LOOKAHEAD_SECONDS } from './AudioBrainRuntime';
import { PRESETS } from '../graph/presets';
const createPreset = (id: string) => structuredClone(PRESETS.find((preset) => preset.id === id)!);

class Param {
  value = 0;
  events: { method: string; value: number; at: number }[] = [];
  setTargetAtTime(value: number, at: number) { this.value = value; this.events.push({ method: 'target', value, at }); }
  setValueAtTime(value: number, at: number) { this.value = value; this.events.push({ method: 'set', value, at }); }
  linearRampToValueAtTime(value: number, at: number) { this.value = value; this.events.push({ method: 'linear', value, at }); }
  exponentialRampToValueAtTime(value: number, at: number) { this.value = value; this.events.push({ method: 'exponential', value, at }); }
  cancelScheduledValues() {}
}
class Node {
  connections: Node[] = [];
  gain = new Param(); frequency = new Param(); Q = new Param(); pan = new Param(); delayTime = new Param();
  threshold = new Param(); knee = new Param(); ratio = new Param(); attack = new Param(); release = new Param();
  type = 'sine'; fftSize = 1024; onended: (() => void) | null = null;
  starts: number[] = []; stops: number[] = [];
  constructor(readonly kind: string) {}
  connect(destination: Node) { this.connections.push(destination); return destination; }
  disconnect(destination?: Node) { this.connections = destination ? this.connections.filter((node) => node !== destination) : []; }
  start(at = 0) { this.starts.push(at); }
  stop(at = 0) { this.stops.push(at); }
  getFloatTimeDomainData(array: Float32Array) { array.fill(0); }
}
class Context {
  currentTime = 0; sampleRate = 48000; state = 'suspended'; onstatechange: (() => void) | null = null;
  nodes: Node[] = []; destination = new Node('destination'); closeCount = 0;
  node(kind: string) { const node = new Node(kind); this.nodes.push(node); return node; }
  createGain = () => this.node('gain'); createOscillator = () => this.node('oscillator');
  createAnalyser = () => this.node('analyser'); createDynamicsCompressor = () => this.node('compressor');
  createBiquadFilter = () => this.node('filter'); createStereoPanner = () => this.node('pan'); createDelay = () => this.node('delay');
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; this.closeCount++; return Promise.resolve(); }
}
function setup() {
  vi.useFakeTimers();
  let now = 0; const context = new Context(); const factory = vi.fn(() => context as unknown as AudioContext);
  const runtime = new AudioBrainRuntime({ now: () => now, createAudioContext: factory, autoTick: false });
  const advance = (seconds: number) => { now += seconds; context.currentTime += seconds; vi.advanceTimersByTime(seconds * 1000); runtime.tick(); };
  return { runtime, context, factory, advance };
}
afterEach(() => vi.useRealTimers());

describe('audio host lifecycle and actual graph scheduling', () => {
  it('can retry explicit audio arming after context creation fails', async () => {
    const context = new Context();
    const factory = vi.fn().mockImplementationOnce(() => { throw new Error('device unavailable'); }).mockImplementation(() => context);
    const runtime = new AudioBrainRuntime({ createAudioContext: factory, autoTick: false });
    runtime.setProject(createPreset('morphazoid-shapes'));
    await runtime.startAudio(); expect(runtime.getSnapshot().audioState).toBe('error');
    await runtime.startAudio(); expect(runtime.getSnapshot().audioState).toBe('running');
    runtime.dispose();
  });
  it('transport runs with no context until Audio is explicitly armed; rearming reuses one context', async () => {
    const { runtime, factory, advance, context } = setup();
    runtime.setProject(createPreset('morphazoid-shapes'));
    runtime.setPlaying(true); advance(1);
    expect(factory).not.toHaveBeenCalled(); expect(runtime.getSnapshot().time).toBe(1);
    expect(runtime.getSnapshot().nodes.view?.features).toHaveLength(4);
    await runtime.startAudio(); advance(0.03);
    expect(factory).toHaveBeenCalledTimes(1); expect(runtime.getSnapshot().voiceCount).toBe(4);
    expect(runtime.getSnapshot().level).toBe(0); // Analyzer data, never synthetic bars.
    await runtime.stopAudio(); expect(context.state).toBe('suspended');
    advance(0.1); await runtime.startAudio(); advance(0.03);
    expect(factory).toHaveBeenCalledTimes(1); expect(runtime.getSnapshot().audioState).toBe('running');
    runtime.dispose(); expect(context.closeCount).toBe(1);
    expect(context.nodes.every((node) => node.connections.length === 0)).toBe(true);
  });

  it('schedules attacks in audio seconds, skips stale intervals, and resets its epoch deterministically', async () => {
    const { runtime, context, advance } = setup();
    runtime.setProject(createPreset('morphazoid-lsystems')); await runtime.startAudio(); runtime.setPlaying(true);
    const attacks = context.nodes.filter((node) => node.kind === 'oscillator').flatMap((node) => node.starts);
    expect(attacks.length).toBeGreaterThan(0);
    expect(attacks.every((time) => time >= context.currentTime && time <= context.currentTime + LOOKAHEAD_SECONDS + 0.01)).toBe(true);
    advance(5); expect(runtime.getSnapshot().droppedEvents).toBe(1);
    const before = runtime.getSnapshot().epoch; runtime.reset();
    expect(runtime.getSnapshot().epoch).toBe(before + 1); expect(runtime.getSnapshot().time).toBe(0);
    runtime.dispose();
  });

  it('retains resources for parameter edits and stops removed routes on incomplete graph edits', async () => {
    const { runtime, context, advance } = setup();
    const patch = createPreset('morphazoid-shapes'); runtime.setProject(patch); await runtime.startAudio(); runtime.setPlaying(true); advance(0.03);
    const nodes = context.nodes.length;
    patch.nodes.find((node) => node.id === 'gain')!.params.db = -30;
    runtime.setProject(patch); advance(0.04);
    expect(context.nodes.length).toBe(nodes);
    expect(context.nodes.some((node) => node.gain.events.some((event) => Math.abs(event.value - 10 ** (-30 / 20)) < 1e-6))).toBe(true);
    patch.edges = patch.edges.filter((edge) => edge.target.nodeId !== 'out'); runtime.setProject(patch);
    expect(runtime.getSnapshot().diagnostics.join(' ')).toContain('Audio paused');
    const oscillators = context.nodes.filter((node) => node.kind === 'oscillator');
    expect(oscillators.every((node) => node.stops.length > 0)).toBe(true);
    advance(0.3); expect(context.nodes.filter((node) => node.kind === 'oscillator').length).toBe(oscillators.length);
    runtime.dispose();
  });

  it('keeps overlapping local head IDs scoped to separate reader and voice-bank instances', async () => {
    const { runtime, context, advance } = setup();
    const patch = createPreset('morphazoid-shapes'), second = createPreset('morphazoid-shapes');
    second.nodes.find(node => node.id === 'reader')!.params.heads = 2;
    second.nodes.find(node => node.id === 'mapping')!.params.rootHz = 220;
    patch.nodes.push(...second.nodes.map(node => ({ ...node, id: `second-${node.id}`, viewBindings: undefined })));
    patch.edges.push(...second.edges.map(edge => ({ ...edge, id: `second-${edge.id}`, source: { ...edge.source, nodeId: `second-${edge.source.nodeId}` }, target: { ...edge.target, nodeId: `second-${edge.target.nodeId}` } })));
    runtime.setProject(patch); await runtime.startAudio(); runtime.setPlaying(true); advance(.04);
    expect(runtime.getSnapshot().voiceCount).toBe(6);
    const initialOscillators = context.nodes.filter(node => node.kind === 'oscillator');
    expect(initialOscillators).toHaveLength(12);
    const firstReaders = runtime.getSnapshot().nodes.reader!.readers!;
    patch.nodes.find(node => node.id === 'second-reader')!.params.head1Direction = 'reverse';
    runtime.setProject(patch);
    expect(runtime.getSnapshot().nodes.reader!.readers).toEqual(firstReaders);
    advance(.05);
    expect(context.nodes.filter(node => node.kind === 'oscillator')).toHaveLength(12);
    expect(initialOscillators.every(node => node.stops.length === 0)).toBe(true);
    patch.nodes.find(node => node.id === 'second-reader')!.params.heads = 1;
    runtime.setProject(patch); for (let tick = 0; tick < 8; tick++) advance(.025);
    expect(runtime.getSnapshot().voiceCount).toBe(5);
    expect(initialOscillators.filter(node => node.stops.length > 0)).toHaveLength(2);
    runtime.dispose();
    expect(context.nodes.every(node => node.connections.length === 0)).toBe(true);
  });

  it('changes actual point, scan and radar voices while keeping transport and audio armed', async () => {
    const { runtime, context, advance } = setup();
    const patch = createPreset('morphazoid-shapes');
    const reader = patch.nodes.find(node => node.id === 'reader')!;
    reader.params.heads = 2; reader.params.phaseOffset = .23;
    runtime.setProject(patch); await runtime.startAudio(); runtime.setPlaying(true); advance(.04);
    const pointOscillators = context.nodes.filter(node => node.kind === 'oscillator');
    expect(runtime.getSnapshot().voiceCount).toBe(2);
    reader.params.reader = 'line';
    runtime.setProject(patch); for (let tick = 0; tick < 8; tick++) advance(.025);
    expect(runtime.getSnapshot().voiceCount).toBe(4);
    expect(pointOscillators.every(node => node.stops.length > 0)).toBe(true);
    reader.params.reader = 'radar';
    runtime.setProject(patch); for (let tick = 0; tick < 8; tick++) advance(.025);
    expect(runtime.getSnapshot().voiceCount).toBe(2);
    expect(runtime.getSnapshot().nodes.view!.readers!.every(head => head.type === 'radar')).toBe(true);
    expect(runtime.getSnapshot().playing).toBe(true);
    expect(runtime.getSnapshot().audioState).toBe('running');
    runtime.panic();
    expect(context.nodes.filter(node => node.kind === 'oscillator').every(node => node.stops.length > 0)).toBe(true);
    runtime.dispose();
  });

  it('reschedules cancelled lookahead notes on resume without resetting playhead positions', async () => {
    const { runtime, context, advance } = setup();
    const patch = createPreset('morphazoid-shapes-notes');
    Object.assign(patch.nodes.find(node => node.id === 'reader')!.params, { heads: 1, rateHz: 1, divisions: 4 });
    patch.nodes.find(node => node.id === 'geometry')!.params.sides = 4;
    runtime.setProject(patch); await runtime.startAudio(); runtime.setPlaying(true); advance(.04);
    const before = context.nodes.filter(node => node.kind === 'oscillator').length;
    expect(before).toBeGreaterThan(0);
    runtime.setPlaying(false);
    const heldPhase = runtime.getSnapshot().nodes.reader!.readers![0]!.phase;
    runtime.setPlaying(true);
    expect(runtime.getSnapshot().nodes.reader!.readers![0]!.phase).toBe(heldPhase);
    expect(context.nodes.filter(node => node.kind === 'oscillator').length).toBeGreaterThan(before);
    runtime.dispose();
  });

  it('keeps audio armed across preset changes, bounds resources, and does not depend on animation frames', async () => {
    const raf = vi.fn(); vi.stubGlobal('requestAnimationFrame', raf);
    const { runtime, factory, advance, context } = setup();
    runtime.setProject(createPreset('morphazoid-shapes')); await runtime.startAudio(); runtime.setPlaying(true); advance(0.03);
    runtime.setProject(createPreset('morphazoid-graphs')); advance(0.03);
    expect(runtime.getSnapshot().playing).toBe(true); expect(runtime.getSnapshot().audioState).toBe('running');
    expect(runtime.getSnapshot().epoch).toBe(1); expect(factory).toHaveBeenCalledTimes(1);
    for (let index = 0; index < 100; index++) advance(0.025);
    expect(runtime.getSnapshot().voiceCount).toBeLessThanOrEqual(96); expect(raf).not.toHaveBeenCalled();
    runtime.dispose(); expect(context.nodes.every((node) => node.connections.length === 0)).toBe(true); vi.unstubAllGlobals();
  });

  it('scopes held MIDI notes to device/channel and requires an explicitly selected output', async () => {
    const { runtime, factory, context, advance } = setup();
    const input = (id: string) => ({ id, name: id, state: 'connected', onmidimessage: null as null | ((event: { data: Uint8Array }) => void), close: () => Promise.resolve() });
    const a = input('device-a'), b = input('device-b');
    const output = { id: 'output', name: 'Output', state: 'connected', send: vi.fn(), clear: vi.fn(), close: () => Promise.resolve() };
    const access = { inputs: new Map([[a.id, a], [b.id, b]]), outputs: new Map([[output.id, output]]), onstatechange: null as null | (() => void) };
    vi.stubGlobal('navigator', { requestMIDIAccess: () => Promise.resolve(access) });
    const patch = createPreset('morphazoid-shapes');
    patch.nodes = patch.nodes.filter((node) => ['voices', 'gain', 'out'].includes(node.id));
    patch.nodes.find((node) => node.id === 'voices')!.kind = 'voice.poly';
    patch.nodes.find((node) => node.id === 'voices')!.params = {};
    patch.nodes.push({ id: 'midi', kind: 'io.midi.in', position: { x: 0, y: 0 }, params: { channel: 0, controller: 1 } }, { id: 'midiOut', kind: 'io.midi.out', position: { x: 0, y: 0 }, params: { channel: 1 } });
    patch.edges = patch.edges.filter((edge) => ['voices', 'gain'].includes(edge.source.nodeId) && ['gain', 'out'].includes(edge.target.nodeId));
    patch.edges.push({ id: 'midi-notes', source: { nodeId: 'midi', portId: 'notes' }, target: { nodeId: 'voices', portId: 'notes' } }, { id: 'midi-external', source: { nodeId: 'midi', portId: 'notes' }, target: { nodeId: 'midiOut', portId: 'notes' } });
    patch.performance.widgets = [];
    runtime.setProject(patch); await runtime.enableMidi(); expect(factory).not.toHaveBeenCalled();
    await runtime.startAudio(); runtime.setPlaying(true);
    a.onmidimessage!({ data: new Uint8Array([0x90, 60, 100]) }); b.onmidimessage!({ data: new Uint8Array([0x91, 60, 100]) }); advance(0.025);
    expect(runtime.getSnapshot().voiceCount).toBe(2);
    expect(output.send).not.toHaveBeenCalled();
    const oscillators = context.nodes.filter((node) => node.kind === 'oscillator');
    expect(oscillators.every((node) => node.stops.length === 0)).toBe(true); // Held, no one-second auto release.
    a.onmidimessage!({ data: new Uint8Array([0x80, 60, 0]) }); advance(0.025);
    expect(oscillators.filter((node) => node.stops.length > 0)).toHaveLength(2); // One carrier/modulator pair.
    runtime.selectMidiOutput('output'); output.send.mockClear();
    b.onmidimessage!({ data: new Uint8Array([0x91, 64, 80]) }); advance(0.025);
    expect(output.send).toHaveBeenCalledTimes(1);
    b.state = 'disconnected'; output.state = 'disconnected'; access.onstatechange!(); advance(0.15);
    expect(runtime.getMidiDevices().selectedOutputId).toBeNull();
    expect(runtime.getSnapshot().voiceCount).toBe(0);
    expect(b.onmidimessage).toBeNull();
    runtime.dispose(); vi.unstubAllGlobals();
  });
});
