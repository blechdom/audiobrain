import { compileGraph, type CompiledGraph, type GraphDocument } from '../graph';
import { AudioRack } from '../audio/AudioRack';
import { GraphEvaluator, type Evaluation } from './GraphEvaluator';
import type { NoteTarget, RuntimeSnapshot } from './types';
export type { RuntimeSnapshot, NodeSnapshot, GeometrySnapshot, FeatureSnapshot } from './types';

export const SCHEDULER_INTERVAL_MS = 25;
export const LOOKAHEAD_SECONDS = 0.1;
export const SCHEDULE_STEP_SECONDS = 0.025;
const EMPTY: RuntimeSnapshot = { time: 0, beat: 0, playing: false, audioState: 'off', level: 0, voiceCount: 0, nodes: {}, diagnostics: [], capabilities: { midi: 'disabled', microphone: 'disabled', osc: 'bridge disconnected', brain: 'peer disconnected' }, epoch: 0, droppedEvents: 0 };
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

export interface RuntimeOptions {
  now?: () => number;
  createAudioContext?: () => AudioContext;
  autoTick?: boolean;
}

/** One context, transport and bounded lookahead scheduler per app host. */
export class AudioBrainRuntime {
  private snapshot: RuntimeSnapshot = { ...EMPTY, capabilities: { ...EMPTY.capabilities } };
  private listeners = new Set<() => void>();
  private readonly now: () => number;
  private readonly factory: () => AudioContext;
  private timer: ReturnType<typeof setInterval> | null = null;
  private topologyTimer: ReturnType<typeof setTimeout> | null = null;
  private context: AudioContext | null = null;
  private rack: AudioRack | null = null;
  private evaluator: GraphEvaluator | null = null;
  private plan: CompiledGraph | null = null;
  private topologyKey = '';
  private position = 0;
  private anchor = 0;
  private cursor = 0;
  private generation = 0;
  private disposed = false;
  private structuralBlock = false;
  private documentDiagnostics: string[] = [];
  private controls = new Map<string, number>();
  private queuedMidi = new Map<string, NoteTarget[]>();
  private midiAccess: MIDIAccess | null = null;
  private midiInputs: MIDIInput[] = [];
  private midiOutputs: MIDIOutput[] = [];
  private midiChannels = new Set<number>();
  private midiControlOwners = new Map<string, string>();
  private selectedMidiOutputId: string | null = null;
  private microphoneStream: MediaStream | null = null;
  private microphoneGeneration = 0;
  private midiGeneration = 0;
  private audioStart: Promise<void> | null = null;

