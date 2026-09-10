import type { NoteTarget, VoiceTarget } from '../runtime/types';

const MAX_VOICES = 96;
const MAX_BANK_VOICES = 32;
const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
export function smooth(parameter: AudioParam, value: number, at: number, seconds = 0.025): void {
  parameter.setTargetAtTime(finite(value, 0), Math.max(0, at), Math.max(0.003, seconds / 3));
}

interface Voice {
  id: string; owner: Resource; carrier: OscillatorNode; modulator: OscillatorNode; modulation: GainNode;
  envelope: GainNode; pan: StereoPannerNode; stopAt: number; retired: boolean;
  sourceId?: string;
  kind: 'continuous' | 'note' | 'drum';
  filter?: BiquadFilterNode; noiseSource?: AudioBufferSourceNode;
  noiseEnvelope?: GainNode; noiseFilter?: BiquadFilterNode;
}
interface Resource {
  kind: string; input?: AudioNode; output?: AudioNode; nodes: AudioNode[];
  voices: Map<string, Voice>; oscillator?: OscillatorNode; analyser?: AnalyserNode;
  gain?: GainNode; filter?: BiquadFilterNode; pan?: StereoPannerNode;
  delay?: DelayNode; feedback?: GainNode; dry?: GainNode; wet?: GainNode;
  shapeMode?: string;
}
export interface AudioPlanNode { id: string; kind: string }
export interface AudioPlanEdge { source: string; target: string }

/** Owns native audio resources; graph evaluation and the display own none. */
export class AudioRack {
  readonly context: BaseAudioContext;
  readonly gate: GainNode;
  readonly analyser: AnalyserNode;
  private compressor: DynamicsCompressorNode;
  private resources = new Map<string, Resource>();
  private wires: { source: AudioNode; target: AudioNode }[] = [];
  private meter = new Float32Array(512);
  private microphone: MediaStreamAudioSourceNode | null = null;
  private serial = 0;
  private allVoices = new Set<Voice>();
  private playing = false;
  private noiseBuffer: AudioBuffer | null = null;
  droppedVoices = 0;

  constructor(context: BaseAudioContext) {
    this.context = context;
    this.gate = context.createGain();
    this.gate.gain.value = 0;
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 1024;
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -8;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 8;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.15;
    this.gate.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(context.destination);
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
    this.gate.gain.cancelScheduledValues(this.context.currentTime);
    smooth(this.gate.gain, playing ? 1 : 0, this.context.currentTime, 0.018);
    if (!playing) this.panic();
  }

  /** Reuses stable node resources; the host gates actual topology transactions. */
  applyPlan(nodes: AudioPlanNode[], edges: AudioPlanEdge[]): void {
    for (const wire of this.wires) { try { wire.source.disconnect(wire.target); } catch { /* already disconnected */ } }
    this.wires = [];
    const live = new Set(nodes.map((node) => node.id));
    for (const [id, resource] of this.resources) {
      if (!live.has(id) || nodes.find((node) => node.id === id)?.kind !== resource.kind) {
        this.destroy(resource);
        this.resources.delete(id);
      }
    }
    for (const node of nodes) {
      if (!this.resources.has(node.id)) this.resources.set(node.id, this.create(node.kind));
    }
    const connect = (source?: AudioNode, target?: AudioNode) => {
      if (source && target) { source.connect(target); this.wires.push({ source, target }); }
    };
    for (const edge of edges) connect(this.resources.get(edge.source)?.output, this.resources.get(edge.target)?.input);
    for (const resource of this.resources.values()) {
      if (resource.kind === 'audio.output') connect(resource.output, this.gate);
      if (resource.kind === 'audio.input' && this.microphone) connect(this.microphone, resource.input);
    }
  }

  private create(kind: string): Resource {
    const c = this.context;
    const resource: Resource = { kind, nodes: [], voices: new Map() };
    const gain = () => { const node = c.createGain(); resource.nodes.push(node); return node; };
    if (kind === 'audio.filter') {
      const filter = c.createBiquadFilter(); resource.filter = filter; resource.nodes.push(filter); resource.input = resource.output = filter;
    } else if (kind === 'audio.pan') {
      const pan = c.createStereoPanner(); resource.pan = pan; resource.nodes.push(pan); resource.input = resource.output = pan;
    } else if (kind === 'audio.delay') {
      const input = gain(), output = gain(), dry = gain(), wet = gain(), feedback = gain();
      const delay = c.createDelay(2); resource.nodes.push(delay);
      delay.delayTime.value = 0.25; feedback.gain.value = 0.25; dry.gain.value = 0.7; wet.gain.value = 0.3;
      input.connect(dry); dry.connect(output); input.connect(delay); delay.connect(wet); wet.connect(output); delay.connect(feedback); feedback.connect(delay);
      Object.assign(resource, { input, output, delay, feedback, dry, wet });
    } else if (kind === 'analysis.level') {
      const analyser = c.createAnalyser(); analyser.fftSize = 1024; resource.nodes.push(analyser); resource.input = analyser; resource.analyser = analyser;
    } else {
      const bus = gain(); resource.input = bus; resource.output = bus;
      if (kind === 'audio.gain') { resource.gain = bus; bus.gain.value = 10 ** (-18 / 20); }
      if (kind === 'audio.oscillator' && this.voiceCount < MAX_VOICES) {
        const oscillator = c.createOscillator(); oscillator.frequency.value = 220;
        resource.nodes.push(oscillator); resource.oscillator = oscillator;
        bus.gain.value = 0.16; oscillator.connect(bus); oscillator.start();
      }
    }
    return resource;
  }

  update(id: string, params: Record<string, unknown>, time: number): void {
    const r = this.resources.get(id); if (!r) return;
    if (r.kind === 'voice.continuous' && typeof params.shapeMode === 'string' && params.shapeMode !== r.shapeMode) {
      if (r.shapeMode !== undefined) for (const voice of r.voices.values()) this.releaseVoice(voice, time);
      r.shapeMode = params.shapeMode;
    }
    if (r.gain) smooth(r.gain.gain, 10 ** (finite(Number(params.db), -18) / 20), time);
    if (r.filter) {
      r.filter.type = ['lowpass', 'highpass', 'bandpass'].includes(String(params.type)) ? params.type as BiquadFilterType : 'lowpass';
      smooth(r.filter.frequency, Math.min(this.context.sampleRate * 0.45, Number(params.frequency) || 1000), time);
      smooth(r.filter.Q, Number(params.q) || 0.7, time);
    }
    if (r.pan) smooth(r.pan.pan, Number(params.pan) || 0, time);
    if (r.delay && r.feedback && r.dry && r.wet) {
      smooth(r.delay.delayTime, Math.max(0.001, Number(params.seconds) || 0), time);
      smooth(r.feedback.gain, Math.min(0.9, Math.max(0, Number(params.feedback) || 0)), time);
      const mix = Math.min(1, Math.max(0, Number(params.mix) || 0));
      smooth(r.dry.gain, 1 - mix, time); smooth(r.wet.gain, mix, time);
    }
    if (r.oscillator) {
      r.oscillator.type = ['sine', 'triangle', 'sawtooth', 'square'].includes(String(params.waveform)) ? params.waveform as OscillatorType : 'sine';
      smooth(r.oscillator.frequency, Number(params.frequency) || 220, time);
    }
  }