  constructor(options: RuntimeOptions = {}) {
    this.now = options.now ?? (() => performance.now() / 1000);
    this.factory = options.createAudioContext ?? (() => new AudioContext({ latencyHint: 'interactive' }));
    if (options.autoTick !== false) this.timer = setInterval(() => this.tick(), SCHEDULER_INTERVAL_MS);
  }
  getSnapshot = (): RuntimeSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private publish(patch: Partial<RuntimeSnapshot> = {}): void {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
  private time(): number { return this.position + (this.snapshot.playing ? Math.max(0, this.now() - this.anchor) : 0); }

  setProject(document: GraphDocument): void {
    if (this.disposed) return;
    try {
      const plan = compileGraph(document);
      const changedProject = this.plan !== null && this.plan.document.id !== document.id;
      const evaluator = new GraphEvaluator(plan, changedProject ? undefined : this.evaluator ?? undefined);
      const time = changedProject ? 0 : this.time();
      const preview = evaluator.evaluate({ time, start: time, end: time, levels: {}, controls: this.controls, midiNotes: new Map() });
      if (changedProject) {
        this.rack?.panic(); this.panicMidi(); this.disableMicrophone();
        this.controls.clear(); this.queuedMidi.clear(); this.position = 0; this.anchor = this.now();
        this.publish({ epoch: this.snapshot.epoch + 1 });
      }
      const midiSignature = (candidate: CompiledGraph | null) => JSON.stringify(candidate?.nodes.filter(({ node }) => node.kind.startsWith('io.midi.')).map(({ node, inputs }) => ({ id: node.id, params: node.params, inputs })));
      if (midiSignature(plan) !== midiSignature(this.plan)) this.panicMidi();
      for (const id of this.controls.keys()) if (!plan.reachableNodeIds.has(id)) this.controls.delete(id);
      for (const id of this.midiControlOwners.keys()) if (!plan.reachableNodeIds.has(id)) this.midiControlOwners.delete(id);
      for (const id of this.queuedMidi.keys()) if (!plan.reachableNodeIds.has(id)) this.queuedMidi.delete(id);
      this.plan = plan; this.evaluator = evaluator; this.documentDiagnostics = []; this.structuralBlock = false;
      this.installAudioPlan();
      this.publish({ nodes: preview.snapshots, diagnostics: [], time, beat: time * preview.bpm / 60 });
      this.tick();
    } catch (error) {
      this.documentDiagnostics = [message(error)];
      // Last valid parameter/topology state stays observable. Explicit deletion
      // must never leave removed audio routes playing from that old plan.
      const old = this.plan?.document;
      const destructive = old && (old.nodes.some((node) => !document.nodes.some((candidate) => candidate.id === node.id)) || old.edges.some((edge) => !document.edges.some((candidate) => candidate.id === edge.id)));
      if (destructive) {
        this.structuralBlock = true; this.rack?.setPlaying(false); this.panicMidi();
        this.documentDiagnostics.push('Audio paused until the incomplete patch is connected.');
      }
      this.publish({ diagnostics: this.documentDiagnostics });
    }
  }

  private installAudioPlan(): void {
    if (!this.plan || !this.rack || !this.context) return;
    const nodes = this.plan.nodes.filter(({ definition }) => definition.runtime.domain === 'audio' || definition.runtime.domain === 'analysis').map(({ node }) => ({ id: node.id, kind: node.kind }));
    const audioIds = new Set(nodes.map((node) => node.id));
    const edges = this.plan.nodes.flatMap(({ node, inputs }) => Object.values(inputs).filter((input) => input.type === 'audio.block' && audioIds.has(input.sourceNodeId) && audioIds.has(node.id)).map((input) => ({ source: input.sourceNodeId, target: node.id })));
    const key = JSON.stringify({ nodes, edges });
    if (key === this.topologyKey) { this.rack.setPlaying(this.snapshot.playing && !this.structuralBlock); return; }
    this.topologyKey = key;
    if (this.topologyTimer) clearTimeout(this.topologyTimer);
    const apply = () => {
      this.topologyTimer = null;
      if (!this.rack || this.disposed) return;
      this.rack.applyPlan(nodes, edges); this.rack.setPlaying(this.snapshot.playing && !this.structuralBlock);
      this.cursor = this.time() + 0.008;
    };
    if (this.context.state === 'running' && this.snapshot.playing) {
      this.rack.gate.gain.cancelScheduledValues(this.context.currentTime);
      this.rack.gate.gain.setValueAtTime(this.rack.gate.gain.value, this.context.currentTime);
      this.rack.gate.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.012);
      this.topologyTimer = setTimeout(apply, 20);
    } else apply();
  }

  async startAudio(): Promise<void> {
    if (this.disposed) return;
    if (this.audioStart) return this.audioStart;
    const generation = ++this.generation;
    this.publish({ audioState: 'starting' });
    this.audioStart = (async () => {
      try {
        if (!this.context) {
          this.context = this.factory(); this.rack = new AudioRack(this.context); this.topologyKey = '';
          this.context.onstatechange = () => {
            if (!this.disposed && this.snapshot.audioState === 'running' && this.context?.state !== 'running') this.publish({ audioState: 'off' });
          };
        }
        await this.context.resume();
        if (this.disposed || generation !== this.generation) return;
        this.publish({ audioState: 'running', diagnostics: this.documentDiagnostics });
        this.installAudioPlan(); this.rack?.setPlaying(this.snapshot.playing && !this.structuralBlock);
        this.cursor = this.time() + 0.008; this.tick();
      } catch (error) {
        if (generation === this.generation) this.publish({ audioState: 'error', diagnostics: [...this.documentDiagnostics, `Audio: ${message(error)}`] });
      }
    })();
    const pending = this.audioStart;
    void pending.finally(() => { if (this.audioStart === pending) this.audioStart = null; });
    return pending;
  }
  async stopAudio(): Promise<void> {
    ++this.generation; this.audioStart = null; this.rack?.setPlaying(false); this.disableMicrophone();
    this.publish({ audioState: 'off', level: 0, voiceCount: 0 });
    if (this.context && this.context.state !== 'closed') await this.context.suspend().catch(() => undefined);
  }
  setPlaying(playing: boolean): void {
    if (this.disposed || playing === this.snapshot.playing) return;
    this.position = this.time(); this.anchor = this.now();
    this.publish({ playing }); this.cursor = this.position;
    this.rack?.setPlaying(playing && this.snapshot.audioState === 'running' && !this.structuralBlock);
    if (!playing) { this.panicMidi(); this.queuedMidi.clear(); this.evaluator?.clearScheduledAttacks(); }
    this.tick();
  }
  reset(): void {
    this.rack?.panic(); this.panicMidi(); this.queuedMidi.clear();
    this.position = this.cursor = 0; this.anchor = this.now(); this.evaluator?.reset();
    this.publish({ epoch: this.snapshot.epoch + 1, time: 0, beat: 0 }); this.tick();
  }
  panic(): void { this.setPlaying(false); this.rack?.panic(); this.panicMidi(); this.queuedMidi.clear(); }