  private newVoice(resource: Resource, target: VoiceTarget, at: number, character: number, kind: Voice['kind'] = 'continuous'): Voice | null {
    this.prune();
    if ([...this.allVoices].filter((voice) => voice.owner === resource).length >= MAX_BANK_VOICES || this.voiceCount >= MAX_VOICES || !resource.output) { this.droppedVoices++; return null; }
    const c = this.context;
    const carrier = c.createOscillator(), modulator = c.createOscillator(), modulation = c.createGain(), envelope = c.createGain(), pan = c.createStereoPanner();
    carrier.type = modulator.type = 'sine';
    carrier.frequency.value = target.frequency;
    modulator.frequency.value = target.frequency * 2.003;
    modulation.gain.value = target.frequency * character;
    envelope.gain.value = 0;
    pan.pan.value = target.pan;
    modulator.connect(modulation); modulation.connect(carrier.frequency); carrier.connect(envelope); envelope.connect(pan); pan.connect(resource.output);
    carrier.start(at); modulator.start(at);
    const voice: Voice = { id: target.id, owner: resource, carrier, modulator, modulation, envelope, pan, stopAt: Infinity, retired: false, kind };
    resource.voices.set(target.id, voice); this.allVoices.add(voice);
    carrier.onended = () => { this.disconnectVoice(voice); if (resource.voices.get(target.id) === voice) resource.voices.delete(target.id); };
    return voice;
  }

  continuous(id: string, targets: VoiceTarget[], at: number, character: number): void {
    const resource = this.resources.get(id); if (!resource || !this.playing) return;
    const live = new Set(targets.map((target) => target.id));
    for (const [voiceId, voice] of resource.voices) if (voice.kind === 'continuous' && !live.has(voiceId)) this.releaseVoice(voice, at);
    for (const target of targets.slice(0, MAX_BANK_VOICES)) {
      let voice = resource.voices.get(target.id);
      if (!voice || voice.retired) voice = this.newVoice(resource, target, at, character) ?? undefined;
      if (!voice) continue;
      smooth(voice.carrier.frequency, target.frequency, at);
      smooth(voice.modulator.frequency, target.frequency * 2.003, at);
      smooth(voice.modulation.gain, target.frequency * character * (0.25 + target.brightness * 1.5), at);
      smooth(voice.pan.pan, target.pan, at);
      smooth(voice.envelope.gain, target.amplitude, at);
    }
  }

  note(id: string, note: NoteTarget, at: number, decay = 0.6): void {
    const resource = this.resources.get(id); if (!resource || !this.playing) return;
    if (note.action === 'off') { for (const voice of resource.voices.values()) if (voice.id.startsWith(`${note.id}:`)) this.releaseVoice(voice, at); return; }
    if (!Number.isFinite(note.frequency) || note.frequency < 20 || note.frequency > this.context.sampleRate * 0.45) return;
    if (note.articulation === 'drum' && note.drum) { this.drum(resource, note, at); return; }
    if (note.articulation === 'shapes' && note.sourceId) {
      // Source Shapes crossfades a contact's previous strike, preserving the
      // other heads rather than silencing the complete instrument each tick.
      for (const previous of resource.voices.values()) if (previous.kind === 'note' && previous.sourceId === note.sourceId) this.releaseVoice(previous, at);
    }
    const character = note.articulation === 'shapes' ? 0 : note.articulation === 'graph' ? 0.65 + note.brightness : 0.1 + note.brightness * 0.35;
    const voice = this.newVoice(resource, { ...note, id: `${note.id}:${++this.serial}` }, at, character, 'note');
    if (!voice) return;
    voice.sourceId = note.sourceId;
    const length = note.articulation === 'graph' ? Math.min(4, Math.max(0.02, decay)) : Math.min(2, Math.max(0.035, note.duration));
    const attack = note.articulation === 'shapes' ? 0.004 : note.articulation === 'graph' ? 0.004 : 0.012;
    voice.envelope.gain.setValueAtTime(0, at);
    voice.envelope.gain.linearRampToValueAtTime(note.amplitude, at + attack);
    if (note.held) return;
    voice.envelope.gain.exponentialRampToValueAtTime(0.0001, at + attack + length);
    voice.modulation.gain.setValueAtTime(note.frequency * character, at);
    voice.modulation.gain.exponentialRampToValueAtTime(Math.max(0.001, note.frequency * character * 0.02), at + length);
    voice.stopAt = at + attack + length + 0.02;
    voice.carrier.stop(voice.stopAt); voice.modulator.stop(voice.stopAt);
  }

  /** Canonical Morphazoid FM-kit synthesis, adapted to the shared host bus.
   * Families keep their carrier/modulator shapes, swept pitch, tone filter,
   * noise layer and clap impulses; these are not pitched synth-note aliases.
   */
  private drum(resource: Resource, note: NoteTarget, at: number): void {
    const drum = note.drum; if (!drum) return;
    const voice = this.newVoice(resource, { ...note, id: `${note.id}:${++this.serial}` }, at, 0, 'drum');
    if (!voice) return;
    voice.sourceId = note.sourceId;
    const c = this.context, base = drum.frequency;
    const filter = c.createBiquadFilter(); voice.filter = filter;
    voice.envelope.disconnect(); voice.envelope.connect(filter); filter.connect(voice.pan);
    filter.type = drum.family === 'hat' ? 'highpass' : drum.family === 'rattle' ? 'bandpass' : 'lowpass';
    filter.frequency.value = Math.min(c.sampleRate * 0.45, drum.family === 'hat' ? 2200 + drum.tone * 5000 : drum.family === 'rattle' ? Math.min(12000, Math.max(480, base * 5)) : 550 + drum.tone * 11500);
    filter.Q.value = drum.family === 'rattle' ? 4.2 : drum.family === 'metal' ? 2.6 : 0.75;
    voice.carrier.type = ['hat', 'metal', 'rattle'].includes(drum.family) ? 'square' : 'sine';
    voice.modulator.type = drum.family === 'bell' ? 'sine' : 'triangle';
    voice.carrier.frequency.setValueAtTime(Math.min(16000, Math.max(20, base * Math.max(0.15, 1 + drum.pitchBend))), at);
    voice.carrier.frequency.exponentialRampToValueAtTime(base, at + Math.max(0.018, drum.decay * 0.42));
    voice.modulator.frequency.value = Math.min(18000, Math.max(20, base * drum.modRatio));
    voice.modulation.gain.setValueAtTime(base * drum.modIndex, at);
    voice.modulation.gain.exponentialRampToValueAtTime(0.001, at + Math.max(0.025, drum.decay));
    voice.envelope.gain.setValueAtTime(0.0001, at);
    voice.envelope.gain.exponentialRampToValueAtTime(Math.max(0.001, note.amplitude), at + drum.attack);
    voice.envelope.gain.exponentialRampToValueAtTime(0.0001, at + drum.attack + drum.decay);
    voice.stopAt = at + Math.max(0.12, drum.attack + drum.decay * 1.35);
    voice.carrier.stop(voice.stopAt); voice.modulator.stop(voice.stopAt);
    if (drum.noise > 0.005) {
      if (!this.noiseBuffer) {
        this.noiseBuffer = c.createBuffer(1, Math.ceil(c.sampleRate * 2.5), c.sampleRate);
        const samples = this.noiseBuffer.getChannelData(0);
        // Deterministic white noise makes offline comparisons reproducible.
        let seed = 0x41db7319;
        for (let index = 0; index < samples.length; index++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; samples[index] = (seed >>> 0) / 0x80000000 - 1; }
      }
      const noise = c.createBufferSource(), noiseEnvelope = c.createGain(), noiseFilter = c.createBiquadFilter();
      voice.noiseSource = noise; voice.noiseEnvelope = noiseEnvelope; voice.noiseFilter = noiseFilter;
      noise.buffer = this.noiseBuffer;
      noiseFilter.type = ['kick', 'rattle'].includes(drum.family) ? 'bandpass' : 'highpass';
      noiseFilter.frequency.value = Math.min(c.sampleRate * 0.45, drum.family === 'kick' ? 900 : drum.family === 'rattle' ? Math.min(13000, Math.max(520, base * 6)) : 900 + drum.tone * 7200);
      noiseFilter.Q.value = drum.family === 'rattle' ? 5.2 : drum.family === 'snare' ? 0.7 : 1.8;
      noiseEnvelope.gain.setValueAtTime(0.0001, at);
      noiseEnvelope.gain.linearRampToValueAtTime(drum.noise * note.amplitude, at + drum.attack);
      if (drum.id === 'wide-clap') {
        noiseEnvelope.gain.setValueAtTime(drum.noise * note.amplitude, at + 0.022);
        noiseEnvelope.gain.setValueAtTime(0.04, at + 0.032);
        noiseEnvelope.gain.setValueAtTime(drum.noise * note.amplitude * 0.72, at + 0.047);
      }
      noiseEnvelope.gain.exponentialRampToValueAtTime(0.0001, at + drum.attack + drum.decay);
      noise.connect(noiseFilter); noiseFilter.connect(noiseEnvelope); noiseEnvelope.connect(filter);
      noise.start(at); noise.stop(voice.stopAt);
    }
  }