  /** This is also the deterministic scheduler entry point used by host tests. */
  tick(): void {
    if (this.disposed || !this.evaluator) return;
    const time = this.time(), levels: Record<string, number> = {};
    const audioRunning = this.snapshot.audioState === 'running' && this.context?.state === 'running';
    for (const { node } of this.evaluator.graph.nodes) if (node.kind === 'analysis.level') levels[node.id] = audioRunning ? this.rack?.level(node.id) ?? 0 : 0;
    try {
      const display = this.evaluator.evaluate({ time, start: time, end: time, levels, controls: this.controls, midiNotes: new Map() });
      if (this.snapshot.playing && !this.structuralBlock && !this.topologyTimer) {
        // Stale attacks are discarded after a throttled tab resumes. At most
        // eight short evaluation slices are admitted per timer callback.
        if (this.cursor < time - 0.05) { this.cursor = time + 0.008; this.snapshot = { ...this.snapshot, droppedEvents: this.snapshot.droppedEvents + 1 }; }
        let steps = 0;
        while (this.cursor < time + LOOKAHEAD_SECONDS && steps++ < 8) {
          const end = Math.min(this.cursor + SCHEDULE_STEP_SECONDS, time + LOOKAHEAD_SECONDS);
          const midiNotes = new Map([...this.queuedMidi].map(([id, notes]) => [id, notes.filter((note) => note.time >= this.cursor && note.time < end)]));
          const evaluation = this.evaluator.evaluate({ time: this.cursor, start: this.cursor, end, levels, controls: this.controls, midiNotes });
          if (audioRunning && this.context && this.rack) this.scheduleAudio(evaluation, time);
          this.scheduleMidi(evaluation, time);
          this.cursor = end;
        }
        for (const [id, notes] of this.queuedMidi) this.queuedMidi.set(id, notes.filter((note) => note.time >= this.cursor));
      } else if (audioRunning && this.rack && this.context) {
        for (const node of display.audio) this.rack.update(node.id, node.params, this.context.currentTime);
      }
      const nodes = display.snapshots;
      for (const { node } of this.evaluator.graph.nodes) {
        if (node.kind.startsWith('io.midi.')) nodes[node.id]!.status = this.snapshot.capabilities.midi;
        if (node.kind === 'audio.input') nodes[node.id]!.status = this.snapshot.capabilities.microphone;
        if (node.kind.startsWith('io.osc.')) nodes[node.id]!.status = this.snapshot.capabilities.osc;
        if (node.kind.startsWith('io.brain.')) nodes[node.id]!.status = this.snapshot.capabilities.brain;
      }
      this.publish({ time, beat: time * display.bpm / 60, nodes, level: audioRunning ? this.rack?.level() ?? 0 : 0, voiceCount: audioRunning ? this.rack?.voiceCount ?? 0 : 0, diagnostics: this.documentDiagnostics });
    } catch (error) { this.publish({ diagnostics: [...this.documentDiagnostics, message(error)] }); }
  }
  private scheduleAudio(evaluation: Evaluation, transportNow: number): void {
    if (!this.context || !this.rack) return;
    const audioNow = this.context.currentTime;
    for (const node of evaluation.audio) {
      const at = Math.max(audioNow + 0.003, audioNow + this.cursor - transportNow);
      this.rack.update(node.id, node.params, at);
      if (node.voices) this.rack.continuous(node.id, node.voices, at, Number(node.params.character) || 0);
      for (const note of node.notes ?? []) {
        const noteAt = audioNow + note.time - transportNow;
        if (noteAt < audioNow - 0.01) continue;
        this.rack.note(node.id, note, Math.max(audioNow + 0.003, noteAt), Number(node.params.decay) || 0.6);
      }
    }
  }