  private releaseVoice(voice: Voice, at: number): void {
    if (voice.retired) return;
    voice.retired = true;
    voice.envelope.gain.cancelScheduledValues(at);
    smooth(voice.envelope.gain, 0, at, 0.012);
    if (voice.noiseEnvelope) { voice.noiseEnvelope.gain.cancelScheduledValues(at); smooth(voice.noiseEnvelope.gain, 0, at, 0.012); }
    voice.stopAt = at + 0.03;
    try { voice.carrier.stop(voice.stopAt); voice.modulator.stop(voice.stopAt); voice.noiseSource?.stop(voice.stopAt); } catch { /* ended */ }
  }

  private disconnectVoice(voice: Voice): void {
    voice.carrier.onended = null; this.allVoices.delete(voice);
    for (const node of [voice.carrier, voice.modulator, voice.modulation, voice.envelope, voice.pan, voice.filter, voice.noiseSource, voice.noiseEnvelope, voice.noiseFilter]) node?.disconnect();
  }

  private prune(): void {
    for (const voice of this.allVoices) {
      if (voice.stopAt < this.context.currentTime) { this.disconnectVoice(voice); if (voice.owner.voices.get(voice.id) === voice) voice.owner.voices.delete(voice.id); }
    }
  }

  get voiceCount(): number { this.prune(); let count = this.allVoices.size; for (const resource of this.resources.values()) count += resource.oscillator ? 1 : 0; return count; }
  level(id?: string): number {
    const analyser = id ? this.resources.get(id)?.analyser : this.analyser;
    if (!analyser) return 0;
    analyser.getFloatTimeDomainData(this.meter);
    let sum = 0; for (const value of this.meter) sum += value * value;
    return Math.min(1, Math.sqrt(sum / this.meter.length));
  }
  attachMicrophone(source: MediaStreamAudioSourceNode | null): void {
    if (this.microphone) { this.microphone.disconnect(); this.wires = this.wires.filter((wire) => wire.source !== this.microphone); }
    this.microphone = source;
    if (source) for (const resource of this.resources.values()) if (resource.kind === 'audio.input' && resource.input) { source.connect(resource.input); this.wires.push({ source, target: resource.input }); }
  }
  panic(): void { for (const resource of this.resources.values()) for (const voice of resource.voices.values()) this.releaseVoice(voice, this.context.currentTime); }
  releaseMidiSource(prefix: string): void {
    for (const voice of this.allVoices) if (voice.sourceId?.startsWith(prefix)) this.releaseVoice(voice, this.context.currentTime);
  }
  private destroy(resource: Resource): void {
    for (const voice of [...this.allVoices].filter((item) => item.owner === resource)) { try { voice.carrier.stop(); voice.modulator.stop(); voice.noiseSource?.stop(); } catch { /* ended */ } this.disconnectVoice(voice); }
    resource.voices.clear();
    if (resource.oscillator) try { resource.oscillator.stop(); } catch { /* ended */ }
    for (const node of resource.nodes) node.disconnect();
  }
  dispose(): void {
    this.microphone?.disconnect(); this.microphone = null;
    for (const resource of this.resources.values()) this.destroy(resource);
    this.resources.clear(); this.wires = [];
    this.gate.disconnect(); this.compressor.disconnect(); this.analyser.disconnect();
  }
}