  receiveControl(nodeId: string, value: number): void { if (Number.isFinite(value) && this.plan?.document.nodes.some((node) => node.id === nodeId && ['io.brain.in', 'io.osc.in', 'io.midi.in'].includes(node.kind))) this.controls.set(nodeId, value); }
  clearControl(nodeId: string): void { this.controls.delete(nodeId); this.tick(); }
  setBridgeStatus(kind: 'osc' | 'brain', status: string): void { this.publish({ capabilities: { ...this.snapshot.capabilities, [kind]: status } }); }

  async enableMicrophone(): Promise<void> {
    if (this.snapshot.audioState !== 'running' || !this.context || !this.rack) { this.publish({ capabilities: { ...this.snapshot.capabilities, microphone: 'Start Audio before enabling microphone' } }); return; }
    const generation = ++this.microphoneGeneration;
    this.publish({ capabilities: { ...this.snapshot.capabilities, microphone: 'requesting permission' } });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (this.disposed || generation !== this.microphoneGeneration || !this.context || !this.rack) { stream.getTracks().forEach((track) => track.stop()); return; }
      this.microphoneStream?.getTracks().forEach((track) => track.stop()); this.microphoneStream = stream;
      this.rack.attachMicrophone(this.context.createMediaStreamSource(stream));
      this.publish({ capabilities: { ...this.snapshot.capabilities, microphone: 'enabled' } });
    } catch (error) { if (generation === this.microphoneGeneration) this.publish({ capabilities: { ...this.snapshot.capabilities, microphone: message(error) } }); }
  }
  disableMicrophone(): void {
    ++this.microphoneGeneration; this.rack?.attachMicrophone(null);
    this.microphoneStream?.getTracks().forEach((track) => track.stop()); this.microphoneStream = null;
    this.publish({ capabilities: { ...this.snapshot.capabilities, microphone: 'disabled' } });
  }
  async enableMidi(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) { this.publish({ capabilities: { ...this.snapshot.capabilities, midi: 'Web MIDI unavailable in this browser' } }); return; }
    const generation = ++this.midiGeneration;
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      if (this.disposed || generation !== this.midiGeneration) return;
      this.midiAccess = access; access.onstatechange = () => this.refreshMidi(); this.refreshMidi();
    } catch (error) { if (generation === this.midiGeneration) this.publish({ capabilities: { ...this.snapshot.capabilities, midi: message(error) } }); }
  }
  private refreshMidi(): void {
    for (const input of this.midiInputs) input.onmidimessage = null;
    const inputs = [...(this.midiAccess?.inputs.values() ?? [])].filter((port) => port.state === 'connected');
    const outputs = [...(this.midiAccess?.outputs.values() ?? [])].filter((port) => port.state === 'connected');
    for (const removed of this.midiInputs.filter((input) => !inputs.some((port) => port.id === input.id))) {
      const prefix = `${removed.id}:channel:`;
      this.rack?.releaseMidiSource(prefix); this.panicMidi();
      for (const [id, device] of this.midiControlOwners) if (device === removed.id) { this.controls.delete(id); this.midiControlOwners.delete(id); }
      for (const [id, notes] of this.queuedMidi) this.queuedMidi.set(id, notes.filter((note) => !note.sourceId?.startsWith(prefix)));
    }
    if (this.selectedMidiOutputId && !outputs.some((port) => port.id === this.selectedMidiOutputId)) { this.panicMidi(); this.selectedMidiOutputId = null; }
    this.midiInputs = inputs; this.midiOutputs = outputs;
    for (const input of this.midiInputs) input.onmidimessage = (event) => { if (event.data) this.handleMidi(event.data, input.id); };
    this.publish({ capabilities: { ...this.snapshot.capabilities, midi: `enabled · ${this.midiInputs.length} in / ${this.midiOutputs.length} out` } });
  }
  getMidiDevices(): { inputs: { id: string; name: string }[]; outputs: { id: string; name: string }[]; selectedOutputId: string | null } {
    return { inputs: this.midiInputs.map((port) => ({ id: port.id, name: port.name ?? port.id })), outputs: this.midiOutputs.map((port) => ({ id: port.id, name: port.name ?? port.id })), selectedOutputId: this.selectedMidiOutputId };
  }
  selectMidiOutput(id: string | null): void {
    this.panicMidi(); this.selectedMidiOutputId = id && this.midiOutputs.some((port) => port.id === id) ? id : null; this.publish();
  }
  disableMidi(): void {
    ++this.midiGeneration; this.panicMidi();
    for (const input of this.midiInputs) { this.rack?.releaseMidiSource(`${input.id}:channel:`); input.onmidimessage = null; void input.close(); }
    for (const id of this.midiControlOwners.keys()) this.controls.delete(id);
    this.midiControlOwners.clear();
    for (const output of this.midiOutputs) void output.close();
    if (this.midiAccess) this.midiAccess.onstatechange = null;
    this.midiAccess = null; this.selectedMidiOutputId = null; this.midiInputs = []; this.midiOutputs = []; this.queuedMidi.clear();
    this.publish({ capabilities: { ...this.snapshot.capabilities, midi: 'disabled' } });
  }
  private handleMidi(data: Uint8Array, deviceId: string): void {
    const status = data[0] ?? 0, command = status & 0xf0, channel = (status & 0x0f) + 1, first = data[1] ?? 0, second = data[2] ?? 0;
    for (const { node } of this.plan?.nodes ?? []) {
      if (node.kind !== 'io.midi.in') continue;
      const resolved = this.snapshot.nodes[node.id]?.params ?? node.params;
      if (Number(resolved.channel) !== 0 && Number(resolved.channel) !== channel) continue;
      if (command === 0xb0 && first === Number(resolved.controller)) { this.controls.set(node.id, second / 127); this.midiControlOwners.set(node.id, deviceId); }
      if (command === 0x90 || command === 0x80) this.queueMidiNote(node.id, first, second / 127, command === 0x80 || second === 0, `${deviceId}:channel:${channel}`);
    }
  }
  noteOn(note: number, velocity = 0.7): void { for (const { node } of this.plan?.nodes ?? []) if (node.kind === 'io.midi.in') this.queueMidiNote(node.id, note, velocity, false); }
  noteOff(note: number): void { for (const { node } of this.plan?.nodes ?? []) if (node.kind === 'io.midi.in') this.queueMidiNote(node.id, note, 0, true); }
  private queueMidiNote(id: string, note: number, velocity: number, off: boolean, source = 'keyboard'): void {
    if (!Number.isFinite(note) || !Number.isFinite(velocity) || !this.snapshot.playing) return;
    const notes = this.queuedMidi.get(id) ?? [];
    if (!off && notes.length >= 128) return;
    if (off && notes.length >= 256) { this.rack?.panic(); this.panicMidi(); this.queuedMidi.clear(); return; }
    notes.push({ id: `${id}:${source}:note:${Math.round(note)}`, sourceId: source, time: Math.max(this.time() + 0.008, this.cursor), frequency: 440 * 2 ** ((Math.round(note) - 69) / 12), amplitude: Math.min(1, Math.max(0, velocity)) * 0.3, pan: 0, brightness: 0.5, duration: 1, articulation: 'midi', held: true, action: off ? 'off' : 'on' });
    this.queuedMidi.set(id, notes);
  }
  private scheduleMidi(evaluation: Evaluation, transportNow: number): void {
    if (!this.midiAccess) return;
    for (const bank of evaluation.midi) for (const note of bank.notes.slice(0, 128)) {
      const pitch = Math.round(69 + 12 * Math.log2(note.frequency / 440)); if (pitch < 0 || pitch > 127) continue;
      const channel = Math.max(0, Math.min(15, bank.channel - 1)); this.midiChannels.add(channel);
      const at = (this.now() + Math.max(0, note.time - transportNow)) * 1000;
      for (const output of this.midiOutputs.filter((port) => port.id === this.selectedMidiOutputId)) {
        try {
          output.send([note.action === 'off' ? 0x80 + channel : 0x90 + channel, pitch, note.action === 'off' ? 0 : Math.round(Math.min(1, note.amplitude / 0.34) * 127)], at);
          if (note.action !== 'off' && !note.held) output.send([0x80 + channel, pitch, 0], at + note.duration * 1000);
        } catch { /* device may disconnect between enumeration and send */ }
      }
    }
  }
  private panicMidi(): void {
    for (const output of this.midiOutputs.filter((port) => port.id === this.selectedMidiOutputId)) {
      try { (output as MIDIOutput & { clear?: () => void }).clear?.(); for (const channel of this.midiChannels) { output.send([0xb0 + channel, 123, 0]); output.send([0xb0 + channel, 120, 0]); } } catch { /* disconnected */ }
    }
    this.midiChannels.clear();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disableMidi(); this.disableMicrophone(); this.disposed = true; ++this.generation;
    if (this.timer) clearInterval(this.timer); if (this.topologyTimer) clearTimeout(this.topologyTimer);
    this.timer = this.topologyTimer = null;
    this.rack?.dispose(); this.rack = null;
    if (this.context) { this.context.onstatechange = null; void this.context.close().catch(() => undefined); }
    this.context = null; this.listeners.clear(); this.controls.clear(); this.queuedMidi.clear();
  }
}
