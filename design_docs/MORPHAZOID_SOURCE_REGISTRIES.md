# Morphazoid source registries

Pinned to `a67df8f44567b6fe457f2482f0084b24af249d1d`. These are source definitions and reference entries, **not additional nodes already shipped in AudioBrain**. [Page matrix](MORPHAZOID_PAGE_MATRIX.md) · [Architecture proposal](MORPHAZOID_ABSTRACTION_ATLAS.md).

The shader module registry has 125 entries; the DSP reference and its coverage map each have 145 entries. A reference technique may map to a module, a module mode, infrastructure or a workflow. These counts intentionally differ. Full port/parameter metadata is in [the survey JSON](MORPHAZOID_ABSTRACTION_SURVEY.json).

## SHADER_PLAYGROUND_MODULES (125)

Source: [src/shader-synth-playground.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/shader-synth-playground.js).

| Source ID / name | Category / execution | Source ports: input → output | Behavior / boundary |
| --- | --- | --- | --- |
| `constant` · Constant | control; Single-sample · uniform value | none → out:control | Produces a fixed control value for parameters that would otherwise remain unpatched. |
| `clock` · Clock phase | control; Single-sample · analytic event time | none → phase:control | Converts absolute sample time into a repeating 0–1 event phase; swing changes alternate phase lengths. |
| `lfo` · LFO | control; Single-sample · analytic phase | none → out:control | Produces cyclic control motion from absolute time without carrying oscillator state between samples. |
| `contour` · Event contour | control; Single-sample · event-age envelope | phase:control → out:control | Turns a clock phase into an attack-and-decay amplitude or modulation contour. |
| `oscillator` · Oscillator | source; Single-sample · analytic oscillator | pm:control/audio, pitch:control → out:audio | Evaluates a periodic waveform for each output sample; its input is a phase offset, not integrated arbitrary FM. |
| `noise` · Hash noise | source; Single-sample · deterministic hash | none → out:audio | Creates deterministic noise from the sample coordinate; rate and smoothing move it toward stepped control-like texture. |
| `fm` · FM / PM voice | modulation; Single-sample · fixed-ratio phase modulation | index:control/audio, pitch:control → out:audio | A bounded carrier–modulator phase network. Ratio sets sideband spacing; index sets their spectral spread. |
| `additive` · Harmonic bank | source; Single-sample · bounded partial loop | brightness:control, pitch:control → out:audio | Sums a bounded set of partials, fading components near Nyquist so density and spectral slope remain controllable. |
| `vca` · VCA | compose; Single-sample · multiply + soft ceiling | signal:audio/stereo, cv:control → out:audio | Uses a control signal to articulate an audio signal; the depth control crossfades between constant and modulated gain. |
| `ring` · Ring modulator | modulation; Single-sample · signal multiplication | a:audio/stereo, b:audio/stereo → out:audio | Multiplies two bipolar audio signals, replacing their original frequencies with sum-and-difference components. |
| `mix` · Two-channel mix | compose; Single-sample · equal-power sum | a:audio/stereo, b:audio/stereo → out:audio | Combines two routes with an equal-power balance so the center does not collapse as quickly as a linear crossfade. |
| `sum-3` · 3-input Adder | compose; Single-sample · three-input weighted sum | a:audio/stereo, b:audio/stereo, c:audio/stereo → out:audio | Adds three independent signal branches with separate weights, then applies energy compensation and a soft ceiling. |
| `product-3` · 3-input Multiplier | modulation; Single-sample · three-input multiplication | a:audio/stereo, b:audio/stereo, c:audio/stereo → out:audio | Multiplies three bipolar branches, producing intermodulation components that none of the inputs contains alone. |
| `fold` · Wavefolder | shape; Single-sample · nonlinear transfer | signal:audio/stereo → out:audio | Reflects an overdriven waveform through a sinusoidal fold, adding upper harmonics as drive and fold increase. |
| `quantize` · Amplitude quantizer | shape; Single-sample · amplitude rounding | signal:audio/stereo → out:audio | Rounds amplitude to a finite number of levels. Lower bit depths replace smooth motion with stepped distortion. |
| `pan` · Equal-power pan | space; Single-sample · stereo vector math | signal:audio/stereo, position:control → out:stereo | Converts mono to stereo using sine/cosine gains; a control input can move the position around its base value. |
| `softclip` · Soft clip | shape; Single-sample · nonlinear transfer | signal:audio/stereo → out:audio | Compresses peaks with a rational transfer curve, raising harmonic density without a hard digital corner. |
| `spectral-acid` · Spectral Acid | source; Single-sample · 1–48 partials · no filter history | cutoff:control, pitch:control → out:stereo | Builds an acid-like oscillator by weighting a bounded harmonic bank around a movable spectral cutoff and resonance peak. |
| `modal-metal` · Modal Metal | source; Single-sample · 1–32 analytic damped modes | strike:control, pitch:control → out:stereo | Restarts a bounded bank of scattered inharmonic modes at each event and gives higher modes progressively shorter decays. |
| `particle-cloud` · Particle Cloud | source; Single-sample · 16 analytic grain lanes | density:control, pitch:control → out:stereo | Layers sixteen deterministic, windowed oscillator grains with per-grain pitch and stereo placement; it does not read recorded samples. |
| `vector-wavetable` · Vector Wavetable | source; Single-sample · 1–32 Fourier partials | scan:control, pitch:control → out:stereo | Reconstructs sine, triangle, and saw spectra from a bounded Fourier bank, then scans continuously between them without a table lookup. |
| `formant-bank` · Formant Bank | source; Single-sample · 1–32 formant-weighted harmonics | vowel:control, pitch:control → out:stereo | Weights source harmonics with three vowel-shaped Gaussian spectral peaks; it is spectral-envelope synthesis, not recursive filtering. |
| `procedural-kick` · Procedural Kick | source; Single-sample · analytic pitch integral + envelope | phase:control, pitch:control → out:audio | Integrates a falling exponential pitch analytically, then combines the decaying sine body with a separately windowed click. |
| `sample-hold` · Sample + Hold | control; Single-sample · stateless hash cells | none → out:control | Derives deterministic random plateaus from the sample coordinate, with an optional end-of-step glide that requires no stored history. |
| `euclidean-gate` · Euclidean Gate | control; Single-sample · integer clock + modulo | none → out:control | Evaluates an integer modulo predicate on a repeating step grid to distribute gates as evenly as possible. |
| `gpu-arp` · GPU Arpeggiator | control; Single-sample · GPU step selection | none → pitch:control, gate:control | Selects scale degrees, swing timing, glide, and a click-safe gate from the absolute sample coordinate. Pitch and gate can fan out independently. |
| `hard-sync` · Hard Sync | modulation; Single-sample · stateless phase reset | ratio:control, pitch:control → out:stereo | Maps a slave oscillator into each master cycle so the slave phase restarts at every master boundary. |
| `phase-distortion` · Phase Distortion | modulation; Single-sample · piecewise phase map | bend:control, pitch:control → out:stereo | Bends the phase slope on either side of a movable split point while preserving one complete oscillator cycle. |
| `bytebeat` · Bytebeat | source; Single-sample · u32 arithmetic · intentionally aliased | variation:control, pitch:control → out:stereo | Turns explicit 32-bit shifts, masks, multiplication, and overflow into repeating lo-fi melody and rhythm. |
| `chebyshev` · Polynomial / Chebyshev shaper | shape; Single-sample · 1–8 polynomial recurrence | signal:audio/stereo → out:audio | Builds a bounded Chebyshev polynomial series from a clipped input; a normalized sine exposes the clearest harmonic-number relationship. |
| `am-tremolo` · AM / Tremolo | modulation; Single-sample · analytic modulator · no history | signal:audio/stereo → out:stereo | Multiplies one incoming signal by a continuous low- or audio-rate waveform, moving from tremolo into carrier-retaining AM sidebands. |
| `chord-arpeggiator` · Chord Arpeggiator | control; Single-sample · deterministic chord lookup | root:control → pitch:control, gate:control | Traverses triads and seventh chords with inversion, direction, glide, swing, and a click-safe gate packed beside pitch. |
| `euclidean-arpeggiator` · Euclidean Arpeggiator | control; Single-sample · bounded rhythm ordinal | root:control → pitch:control, gate:control | Places notes with an integer Euclidean predicate, advances scale pitch only across hits, and packs an edge-safe gate into output Y. |
| `random-walk-arpeggiator` · Random-walk Arpeggiator | control; Single-sample · at most 128 hashed walk increments | root:control → pitch:control, gate:control | Reconstructs a repeatable bounded pitch walk from the absolute step coordinate, with no mutable sequencer state. |
| `additive-drawbar-organ` · Additive Drawbar Organ | source; Single-sample · 1–9 external analytic rank lanes | control:control, pitch:control → out:stereo | Sums nine editable rank lanes from organ_rank; every lane carries ratio, level, AM rate, and AM depth for GPU-parallel registration design. |
| `supersaw` · Supersaw Unison | source; Single-sample · 1–9 bounded unison voices | motion:control, pitch:control → out:stereo | Stacks up to nine phase-scattered, band-limited oscillators with symmetric detune, analytic drift, and stereo distribution. |
| `chirp-sweep` · Analytic Chirp Sweep | source; Single-sample · analytic frequency integral | pitch:control → out:stereo | Integrates a curved frequency trajectory exactly within each event, producing clean risers, dives, pings, and test-like sweeps. |
| `air-swoosh` · Air Swoosh | source; Single-sample · eight chirp lanes + bounded hiss | none → out:stereo | Sweeps a randomized bank of analytic partials through a raised-sine air envelope, with optional decorrelated hash hiss. |
| `laser-woosh` · Laser Woosh | source; Single-sample · curved chirp + phase warp | pitch:control → out:stereo | Fires a curved analytic chirp through bounded self-phase modulation for repeatable zaps, pews, dives, and ricochets. |
| `robot-voice` · Robot Voice | source; Single-sample · 4–24 formant-weighted harmonics | vowel:control, pitch:control → out:stereo | Weights a phase-warped harmonic carrier with moving vowel peaks and smooth machine-rate articulation for intelligible metallic drones. |
| `analytic-plucked-string` · Analytic Plucked String | source; Single-sample · 1–32 damped analytic modes | pitch:control → out:stereo | Evaluates a finite damped string-mode series whose initial amplitudes follow pluck position and whose upper modes bend with stiffness. |
| `wave-terrain` · Analytic Wave Terrain | source; Single-sample · analytic orbit + terrain function | motion:control, pitch:control → out:stereo | Drives a closed circular orbit through one of six procedural 2D height fields, turning geometric path changes into timbre changes. |
| `fractal-recurrence` · Fractal Recurrence | source; Single-sample · 1–12 bounded recurrence iterations | control:control, pitch:control → out:stereo | Maps a periodic orbit through a clamped inversion recurrence, exposing brittle tones and deterministic pseudo-chaos without sample feedback. |
| `procedural-snare` · Procedural Snare | source; Single-sample · analytic body + stateless noise | pitch:control → out:stereo | Layers two decaying shell modes with differentiated deterministic noise and a short wire snap, all reconstructed from event age. |
| `metallic-hi-hat` · Metallic Hi-hat | source; Single-sample · eight inharmonic modes | pitch:control → out:stereo | Excites an eight-lane inharmonic sine alloy with a fast transient and variable open decay, avoiding raw square-wave alias spray. |
| `clap-burst` · Clap Burst | source; Single-sample · four bounded burst windows | none → out:stereo | Shapes decorrelated noise into one to four softened attacks plus a diffuse exponential tail for flams, crushed claps, and crowds. |
| `fof-voice` · FOF Formant Voice | source; Single-sample · analytic pitch-synchronous grain | formant:control, pitch:control → out:stereo | Repeats exponentially damped formant sinusoids at the fundamental rate, separating perceived pitch from resonant vocal color. |
| `full-wave-rectifier` · Full-wave Rectifier | shape; Single-sample · absolute-value waveshaper | signal:audio/stereo → out:stereo | Folds negative waveform halves upward, optionally smoothing the cusp and subtracting the normalized-sine DC estimate. |
| `mid-side-width` · Mid / Side Width | space; Single-sample · stereo matrix | signal:audio/stereo → out:stereo | Encodes stereo into center and difference components, scales and rotates that plane, then decodes it with peak compensation. |
| `cyclic-fractal-noise` · Cyclic Fractal Noise | source; Single-sample · 1–6 fixed cyclic-noise octaves | control:control → out:stereo | Loops a 3D seed orbit through a rotated, trigonometric octave field for coherent textures ranging from air to liquid machinery. |
| `bitmask-rhythm` · Bitmask Rhythm | control; Single-sample · u32 mask test | none → gate:control | Reads a 16-bit pattern and accent word on a swung step grid, producing a deterministic click-safe control gate. |
| `morph-crossfade` · Morph Crossfade | compose; Single-sample · equal-power stereo crossfade | a:audio/stereo, b:audio/stereo, morph:control → out:stereo | Morphs between two stereo signals with equal-power gains, an optional control input, and adjustable motion around the center. |
| `harmonic-exciter` · Harmonic Exciter | shape; Single-sample · bounded polynomial waveshaper | signal:audio/stereo, drive:control → out:stereo | Adds controlled second-, third-, and fifth-order color with a zero-safe asymmetric branch and a bounded output ceiling. |
| `cv-curve-mapper` · CV Curve Mapper | control; Single-sample · signed or unipolar power curve | control:control → out:control | Scales, offsets, bends, inverts, and limits a control signal so one modulation source can suit very different destinations. |
| `mirror-fold-sequencer` · Mirror Fold Sequencer | geometry; Single-sample · bounded domain-fold loop | root:control → pitch:control, gate:control | Treats step number as a shader coordinate, then repeatedly tiles and mirrors that coordinate before reading pitch from the folded position. |
| `sdf-orbit-sequencer` · SDF Shape Sequencer | geometry; Single-sample · analytic 2D shape field | root:control → pitch:control, gate:control | Sweeps a line through a repeated signed shape field; each boundary crossing becomes a gate and each shape cell chooses a pitch. |
| `polar-kaleidoscope-sequencer` · Polar Kaleidoscope | geometry; Single-sample · polar modulo + reflection | root:control → pitch:control, gate:control | Wraps a circular step path into angular wedges and reflects every wedge, producing radial, palindromic pitch order. |
| `voronoi-cell-sequencer` · Voronoi Cell Sequencer | geometry; Single-sample · five-neighbor nearest-site search | root:control → pitch:control, gate:control | Finds the closest jittered time-cell site and its runner-up; sites or the F2−F1 border ridge become irregular but deterministic musical events. |
| `truchet-path-sequencer` · Truchet Path Sequencer | geometry; Single-sample · hashed tile orientation + arc SDF | root:control → pitch:control, gate:control | Moves a scan point through hashed Truchet tiles; distance to the paired quarter-circle arcs opens gates along a repeatable curved path. |
| `kifs-fold-sequencer` · KIFS Fold Sequencer | geometry; Single-sample · 1–8 rotate/scale/absolute folds | root:control → pitch:control, gate:control | Applies a bounded kaleidoscopic iterated-function fold to each point on a circular step path, turning self-similar regions into notes and rests. |
| `interference-lattice-sequencer` · Interference Lattice | geometry; Single-sample · 3–12 bounded plane-wave sum | root:control → pitch:control, gate:control | Sums rotated plane waves along a two-dimensional orbit, then thresholds their interference field into quasi-periodic gates and pitches. |
| `phase-plane` · Phase Plane | geometry; Single-sample · analytic X/Y trajectory | phase:control → x:control, y:control | Generates a continuous two-dimensional trajectory from absolute sample time so later geometry modules can be connected as coordinate processors. |
| `tile-mirror-domain` · Tile + Mirror | geometry; Single-sample · coordinate transform | x:control, y:control, offset:control → x:control, y:control | Repeats incoming X/Y coordinates into local cells and optionally mirrors each axis, turning one trajectory into a tiled or palindromic domain. |
| `polar-fold-domain` · Polar Fold | geometry; Single-sample · guarded atan2 + sector fold | x:control, y:control, twist:control → x:control, y:control | Converts X/Y into radius and angle, then repeats and reflects the angular domain like a kaleidoscope while radial twist couples distance to timing. |
| `sdf-pattern-field` · SDF Pattern | geometry; Single-sample · repeated signed shape field | x:control, y:control, size:control → field:control, gate:control | Measures incoming coordinates against a repeated analytic shape and exposes both its signed field and a softly edged contour gate. |
| `sdf-logic` · SDF Logic | geometry; Single-sample · distance-field min/max logic | a:control, b:control, morph:control → field:control, gate:control | Combines two distance streams with union, intersection, subtraction, or XOR-like logic; a third control morphs toward a related operation. |
| `interference-field` · Interference Field | geometry; Single-sample · 2–12 bounded plane waves | x:control, y:control, phase:control → field:control, gate:control | Sums evenly rotated plane waves at incoming X/Y coordinates and exposes their continuous interference brightness plus a thresholded event field. |
| `voronoi-event-field` · Voronoi Events | geometry; Single-sample · fixed local 3×3 feature search | x:control, y:control, motion:control → field:control, gate:control | Searches a fixed 3×3 neighborhood around incoming coordinates; the nearest-cell identity becomes held CV while sites or the local F2−F1 ridge become events. |
| `truchet-router` · Truchet Router | geometry; Single-sample · cell hash + two arc distances | x:control, y:control, turn:control → field:control, gate:control | Measures incoming coordinates against paired circular arcs in deterministic Truchet tiles; arc proximity becomes a gate, with a short seam fade before tile identity changes. |
| `shepard-risset-spiral` · Shepard / Risset Spiral | source; Single-sample · 3–10 bounded octave layers | none → out:stereo | Layers octave-related oscillators under a sliding cosine envelope so the pitch appears to rise or fall continuously without leaving its register. |
| `procedural-bird-flock` · Procedural Bird Flock | source; Single-sample · 2–8 bounded deterministic call lanes | none → out:stereo | Schedules deterministic clusters of short analytic chirps, trills, and airy calls across independently offset stereo positions. |
| `thunder-impact-cell` · Thunder / Impact Cell | source; Single-sample · bounded click, body, and rumble layers | none → out:stereo | Combines an immediate crack, an analytically falling resonant body, and several deterministic low-rate noise bands into a repeating impact cell. |
| `delay` · Simple Delay | space; History pass · simple 1–6 tap echo | signal:audio/stereo → out:stereo | Reads fractional positions from persistent signal history to make decaying echoes whose taps can alternate across stereo. |
| `reverb` · Convolution Reverb | space; History pass · 4–64 reflection taps | signal:audio/stereo → out:stereo | Builds a deterministic stereo reflection field from scattered reads of the persistent dry history. |
| `recombobulator` · Recombobulator | space; History pass · crossfaded moving tap field | signal:audio/stereo → out:stereo | Continuously replaces a bank of signed, folded history reads with a new deterministic routing pattern. |
| `spectral-resynth` · Sliding-DFT Resynth | spectral; History pass · bounded sliding DFT | signal:audio/stereo → out:stereo | Measures a short causal spectrum at every sample and rebuilds its energy with shifted, phase-scattered oscillator bins. |
| `flanger` · Flanger | space; History pass · stereo modulated fractional read | signal:audio/stereo → out:stereo | Adds a very short, smoothly moving feed-forward delay to the dry signal for a swept comb-filter jet without recursive feedback. |
| `chorus` · Chorus | space; History pass · 3–6 moving stereo voices | signal:audio/stereo → out:stereo | Averages several gently detuned fractional-delay voices with independent stereo phases to create a broad ensemble. |
| `doppler-sweep` · Doppler Sweep | space; History pass · bounded moving propagation read | signal:audio/stereo → out:stereo | Moves a causal fractional-delay read toward and away from the listener so pitch bends emerge from changing propagation time. |
| `fft-robotizer` · FFT Robotizer | spectral; History pass · bounded sliding DFT phase replacement | signal:audio/stereo → out:stereo | Keeps short-window spectral magnitudes but replaces analyzed phase with a fixed quantized phase map for a rigid robotic resynthesis. |
| `spectral-gate` · Spectral Gate | spectral; History pass · bounded sliding DFT threshold mask | signal:audio/stereo → out:stereo | Measures a causal short-window spectrum, attenuates bins below a soft threshold, and resynthesizes the surviving phase-coherent bands. |
| `fir-lowpass` · FIR Low-pass | filter; History pass · 7–31 FIR taps · fixed 15-sample alignment | signal:audio/stereo → out:stereo | Applies a short causal windowed-sinc low-pass inside a fixed 31-sample span. Every kernel and the dry comparison share the same 15-sample latency, so changing tap count does not move the signal in time. |
| `fir-highpass` · FIR High-pass | filter; History pass · aligned subtraction · 7–31 taps · fixed latency | signal:audio/stereo → out:stereo | Subtracts a short windowed-sinc low-pass from the input delayed by 15 samples. The active kernel stays centered in a fixed span, preserving both the high-pass subtraction and live tap-count alignment. |
| `fir-bandpass` · FIR Band-pass | filter; History pass · two aligned FIR sums · 7–31 taps · fixed latency | signal:audio/stereo → out:stereo | Subtracts two short, equally aligned windowed-sinc low-passes. Both kernels stay centered at the same fixed 15-sample position so the selected broad frequency band and live tap changes remain aligned. |
| `sample-rate-reducer` · Sample-rate Reducer | shape; History pass · causal held-sample reads | signal:audio/stereo → out:stereo | Reads one earlier sample for each reduced-rate cell, optionally interpolating causally between adjacent held values; unlike bit crushing, this changes time resolution. |
| `vibrato` · Vibrato | space; History pass · continuously moving fractional read | signal:audio/stereo → out:stereo | Moves a causal fractional-delay read smoothly around the present, turning delay motion into a controlled periodic pitch bend. |
| `trigger-impulse` · Trigger / Impulse | control; Single-sample · integer sample comparison | none → out:control | Marks a deterministic sample address with a pulse. A width of one sample is a unit impulse; wider defaults make the event easier to audition as a gate. |
| `segment-adsr` · Segment ADSR | control; Single-sample · analytic note-local segments | none → out:control | Evaluates a repeating attack, decay, sustain, and release contour directly from note-local sample time, with no hidden envelope state. |
| `grain-window` · Grain Window | control; Single-sample · analytic window | none → out:control | Generates a bounded periodic splice window whose endpoints reach zero before the next grain begins. |
| `log-parameter-map` · Log Range Mapper | control; Single-sample · exponential control mapping | control:control → out:control | Maps a normalized control across a positive range with even proportional or octave spacing. |
| `cheap-filtered-wave` · Rounded-edge Oscillator | source; Single-sample · analytic waveform geometry | roundness:control, pitch:control → out:stereo | Rounds a saw or square discontinuity geometrically, creating filter-like spectral motion without claiming to filter arbitrary audio. |
| `additive-transfer-filter` · Partial Transfer Filter | spectral; Single-sample · bounded partial response loop | cutoff:control, pitch:control → out:audio | Builds its own harmonic bank, applies a low-pass magnitude curve, and gives every known partial an independently adjustable frequency-dependent phase color. It is not an arbitrary-audio filter. |
| `gaussian-random-pair` · Gaussian Pair | modulation; Single-sample/event · stateless distribution transform | u1:control, u2:control → x:control, y:control | Transforms two patched uniform controls into a correlated pair of bell-shaped values using the stateless Box–Muller transform. |
| `control-derived-ducking` · Clock Duck | dynamics; Single-sample · analytic gain contour | signal:audio/stereo, duck:control → out:stereo | Choreographs gain from a known analytic clock or a patched duck envelope. It does not pretend to detect unexpected audio peaks. |
| `parallel-voice-bank` · Parallel Voice Bank | source; Single-sample · 1–12 bounded voice loop | pitch:control, spread:control → out:stereo | Evaluates a bounded bank of independently pitched, drifting, and panned oscillator voices inside each output sample. |
| `hex-triangle-lattice-clock` · Hex / Triangle Lattice | geometry; Single-sample · affine lattice coordinates | root:control → pitch:control, gate:control | Moves a trajectory through a 60-degree coordinate basis so crossings on three coupled axes become related gates and pitches. |
| `log-spiral-event-field` · Log Spiral Events | geometry; Single-sample · polar logarithmic field | root:control → pitch:control, gate:control | Converts polar angle and logarithmic radius into scale-invariant event bands whose timing changes as the orbit moves inward and outward. |
| `domain-warp-time-field` · Domain-warp Time Field | geometry; Single-sample · two bounded octave-field passes | x:control, y:control, warp:control → field:control, gate:control | Builds two bounded octave fields, uses them to bend the input coordinate, and emits a related continuous control and event gate. |
| `fractal-orbit-trap-events` · Fractal Orbit-trap Events | geometry; Single-sample · 1–12 bounded recurrence iterations | x:control, y:control, morph:control → field:control, gate:control | Runs a bounded inverse-and-fold recurrence per sample and turns the nearest orbit-trap approach into continuous control and sparse gates. |
| `analytic-glide-oscillator` · Analytic Glide Oscillator | source; Single-sample · analytic phase integral · no history | none → out:stereo | Repeats a finite exponential pitch glide, then continues at its exact ending phase and frequency during a hold segment; a short zero-edge window makes the stateless restart click-safe. |
| `normalized-route` · Normalized Route | control; Single-sample · graph input mapping · no lane buffer | route:control → out:control | Adapts the atlas lane router to a graph cable: the incoming control is converted to 0–1, optionally inverted, then blended with a normalized fallback value. |
| `linear-range-map` · Linear Range Map | control; Single-sample · linear unit-to-range mapping | route:control → out:control | Converts a normalized graph control into a chosen linear output range while retaining the atlas router's physical fallback and route-depth behavior. |
| `wavefold-table-oscillator` · Wavefold Table Oscillator | source; Single-sample · 1–8 bounded analytic layers | scan:control, pitch:control → out:stereo | Scans an analytic sine–triangle–saw family, evaluates up to eight symmetrically detuned layers, and passes every layer through a sine fold before stereo summing. |
| `cellular-automaton-score` · Cellular Automaton Score | geometry; Persistent GPU grid · ordered generation pass at event boundaries · active nodes only | root:control → pitch:control, gate:control | Evolves an elementary cellular-automaton row on the GPU. A moving read head turns live cells into gates, while cell position and neighborhood become quantized pitch. |
| `reaction-diffusion-score-lattice` · Reaction–Diffusion Score Lattice | geometry; Persistent ping-pong GPU surface · bounded Gray–Scott update passes · active nodes only | x:control, y:control → field:control, gate:control | Evolves two coupled concentrations across a wrapped GPU surface. Patched X/Y coordinates sample its moving chemical field; contour strength supplies a related gate. |
| `geometric-feedback-lattice` · Geometric Feedback Lattice | space; Ordered GPU state pass · persistent delay-cell surface · active nodes only | signal:audio/stereo → out:stereo | Injects audio into a wrapped grid of delay cells. Rotated, repeatedly folded neighbor routes circulate the signal as a spatially patterned feedback network. |
| `spectral-sdf` · Spectral SDF | spectral; Dedicated GPU state pass · 64-band windowed DFT → SDF transform → overlap-add | signal:audio/stereo → out:stereo | Places bins from a bounded windowed DFT and successive analysis frames in a signed-distance coordinate field. The selected shape keeps, suppresses, or reflects regions before overlap-add resynthesis. |
| `flow-field-advection` · Flow-field Advection | geometry; Persistent GPU particle buffers · bounded advection and reduction passes · active nodes only | x:control, y:control → x:control, y:control | Advects a persistent particle cloud through a curl-like vector field. Patched X/Y supplies a moving attractor; the output is the cloud centroid and anisotropy as two related controls. |
| `raymarch-resonator` · Raymarch Resonator | spectral; Dedicated GPU state projection · bounded SDF rays + 48-mode recurrence · no texture grid | excite:audio/stereo → out:stereo | Raymarches a bounded signed-distance shape to derive path lengths and surface identities, then uses those measurements as frequencies and gains in a compact modal resonator bank. |
| `sequence-lane` · Sequence Lane | control; Ordered state pass · persistent 128-step lane · active nodes only | phase:control, value:control → pitch:control, gate:control | Reads a persistent 128-value score lane with selectable generated patterns, sample-accurate swing, and click-safe interpolation between cells. |
| `uploaded-wavetable` · Uploaded Wavetable | source; Ordered state pass · persistent uploaded table and stereo phase · active nodes only | scan:control, pitch:control → out:stereo | Reads one periodic waveform from GPU storage, with interpolated phase, shape warping, and built-in timbre morphs without copying the table for every audio chunk. |
| `gpu-sampler-granulator` · GPU Sampler / Granulator | source; Ordered state pass · persistent sample + bounded 24-grain loop · active nodes only | position:control, density:control, pitch:control → out:stereo | Shares one resident recording across one-shot, looped, scanned, frozen, and many-playhead granular modes, then reduces active grains into stereo. |
| `spatializer` · Directional Spatializer | space; Ordered state pass · stereo delay ring + analytic directional cues · active nodes only | signal:audio/stereo, azimuth:control, elevation:control → out:stereo | Places an input with equal-power, first-order-field, analytic binaural-cue, and early-reflection room approximations. |
| `recursive-filter` · Recursive Filter | filter; Ordered state pass · persistent biquad / SVF recurrence · active nodes only | signal:audio/stereo, cutoff:control, resonance:control → out:stereo | Runs DC blocking, biquad responses, or a state-variable topology through one ordered filter-state path with smooth coefficient transitions. |
| `feedback-network` · Feedback Network | space; Ordered state pass · circular delay + recirculating multi-tap field · active nodes only | signal:audio/stereo, time:control, tone:control → out:stereo | Shares one bounded circular history across recirculating echo, comb, all-pass, four/eight-tap diffusion fields, and nonlinear geometric feedback modes. |
| `wavefield-solver` · Wavefield Solver | source; Persistent ping-pong wavefield · cell-parallel block updates with audio-rate interpolation · active nodes only | excite:audio/stereo, position:control, material:control → out:stereo | Uses one conditional grid-state family for delay-line strings, nonlinear strings, membranes, plates, rooms, and directional waveguide meshes. |
| `spectral-transport` · Spectral Transport | spectral; Ordered state pass · 32 complex resonators + phase-carried resynthesis · active nodes only | signal:audio/stereo, shift:control, time:control → out:stereo | Uses 32 persistent complex resonator bands and phase-carried oscillator resynthesis for compact remap, pitch, envelope-time, freeze, robot, and gate treatments. |
| `dynamics` · Dynamics | dynamics; Ordered state pass · detector/envelope recurrence + lookahead ring · active nodes only | signal:audio/stereo, sidechain:audio/stereo/control, threshold:control → out:stereo | Tracks sample peaks or a four-point quadratic intersample estimate through a persistent gain envelope for compression, limiting, expansion, gating, or level riding. |
| `convolution-space` · Convolution Space | space; 64-lane sample blocks · synchronized 12-second history + 24/40/56 sparse IR taps · active nodes only | signal:audio/stereo, morph:control, size:control → out:stereo | Samples 24–56 taps from a 12-second GPU history ring for cabinet, body, resonator, room, and uploaded-IR approximations. |
| `massive-bank` · Massive Bank | source; Ordered state pass · closed-form bank sums or 128-mode recurrence · active nodes only | excite:audio/stereo, pitch:control, spectrum:control → out:stereo | Uses closed-form structured oscillator sums up to one million lanes, plus a bounded 128-state modal or nonlinear resonator bank. |
| `audio-analysis-field` · Audio Analysis Field | control; Ordered state pass · waveform ring + periodic scalar reductions · active nodes only | signal:audio/stereo/control → field:control, gate:control | Adapts ShaderToy's audio-field idea into a persistent GPU waveform ring plus periodic scalar feature reductions, then exposes one feature and threshold gate to the graph. |
| `ddsp-resynth` · DDSP Resynth | source; Ordered state pass · 64 carried partial phases + four persistent noise filters · active nodes only | pitch:control, loudness:control, timbre:control → out:stereo | Decodes pitch, loudness, and timbre controls into editable harmonic or inharmonic oscillators plus a four-band filtered-noise spectrum. |
| `spectral-vocoder` · Spectral Vocoder | spectral; Ordered state pass · two 32-band filter passes + envelope state · active nodes only | modulator:audio/stereo, carrier:audio/stereo, morph:control → out:stereo | Runs a 32-channel vocoder: paired modulator/carrier bandpass filters track envelopes, then transfer them across shifted carrier bands. |
| `neural-processor` · Neural Processor | nonlinear; Ordered state pass · fixed coefficients + receptive/recurrent state · active nodes only | signal:audio/stereo, condition:control, morph:control → out:stereo | Runs a compact fixed-weight dilated stack or recurrent neural-style state model with patchable conditioning; model upload is not implied. |
| `output` · Output | output; Single-sample · final stereo write | signal:audio/stereo → none | Collects the graph's final stereo signal, applies output gain, and limits extreme peaks before readback. |

## PRIMITIVE_LIBRARY (38)

Source: [src/constellation-composer.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/constellation-composer.js).

| Source ID / name | Category | Source ports | Runtime role / conversion |
| --- | --- | --- | --- |
| `clock` · Clock | trigger | out trigger-out:trigger | {"kind": "clock", "role": "source"} |
| `euclid` · Euclidean pulse | trigger | out trigger-out:trigger | {"kind": "clock", "role": "euclidean-source"} |
| `chance` · Chance gate | trigger | in trigger-in:trigger; out trigger-out:trigger | {"kind": "clock", "role": "chance-gate"} |
| `divider` · Clock divider | trigger | in trigger-in:trigger; out trigger-out:trigger | {"kind": "clock", "role": "divider", "eventTransform": "clock-divider"} |
| `clock-multiplier` · Clock multiplier | trigger | in trigger-in:trigger; out trigger-out:trigger | {"kind": "clock", "role": "multiplier", "eventTransform": "clock-multiplier"} |
| `swing-clock` · Swing clock | trigger | in trigger-in:trigger; out trigger-out:trigger | {"kind": "clock", "role": "swing", "eventTransform": "clock-swing"} |
| `phase-clock` · Clock phase | trigger | in trigger-in:trigger; out trigger-out:trigger | {"kind": "clock", "role": "phase", "eventTransform": "clock-phase"} |
| `sync-bridge` · Clock / MIDI sync | trigger | in trigger-in:trigger; in midi-in:midi; out trigger-out:trigger; out midi-out:midi | {"kind": "clock", "role": "sync-bridge", "conversion": "clock-midi-sync"} |
| `midi-input` · MIDI input | midi | out midi-out:midi | {"kind": "midi", "role": "input"} |
| `midi-clock` · MIDI clock | midi | out midi-out:midi | {"kind": "midi", "role": "clock-source", "ppqn": 24} |
| `midi-router` · MIDI router | midi | in midi-in:midi; out midi-out:midi | {"kind": "midi", "role": "through"} |
| `midi-output` · MIDI output | midi | in midi-in:midi | {"kind": "midi", "role": "output"} |
| `lfo` · LFO | control | out control-out:control | {} |
| `envelope` · Envelope | control | in trigger-in:trigger; out control-out:control | {} |
| `drum-voice` · Drum voice | instrument | in trigger-in:trigger; in midi-in:midi; in control-in:control; out audio-out:audio; out trigger-out:trigger; out midi-out:midi | {"kind": "instrument", "engine": "constellation-drums"} |
| `oscillator` · Oscillator | instrument | in trigger-in:trigger; in midi-in:midi; in control-in:control; out audio-out:audio; out trigger-out:trigger; out midi-out:midi | {"kind": "instrument", "engine": "constellation-oscillator"} |
| `voice` · Voice source | instrument | in trigger-in:trigger; in midi-in:midi; in control-in:control; out audio-out:audio; out trigger-out:trigger; out midi-out:midi | {"kind": "instrument", "engine": "constellation-voice"} |
| `hiccup-head` · Hiccup Head | instrument | in trigger-in:trigger; in midi-in:midi; in control-in:control; out audio-out:audio; out trigger-out:trigger; out midi-out:midi | {"kind": "instrument", "engine": "hiccup-head"} |
| `webgpu-303` · WebGPU 303 | instrument | in trigger-in:trigger; in midi-in:midi; in control-in:control; out audio-out:audio; out trigger-out:trigger; out midi-out:midi | {"kind": "instrument", "engine": "webgpu-303", "transportAware": true} |
| `gain` · Gain | routing | in audio-in:audio; in control-in:control; out audio-out:audio | {"kind": "output", "role": "gain"} |
| `filter` · Filter | effect | in audio-in:audio; in control-in:control; in midi-in:midi; out audio-out:audio; out midi-out:midi | {"kind": "output", "role": "filter"} |
| `delay` · Delay | effect | in audio-in:audio; in control-in:control; in trigger-in:trigger; in midi-in:midi; out audio-out:audio; out trigger-out:trigger; out midi-out:midi | {"kind": "output", "role": "delay"} |
| `reverb` · Reverb | effect | in audio-in:audio; in control-in:control; in midi-in:midi; out audio-out:audio; out midi-out:midi | {"kind": "output", "role": "reverb"} |
| `compressor` · Compressor | effect | in audio-in:audio; in control-in:control; in midi-in:midi; out audio-out:audio; out midi-out:midi | {"kind": "output", "role": "compressor"} |
| `mixer` · Mixer | routing | in audio-in:audio; in control-in:control; out audio-out:audio | {"kind": "output", "role": "mixer"} |
| `output` · Output | routing | in audio-in:audio; in control-in:control | {"kind": "output", "role": "stereo"} |
| `surround-output` · Surround output | routing | in audio-in:audio; in control-in:control | {"kind": "output", "role": "surround", "multichannel": true} |
| `recorder` · Recorder | routing | in audio-in:audio; in trigger-in:trigger; in control-in:control; out audio-out:audio | {"kind": "recorder", "role": "audio-tap", "passThrough": true} |
| `scope` · Oscilloscope | monitor | in audio-in:audio; out audio-out:audio | {"kind": "monitor", "role": "scope", "analysis": "waveform", "passThrough": true} |
| `level-meter` · Level meter | monitor | in audio-in:audio; out audio-out:audio; out control-out:control | {"kind": "monitor", "role": "level", "analysis": "rms-peak", "passThrough": true} |
| `spectrum` · Spectrum / FFT | monitor | in audio-in:audio; out audio-out:audio | {"kind": "monitor", "role": "spectrum", "analysis": "fft", "passThrough": true} |
| `frequency-tracker` · Frequency tracker | monitor | in audio-in:audio; out audio-out:audio; out control-out:control | {"kind": "monitor", "role": "frequency", "analysis": "fundamental", "passThrough": true} |
| `control-display` · Numeric control display | monitor | in control-in:control; out control-out:control | {"kind": "monitor", "role": "numeric-control", "analysis": "control-value", "passThrough": true} |
| `frequency-to-midi` · Frequency to MIDI | converter | in control-in:control; out midi-out:midi | {"kind": "converter", "conversion": "frequency-to-midi"} |
| `midi-to-frequency` · MIDI to frequency | converter | in midi-in:midi; out control-out:control | {"kind": "converter", "conversion": "midi-to-frequency"} |
| `midi-to-control` · MIDI to control | converter | in midi-in:midi; out control-out:control | {"kind": "converter", "conversion": "midi-to-control"} |
| `amplitude-to-midi` · Amplitude to MIDI | converter | in audio-in:audio; out audio-out:audio; out midi-out:midi | {"kind": "converter", "conversion": "amplitude-to-midi", "analysis": "rms-gate", "passThrough": true} |
| `audio-to-fft-bands` · Audio to FFT bands | converter | in audio-in:audio; out audio-out:audio; out low-out:control; out mid-out:control; out high-out:control; out air-out:control | {"kind": "converter", "conversion": "audio-to-fft-bands", "analysis": "fft-bands", "passThrough": true} |

## FEATURE_REGISTRY (76)

Source: [morphazoidical/feature-registry.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/morphazoidical/feature-registry.js).

| Stable feature ID / label | Group / scope | Type / units | Cadence / availability / normalization |
| --- | --- | --- | --- |
| `geometry.closed` · Closed contour | Form / geometry | boolean; unspecified/dimensionless | analysis frame; available when supplied by producer; {} |
| `geometry.perimeter` · Perimeter | Form / geometry | scalar; model-unit | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 4} |
| `geometry.samples` · Sample points | Form / geometry | scalar; count | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 128} |
| `geometry.segments` · Sampled segments | Form / geometry | scalar; count | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 128} |
| `geometry.logicalEdges` · Logical edges | Form / geometry | scalar; count | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 8} |
| `geometry.area` · Area | Form / geometry | scalar; model-unit² | analysis frame; closed contour; {"kind": "linear", "minimum": 0, "maximum": 3.141592653589793, "clamp": true} |
| `geometry.signedArea` · Signed area | Form / geometry | scalar; model-unit² | analysis frame; closed contour; {"kind": "linear", "minimum": -3.141592653589793, "maximum": 3.141592653589793, "clamp": true} |
| `geometry.orientation` · Orientation | Form / geometry | category; unspecified/dimensionless | analysis frame; available when supplied by producer; {} |
| `geometry.centroid.x` · Centroid X | Form / geometry | scalar; model-unit | analysis frame; available when supplied by producer; {"kind": "linear", "minimum": -1, "maximum": 1, "clamp": true} |
| `geometry.centroid.y` · Centroid Y | Form / geometry | scalar; model-unit | analysis frame; available when supplied by producer; {"kind": "linear", "minimum": -1, "maximum": 1, "clamp": true} |
| `geometry.bounds.width` · Bounds width | Form / geometry | scalar; model-unit | analysis frame; available when supplied by producer; {"kind": "linear", "minimum": 0, "maximum": 2, "clamp": true} |
| `geometry.bounds.height` · Bounds height | Form / geometry | scalar; model-unit | analysis frame; available when supplied by producer; {"kind": "linear", "minimum": 0, "maximum": 2, "clamp": true} |
| `geometry.compactness` · Compactness | Form / geometry | scalar; unspecified/dimensionless | analysis frame; closed, non-degenerate contour; {"kind": "linear", "minimum": 0, "maximum": 1, "clamp": true} |
| `geometry.solidity` · Solidity | Form / geometry | scalar; unspecified/dimensionless | analysis frame; simple closed contour; {"kind": "linear", "minimum": 0, "maximum": 1, "clamp": true} |
| `geometry.convexity` · Convexity | Form / geometry | scalar; unspecified/dimensionless | analysis frame; closed contour; {"kind": "linear", "minimum": 0, "maximum": 1, "clamp": true} |
| `geometry.hull.area` · Convex-hull area | Form / geometry | scalar; model-unit² | analysis frame; closed contour; {"kind": "linear", "minimum": 0, "maximum": 3.141592653589793, "clamp": true} |
| `geometry.hull.perimeter` · Convex-hull perimeter | Form / geometry | scalar; model-unit | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 4} |
| `geometry.principalAxis` · Principal axis | Form / geometry | circular; radian | analysis frame; available when supplied by producer; {"kind": "cyclic", "minimum": -1.5707963267948966, "period": 3.141592653589793} |
| `geometry.eccentricity` · Eccentricity | Form / geometry | scalar; unspecified/dimensionless | analysis frame; available when supplied by producer; {"kind": "linear", "minimum": 0, "maximum": 1, "clamp": true} |
| `geometry.radius.minimum` · Minimum radius | Center / geometry | scalar; model-unit | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 1} |
| `geometry.radius.maximum` · Maximum radius | Center / geometry | scalar; model-unit | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 1} |
| `geometry.radius.mean` · Mean radius | Center / geometry | scalar; model-unit | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 1} |
| `geometry.radius.deviation` · Radius deviation | Center / geometry | scalar; model-unit | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 1} |
| `geometry.center.inside` · Center contained | Inside / outside / geometry | boolean; unspecified/dimensionless | analysis frame; closed contour; {} |
| `geometry.center.winding` · Center winding | Inside / outside / geometry | scalar; unspecified/dimensionless | analysis frame; closed contour; {"kind": "signed-positive", "scale": 2} |
| `geometry.selfIntersections` · Self-intersections | Topology / geometry | scalar; unspecified/dimensionless | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 4} |
| `geometry.crossings` · Proper crossings | Topology / geometry | scalar; unspecified/dimensionless | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 4} |
| `geometry.touches` · Self-touches | Topology / geometry | scalar; unspecified/dimensionless | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 4} |
| `geometry.overlaps` · Overlaps | Topology / geometry | scalar; unspecified/dimensionless | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 4} |
| `contact.position.x` · Contact X | Contact / contact | scalar; model-unit | analysis frame; available when supplied by producer; {"kind": "linear", "minimum": -1, "maximum": 1, "clamp": true} |
| `contact.position.y` · Contact Y | Contact / contact | scalar; model-unit | analysis frame; available when supplied by producer; {"kind": "linear", "minimum": -1, "maximum": 1, "clamp": true} |
| `contact.bounds.x` · Contact X in bounds | Contact / contact | scalar; unspecified/dimensionless | analysis frame; available when supplied by producer; {"kind": "linear", "minimum": 0, "maximum": 1, "clamp": true} |
| `contact.bounds.y` · Contact Y in bounds | Contact / contact | scalar; unspecified/dimensionless | analysis frame; available when supplied by producer; {"kind": "linear", "minimum": 0, "maximum": 1, "clamp": true} |
| `contact.contourPhase` · Contour phase | Contact / contact | cyclic; unspecified/dimensionless | analysis frame; available when supplied by producer; {"kind": "cyclic", "minimum": 0, "period": 1} |
| `contact.contourDistance` · Contour distance | Contact / contact | scalar; model-unit | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 4} |
| `contact.segment.index` · Sampled segment index | Contact / contact | scalar; index | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 32} |
| `contact.segment.phase` · Position on sampled segment | Contact / contact | scalar; unspecified/dimensionless | analysis frame; available when supplied by producer; {"kind": "linear", "minimum": 0, "maximum": 1, "clamp": true} |
| `contact.logicalEdge.index` · Logical edge index | Edge / corner / contact | scalar; index | analysis frame; form with logical edges; {"kind": "positive", "scale": 8} |
| `contact.logicalEdge.phase` · Position on logical edge | Edge / corner / contact | scalar; unspecified/dimensionless | analysis frame; form with logical edges; {"kind": "linear", "minimum": 0, "maximum": 1, "clamp": true} |
| `contact.radius` · Center radius | Contact / contact | scalar; model-unit | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 1} |
| `contact.polarAngle` · Center angle | Center / contact | circular; radian | analysis frame; available when supplied by producer; {"kind": "cyclic", "minimum": -3.141592653589793, "period": 6.283185307179586} |
| `contact.tangentAngle` · Tangent angle | Direction / contact | circular; radian | analysis frame; available when supplied by producer; {"kind": "cyclic", "minimum": -3.141592653589793, "period": 6.283185307179586} |
| `contact.incomingAngle` · Incoming angle | Direction / contact | circular; radian | analysis frame; available when supplied by producer; {"kind": "cyclic", "minimum": -3.141592653589793, "period": 6.283185307179586} |
| `contact.outgoingAngle` · Outgoing angle | Direction / contact | circular; radian | analysis frame; available when supplied by producer; {"kind": "cyclic", "minimum": -3.141592653589793, "period": 6.283185307179586} |
| `contact.normalAngle` · Outward-normal angle | Direction / contact | circular; radian | analysis frame; closed, oriented contour; {"kind": "cyclic", "minimum": -3.141592653589793, "period": 6.283185307179586} |
| `contact.turn` · Signed local turn | Edge / corner / contact | scalar; radian | analysis frame; available when supplied by producer; {"kind": "linear", "minimum": -3.141592653589793, "maximum": 3.141592653589793, "clamp": true} |
| `contact.curvature` · Sampled curvature | Edge / corner / contact | scalar; radian/model-unit | analysis frame; available when supplied by producer; {"kind": "signed-positive", "scale": 4} |
| `contact.radialAlignment` · Radial tangent alignment | Center / contact | scalar; unspecified/dimensionless | analysis frame; available when supplied by producer; {"kind": "linear", "minimum": -1, "maximum": 1, "clamp": true} |
| `contact.centerFacing` · Outward normal vs center | Inside / outside / contact | scalar; unspecified/dimensionless | analysis frame; closed, oriented contour; {"kind": "linear", "minimum": -1, "maximum": 1, "clamp": true} |
| `contact.tangentRadiusAngle` · Tangent / radius angle | Center / contact | circular; radian | analysis frame; available when supplied by producer; {"kind": "cyclic", "minimum": -3.141592653589793, "period": 6.283185307179586} |
| `contact.corner.distance` · Nearest-corner distance | Edge / corner / contact | scalar; model-unit | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 1} |
| `contact.corner.strength` · Nearest-corner strength | Edge / corner / contact | scalar; unspecified/dimensionless | analysis frame; available when supplied by producer; {"kind": "linear", "minimum": 0, "maximum": 1, "clamp": true} |
| `contact.corner.class` · Corner class | Inside / outside / contact | category; unspecified/dimensionless | analysis frame; available when supplied by producer; {} |
| `contact.hull.class` · Hull class | Inside / outside / contact | category; unspecified/dimensionless | analysis frame; available when supplied by producer; {} |
| `contact.reader.boundaryRole` · Reader boundary role | Inside / outside / contact | category; unspecified/dimensionless | analysis frame; available when supplied by producer; {} |
| `contact.reader.rank` · Reader contact rank | Reader / contact | scalar; index | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 4} |
| `contact.reader.incidence` · Reader incidence angle | Direction / contact | scalar; radian | analysis frame; line or ray reader; {"kind": "linear", "minimum": 0, "maximum": 1.5707963267948966, "clamp": true} |
| `contact.reader.transversality` · Reader transversality | Direction / contact | scalar; unspecified/dimensionless | analysis frame; line or ray reader; {"kind": "linear", "minimum": 0, "maximum": 1, "clamp": true} |
| `contact.motion.speed` · Contact speed | Motion / contact | scalar; model-unit/second | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 1} |
| `contact.motion.contourVelocity` · Contour velocity | Motion / contact | scalar; cycle/second | analysis frame; available when supplied by producer; {"kind": "signed-positive", "scale": 1} |
| `contact.motion.age` · Contact age | Motion / contact | scalar; second | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 2} |
| `reader.contactCount` · Contact count | Reader / reader | scalar; unspecified/dimensionless | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 4} |
| `reader.insideIntervalCount` · Inside intervals | Reader / reader | scalar; unspecified/dimensionless | analysis frame; closed contour; {"kind": "positive", "scale": 4} |
| `reader.insideSpan` · Inside span | Reader / reader | scalar; model-unit | analysis frame; closed contour; {"kind": "positive", "scale": 4} |
| `reader.insideFraction` · Inside fraction | Reader / reader | scalar; unspecified/dimensionless | analysis frame; closed contour with finite reader extent; {"kind": "linear", "minimum": 0, "maximum": 1, "clamp": true} |
| `reader.spacing.minimum` · Minimum contact spacing | Reader / reader | scalar; model-unit | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 1} |
| `reader.spacing.mean` · Mean contact spacing | Reader / reader | scalar; model-unit | analysis frame; available when supplied by producer; {"kind": "positive", "scale": 1} |
| `reader.contactDelta` · Contact-count change | Motion / reader | scalar; unspecified/dimensionless | analysis frame; available when supplied by producer; {"kind": "signed-positive", "scale": 2} |
| `reader.transversality.minimum` · Minimum transversality | Reader / reader | scalar; unspecified/dimensionless | analysis frame; line or ray reader with contacts; {"kind": "linear", "minimum": 0, "maximum": 1, "clamp": true} |
| `reader.transversality.mean` · Mean transversality | Reader / reader | scalar; unspecified/dimensionless | analysis frame; line or ray reader with contacts; {"kind": "linear", "minimum": 0, "maximum": 1, "clamp": true} |
| `events.births` · Contact births | Events / event | event; unspecified/dimensionless | event edge; available when supplied by producer; {"kind": "positive", "scale": 4} |
| `events.deaths` · Contact deaths | Events / event | event; unspecified/dimensionless | event edge; available when supplied by producer; {"kind": "positive", "scale": 4} |
| `events.splits` · Contact splits | Events / event | event; unspecified/dimensionless | event edge; structural or swept tracker; {"kind": "positive", "scale": 4} |
| `events.merges` · Contact merges | Events / event | event; unspecified/dimensionless | event edge; structural or swept tracker; {"kind": "positive", "scale": 4} |
| `events.entries` · Reader entries | Events / event | event; unspecified/dimensionless | event edge; available when supplied by producer; {"kind": "positive", "scale": 4} |
| `events.exits` · Reader exits | Events / event | event; unspecified/dimensionless | event edge; available when supplied by producer; {"kind": "positive", "scale": 4} |

## TOPOLOGIES (6)

Source: [src/breath-atlas.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/breath-atlas.js).

| Source ID / name | Topology / value | Source implementation note |
| --- | --- | --- |
| `stringWind` · string-wind | signed lung pressure → quill valve → tensioned string → mouth cavity |  |
| `freeReed` · free-reed bank | signed lung pressure → free reed → pipe resonators → mouth / chamber |  |
| `lipReed` · lip-reed bore | exhaled pressure → lip valve → air column → vocal tract impedance |  |
| `edgeTone` · edge-tone flute | exhaled pressure → air jet → edge oscillation → pipe / vessel |  |
| `mouthBow` · mouth-resonated string | hand gesture → tensioned string → bridge / coupling cord → mouth cavity |  |
| `jawReed` · plucked mouth reed | finger pluck → lamella → signed breath load → mouth cavity |  |

## BREATH_INSTRUMENTS (19)

Source: [src/breath-atlas.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/breath-atlas.js).

| Source ID / name | Topology / value | Source implementation note |
| --- | --- | --- |
| `lesiba` · Lesiba / gora | stringWind | Signed Bernoulli-style quill forcing drives a lossy harmonic string. Inhalation and exhalation use different quill phase and spectral loading. |
| `harmonica` · Harmonica | freeReed | Pressure-controlled reed oscillators use a nonlinear opening/flow curve and direction-dependent reed banks. |
| `khaen` · Khaen | freeReed | Bidirectional reed valves feed a multi-pipe modal bank; breath direction changes attack and spectral balance without stopping the chord. |
| `sheng` · Sheng | freeReed | A bidirectional free-reed bank is coupled to pipe modes; chamber and mouth impedances color the radiated chord. |
| `sho` · Shō | freeReed | Long-attack bidirectional reeds excite a bright, tightly spaced pipe cluster; direction alters the transient more than pitch. |
| `hulusi` · Hulusi | freeReed | An outward-pressure reed valve feeds one fingered pipe and two weak drone resonances through a shared chamber. |
| `bawu` · Bawu | freeReed | One outward-driven reed is impedance-locked to a lossy pipe mode and colored by the mouth cavity upstream. |
| `didgeridoo` · Didgeridoo / yidaki | lipReed | A pressure-driven lip valve feeds odd bore modes; movable vocal-tract impedance notches and glottal pulses reshape the drone. |
| `pungi` · Pungi / been | freeReed | A smoothed reservoir pressure drives paired beating reeds, one fingered and one droning, through gourd resonances. |
| `nose-flute` · Nose flute | edgeTone | Jet-delay oscillation is approximated by a noisy edge-tone source locked to pipe modes; only exhalation excites it. |
| `overtone-flute` · Overtone flute | edgeTone | Jet speed moves the strongest coupling window upward through a harmonic pipe bank, producing pressure-selected registers. |
| `ukeke` · ʻUkeke | mouthBow | A plucked modal string bank decays independently; signed breath changes acoustic loading and turbulence, not the initial excitation. |
| `umrhubhe` · Umrhubhe | mouthBow | Stick-slip forcing sustains a string modal bank; the mouth resonator supplies the strongest audible spectral movement. |
| `lunku` · Lunku mouth bow | mouthBow | A short pluck excites string modes; jaw, tongue, and lip controls move the radiating formants. |
| `berimbau-mouth` · Berimbau-de-boca | mouthBow | Plucked string modes feed a vowel-like impedance filter; breath adds load and aspiration but does not replace the pluck. |
| `kni` · K’ni | mouthBow | Bowed stick-slip energy sustains string modes and a coupling cord injects them into movable oral formants. |
| `makomako` · Makomako jaw harp | jawReed | A plucked lamella supplies the initial energy and signed pressure sustains, bends, and redistributes its harmonic modes. |
| `mukkuri` · Mukkuri | jawReed | A plucked bamboo lamella is pressure-loaded in both directions and radiated through a movable three-formant cavity. |
| `dan-moi` · Đàn môi | jawReed | A bright plucked lamella receives bidirectional aerodynamic sustain and close-coupled vocal-tract filtering. |

## SYRINX_SOURCE_MODEL_IDS (4)

Source: [src/syrinx-source-models.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/syrinx-source-models.js).

| Source ID / name | Topology / value | Source implementation note |
| --- | --- | --- |
| `TWO_MASS` ·  | twoMass |  |
| `SYRINX` ·  | syrinx |  |
| `FROG` ·  | frog |  |
| `WHISTLE` ·  | whistle |  |

## ACOUSTIC_PROFILES (68)

Source: [src/acoustic-profiles.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/acoustic-profiles.js).

Profiles choose analysis ranges, segmentation and a synthesis strategy. They do not identify species or recover anatomy. Multiple profiles share the same neutral descriptor renderer.

| Profile ID / label | Group | Analysis band / segmentation | Resynthesis strategy |
| --- | --- | --- | --- |
| `general` · General sound events | General | 60–11000 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `songbird` · Nightingale / songbird strophes | Birds | 250–11000 Hz; pause-bounded | songbird; Reduced syrinx trajectory sketch |
| `passerine-window` · Passerine survey · 3 s windows | Birds | 150–15000 Hz; fixed-window | neutral; Neutral modal descriptor sonification |
| `bird-syllable` · Bird syllables | Birds | 500–15000 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `bird-flight-call` · Nocturnal bird flight calls | Birds | 1000–11000 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `owl-hoot` · Forest owl hoots | Birds | 60–1200 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `woodpecker-drum` · Woodpecker drum rolls | Birds | 100–12000 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `wolf-howl` · Wolf solo howls | Terrestrial mammals | 100–2500 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `wolf-chorus` · Wolf chorus · 5 s windows | Terrestrial mammals | 200–2500 Hz; fixed-window | neutral; Neutral modal descriptor sonification |
| `coyote-howl` · Coyote solo howls | Terrestrial mammals | 100–4000 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `coyote-group-yip-howl` · Coyote group yip-howls · 5 s windows | Terrestrial mammals | 150–6000 Hz; fixed-window | neutral; Neutral modal descriptor sonification |
| `elephant-rumble` · Elephant infrasonic rumbles | Terrestrial mammals | 8–250 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `marmoset-call` · Common marmoset calls | Terrestrial mammals | 3000–20000 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `gibbon-phrase` · Gibbon song phrases | Terrestrial mammals | 400–2000 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `chimp-hoot` · Chimpanzee hoots | Terrestrial mammals | 120–1000 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `chimp-scream` · Chimpanzee screams | Terrestrial mammals | 600–2500 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `forest-monkey-loud-call` · Low forest-monkey loud calls | Terrestrial mammals | 20–1000 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `frog` · General frog calls | Amphibians | 300–8000 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `boreal-chorus-frog` · Boreal chorus frog · 2 s windows | Amphibians | 1000–3300 Hz; fixed-window | neutral; Neutral modal descriptor sonification |
| `harlequin-frog` · Harlequin frog pulsed calls | Amphibians | 1500–2500 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `glassfrog-note` · Glassfrog notes | Amphibians | 2500–8000 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `insect` · Cricket / insect chirps | Insects | 700–11000 Hz; pause-bounded | cricket; Reduced two-wing stridulation sketch |
| `gryllus-calling` · Gryllus calling chirps | Insects | 3500–6000 Hz; pause-bounded | cricket; Reduced two-wing stridulation sketch |
| `fall-field-cricket` · Fall field-cricket chirps | Insects | 4000–5500 Hz; pause-bounded | cricket; Reduced two-wing stridulation sketch |
| `cicada-echeme` · Cicada echemes | Insects | 5000–13000 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `new-forest-cicada` · New Forest cicada · 30 s windows | Insects | 12500–15500 Hz; fixed-window | neutral; Neutral modal descriptor sonification |
| `okanagana-cicada` · Okanagana cicada trains | Insects | 6000–12000 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `mosquito-flight` · Mosquito flight traces · 1.2 s | Insects | 150–2000 Hz; fixed-window | neutral; Neutral modal descriptor sonification |
| `bee-flight` · Bee flight bouts | Insects | 80–1000 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `pollination-buzz` · Bee pollination buzzes | Insects | 80–1500 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `bat-echolocation` · Bat FM echolocation pulses | Ultrasound | 15000–130000 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `mouse-usv` · Mouse ultrasonic syllables | Ultrasound | 25000–110000 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `rat-22k` · Rat 22 kHz calls | Ultrasound | 18000–32000 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `rat-50k` · Rat 50 kHz calls | Ultrasound | 35000–80000 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `marine` · General marine phrases | Marine · tonal calls | 20–5000 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `right-whale-upcall` · North Atlantic right-whale upcalls | Marine · tonal calls | 40–400 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `sei-whale-downsweep` · Sei-whale downsweeps | Marine · tonal calls | 20–120 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `fin-whale-20hz` · Fin-whale 20 Hz pulses | Marine · tonal calls | 10–40 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `fin-whale-40hz` · Fin-whale 40 Hz calls | Marine · tonal calls | 35–100 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `blue-whale-tonal` · Blue-whale low tonal calls | Marine · tonal calls | 10–80 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `minke-bioduck` · Antarctic minke bio-duck series | Marine · tonal calls | 40–1200 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `minke-boing` · North Pacific minke boings | Marine · tonal calls | 500–4000 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `humpback-social` · Humpback social calls | Marine · tonal calls | 40–12000 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `dolphin-whistle` · General delphinid whistles | Marine · odontocetes | 1000–40000 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `beluga-whistle` · Beluga whistles | Marine · odontocetes | 300–30000 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `killer-whale-hf-call` · Killer-whale high-frequency calls | Marine · odontocetes | 15000–50000 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `killer-whale-call` · Killer-whale audible calls and whistles | Marine · odontocetes | 500–25000 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `delphinid-burst-pulse` · Delphinid burst-pulse trains | Marine · odontocetes | 1000–55000 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `delphinid-click` · Broadband delphinid clicks | Marine · odontocetes | 20000–200000 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `harbor-porpoise-click` · Harbor-porpoise NBHF clicks | Marine · odontocetes | 100000–180000 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `beaked-whale-click` · Beaked-whale FM clicks | Marine · odontocetes | 10000–90000 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `kogia-click` · Kogia NBHF clicks | Marine · odontocetes | 60000–180000 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `sperm-whale-click-train` · Sperm-whale foraging click trains | Marine · odontocetes | 2000–40000 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `sperm-whale-coda` · Sperm-whale codas | Marine · odontocetes | 2000–30000 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `fish-pulse` · General fish pulse calls | Marine · fish and invertebrates | 20–4000 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `cod-grunt` · Atlantic cod grunts | Marine · fish and invertebrates | 20–500 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `hardhead-catfish-knock` · Hardhead catfish knocks | Marine · fish and invertebrates | 500–1400 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `silver-perch-knock` · Silver-perch knocks | Marine · fish and invertebrates | 400–1400 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `atlantic-croaker-knock` · Atlantic-croaker knocks | Marine · fish and invertebrates | 700–1500 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `seatrout-grunt` · Spotted-seatrout grunts | Marine · fish and invertebrates | 150–800 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `seatrout-purr` · Spotted-seatrout purrs | Marine · fish and invertebrates | 150–800 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `toadfish-boatwhistle` · Gulf-toadfish boatwhistles | Marine · fish and invertebrates | 150–1000 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `black-drum-croak` · Black-drum croaks | Marine · fish and invertebrates | 100–600 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `fish-chorus-window` · Fish chorus · 60 s windows | Marine · fish and invertebrates | 20–3500 Hz; fixed-window | neutral; Neutral modal descriptor sonification |
| `snapping-shrimp` · Snapping-shrimp snaps | Marine · fish and invertebrates | 1500–200000 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `mantis-shrimp-rumble` · Mantis-shrimp rumbles | Marine · fish and invertebrates | 20–500 Hz; pause-bounded | neutral; Audible frequency-scaled descriptor sonification |
| `dugong-call` · Dugong chirps and trills | Marine · other mammals | 500–12000 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |
| `pinniped-call` · Pinniped calls and trills | Marine · other mammals | 30–20000 Hz; pause-bounded | neutral; Neutral modal descriptor sonification |

## WEBGPU_DSP_PRIMITIVES (145)

Source: [src/webgpu-dsp-primitives.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/webgpu-dsp-primitives.js).

Source status labels describe the original reference. The coverage column distinguishes playable modules from infrastructure/workflow items.

| Reference ID / name | Category / source status | Execution / significance | Playground coverage |
| --- | --- | --- | --- |
| `swing-time` · Swing clock warp | control; live | Per sample · stateless; Alternates long and short sequencer steps while keeping each two-step pair on the same overall clock. | {"id": "swing-time", "kind": "playable", "moduleId": "clock", "label": "Clock phase", "mode": "Swing"} |
| `lane-value` · Sequence lane lookup | control; live | Per sample · storage read; Reads one normalized control cell from the 64-step × 8-lane score buffer. | {"id": "lane-value", "kind": "playable", "moduleId": "sequence-lane", "label": "Sequence Lane", "mode": "Lane lookup"} |
| `sequence-step-at` · Step index | control; live | Per sample · stateless; Turns absolute seconds into the current looped sequencer step after swing. | {"id": "sequence-step-at", "kind": "playable", "moduleId": "sequence-lane", "label": "Sequence Lane", "mode": "Step addressing"} |
| `routed-unit` · Normalized lane routing | control; live | Per sample · up to 6 lane reads; Interpolates a routed lane between steps and blends it into a normalized 0–1 synth parameter. | {"id": "routed-unit", "kind": "playable", "moduleId": "normalized-route", "label": "Normalized Route", "mode": ""} |
| `routed-range` · Unit-to-physical mapping | control; live | Per sample · lane reads; Maps a 0–1 modulation lane into seconds, hertz, drive, gain, or another physical range. | {"id": "routed-range", "kind": "playable", "moduleId": "linear-range-map", "label": "Linear Range Map", "mode": ""} |
| `mode-degree` · Scale-degree lookup | control; live | Per sample · branch / switch; Returns a semitone interval for Dorian, Phrygian, or harmonic-minor scale degrees. | {"id": "mode-degree", "kind": "playable", "moduleId": "gpu-arp", "label": "GPU Arpeggiator", "mode": "Scale degrees"} |
| `scale-note` · Pitch quantizer | control; live | Per sample · stateless; Quantizes a normalized lane into a semitone offset in one of six tuning maps. | {"id": "scale-note", "kind": "playable", "moduleId": "gpu-arp", "label": "GPU Arpeggiator", "mode": "Pitch quantizer"} |
| `midi-frequency` · MIDI to frequency | control; live | Per sample · transcendental math; Converts note numbers—including fractional notes—into oscillator frequency in hertz. | {"id": "midi-frequency", "kind": "playable", "moduleId": "oscillator", "label": "Oscillator", "mode": "MIDI pitch conversion"} |
| `smootherstep` · Quintic smoothing | control; live | Per sample · stateless; Makes a click-resistant 0→1 transition with zero slope and curvature at both ends. | {"id": "smootherstep", "kind": "playable", "moduleId": "contour", "label": "Event contour", "mode": "Smooth edges"} |
| `hash-noise` · Deterministic hash noise | source; live | Per sample · stateless hash; Produces repeatable pseudo-random values for noise, jitter, modal scatter, grain position, and reverb taps. | {"id": "hash-noise", "kind": "playable", "moduleId": "noise", "label": "Hash noise", "mode": ""} |
| `soft-clip` · Rational soft clip | shaping; live | Per sample · stereo vector math; Compresses peaks smoothly toward ±1, adding harmonics without a hard digital corner. | {"id": "soft-clip", "kind": "playable", "moduleId": "softclip", "label": "Soft clip", "mode": ""} |
| `spectral-acid` · Spectral Acid | synthesis; live | Per sample · partial-parallel loop; Builds an acid-like tone from 1–48 harmonics under a moving spectral cutoff and resonance peak. | {"id": "spectral-acid", "kind": "playable", "moduleId": "spectral-acid", "label": "Spectral Acid", "mode": ""} |
| `classic-fm` · Classic FM / PM network | modulation; live | Per sample · 1–6 logical operators; Creates sideband-rich tones with nested sine phase offsets, a second carrier, and an optional sub oscillator. | {"id": "classic-fm", "kind": "playable", "moduleId": "fm", "label": "FM / PM voice", "mode": ""} |
| `wavefold-table` · Wavefold Table | synthesis; live | Per sample · layer loop; Scans analytic sine→triangle→saw shapes, detunes 1–8 layers, then folds them through a sine. | {"id": "wavefold-table", "kind": "playable", "moduleId": "wavefold-table-oscillator", "label": "Wavefold Table Oscillator", "mode": ""} |
| `modal-metal` · Modal Metal | synthesis; live | Per sample · modal loop; Sums 1–32 slightly scattered, inharmonic sine modes with independent onset and damping. | {"id": "modal-metal", "kind": "playable", "moduleId": "modal-metal", "label": "Modal Metal", "mode": ""} |
| `particle-cloud` · Particle Cloud | synthesis; live | Per sample · grain loop; Layers 1–16 windowed, detuned oscillator particles with held hash grit and seeded stereo positions. | {"id": "particle-cloud", "kind": "playable", "moduleId": "particle-cloud", "label": "Particle Cloud", "mode": ""} |
| `additive-organ` · Additive Organ | synthesis; live | Per sample · rank loop + buffer reads; Sums nine editable drawbar-like ranks, each with its own ratio, level, AM rate, and AM depth. | {"id": "additive-organ", "kind": "playable", "moduleId": "additive-drawbar-organ", "label": "Additive Drawbar Organ", "mode": ""} |
| `vector-wavetable` · Vector Wavetable | synthesis; live | Per sample · harmonic loop; Reconstructs sine, triangle, and saw spectra from up to 64 harmonics, then morphs between them. | {"id": "vector-wavetable", "kind": "playable", "moduleId": "vector-wavetable", "label": "Vector Wavetable", "mode": ""} |
| `formant-bank` · Formant Bank | synthesis; live | Per sample · harmonic loop; Weights 1–12 source harmonics with three moving Gaussian peaks to suggest vowel-like spectra. | {"id": "formant-bank", "kind": "playable", "moduleId": "formant-bank", "label": "Formant Bank", "mode": ""} |
| `synth-model` · Model dispatch | composition; live | Per sample · switch; Selects one of the eight synthesis algorithms for a layer. | {"id": "synth-model", "kind": "infrastructure", "featureId": "sample-graph-dispatch", "label": "Sample-graph model dispatch", "mode": ""} |
| `render-layer` · Layer renderer | composition; live | Per sample · model call; Renders one model and applies its semitone detune, level, and stereo pan. | {"id": "render-layer", "kind": "infrastructure", "featureId": "sample-graph-dispatch", "label": "Sample-graph layer renderer", "mode": ""} |
| `layered-sound` · Stack / equal-power morph | composition; live | Per sample · up to 6 model calls; Either sums up to six layers with level normalization or crossfades adjacent layers at near-constant power. | {"id": "layered-sound", "kind": "playable", "moduleId": "morph-crossfade", "label": "Morph Crossfade", "mode": "Equal-power layer morph"} |
| `dry-sound` · Dry signal graph | composition; live | Per sample · complete voice graph; Composes clock, pitch, glide, click-safe envelope, routed macros, layered synthesis, orbit pan, drive, and limiting. | {"id": "dry-sound", "kind": "workflow", "featureId": "modular-patch-graph", "label": "Modular patch graph", "mode": ""} |
| `history-at` · Circular history read | space; live | Per sample · random storage read; Reads an earlier stereo sample from the persistent eight-second ring buffer. | {"id": "history-at", "kind": "infrastructure", "featureId": "gpu-history-ring", "label": "GPU audio-history ring", "mode": ""} |
| `sinc-lowpass` · Windowed-sinc FIR low-pass | filter; live | Per sample · 1–31 history taps; Removes frequencies above the cutoff with a finite, causal, Hann-windowed impulse response. | {"id": "sinc-lowpass", "kind": "playable", "moduleId": "fir-lowpass", "label": "FIR Low-pass", "mode": ""} |
| `multi-tap-delay` · Feed-forward multi-tap delay | space; live | Per sample · 1–4 history taps; Adds one to four decaying echoes with odd taps swapped left-to-right. | {"id": "multi-tap-delay", "kind": "playable", "moduleId": "delay", "label": "Simple Delay", "mode": "Feed-forward taps"} |
| `post-waveshaper` · Clip / fold waveshaper | shaping; live | Per sample · stereo vector math; Drives the signal, then morphs from rational soft clipping into repeated sine folding. | {"id": "post-waveshaper", "kind": "playable", "moduleId": "fold", "label": "Wavefolder", "mode": "Clip / fold"} |
| `convolution-reverb` · Sparse convolution reverb | space; live | Per sample · 4–64 history taps; Sums 4–64 scattered, decaying history reads into a stereo reflection cloud. | {"id": "convolution-reverb", "kind": "playable", "moduleId": "convolution-space", "label": "Convolution Space", "mode": "Sparse reflections"} |
| `synthesize-dry` · Dry compute pass | architecture; live | Pass 1 · sample-parallel writes; Renders one stereo sample per invocation, writes the dry chunk, and records it in persistent history. | {"id": "synthesize-dry", "kind": "infrastructure", "featureId": "sample-compute-pass", "label": "Sample-parallel graph pass", "mode": ""} |
| `process-fx` · Effects compute pass | architecture; live | Pass 2 · sample-parallel history reads; Applies routed FIR filtering, feed-forward delay, waveshaping, sparse reverb, and a final safety limit. | {"id": "process-fx", "kind": "infrastructure", "featureId": "ordered-effects-pass", "label": "Ordered GPU effects pass", "mode": ""} |
| `sample-clock` · Sample-accurate clock | control; direct | Per sample · stateless; Gives every output sample an absolute time in seconds—the common coordinate for oscillators, envelopes, and modulation. | {"id": "sample-clock", "kind": "playable", "moduleId": "clock", "label": "Clock phase", "mode": "Sample clock"} |
| `phase-oscillator` · Phase + basic oscillators | source; direct | Per sample · stateless; Turns a cyclic 0–1 phase into sine, triangle, or saw waveforms. | {"id": "phase-oscillator", "kind": "playable", "moduleId": "oscillator", "label": "Oscillator", "mode": "Sine / triangle / saw"} |
| `pulse-oscillator` · Pulse / comparator | source; direct | Per sample · stateless branch; Creates a square or variable-width pulse; at control rate it becomes a gate and rhythmic mask. | {"id": "pulse-oscillator", "kind": "playable", "moduleId": "oscillator", "label": "Oscillator", "mode": "Pulse"} |
| `ring-modulation` · Ring modulation | modulation; direct | Per sample · one multiply; Replaces the original pitches with sum-and-difference sidebands, often producing bells, clangs, and shifting beating. | {"id": "ring-modulation", "kind": "playable", "moduleId": "ring", "label": "Ring modulator", "mode": ""} |
| `tremolo` · Amplitude modulation / tremolo | modulation; direct | Per sample · stateless; Moves loudness periodically; slow rates pulse, while audio rates create AM sidebands. | {"id": "tremolo", "kind": "playable", "moduleId": "am-tremolo", "label": "AM / Tremolo", "mode": "Unipolar"} |
| `hard-sync` · Hard oscillator sync | modulation; direct | Per sample · stateless phase mapping; Forces one oscillator cycle structure to restart with another, producing swept, cutting upper harmonics. | {"id": "hard-sync", "kind": "playable", "moduleId": "hard-sync", "label": "Hard Sync", "mode": ""} |
| `sample-hold` · Sample + hold | modulation; direct | Per sample · stateless hash; Produces random plateaus at a chosen update rate for stepped pitch, timbre, pan, or grain control. | {"id": "sample-hold", "kind": "playable", "moduleId": "sample-hold", "label": "Sample + Hold", "mode": ""} |
| `bit-crush` · Amplitude quantizer / bit crush | shaping; direct | Per sample · stateless; Reduces amplitude resolution into audible steps, adding digital grit and inharmonic error. | {"id": "bit-crush", "kind": "playable", "moduleId": "quantize", "label": "Amplitude quantizer", "mode": ""} |
| `equal-power-pan` · Equal-power stereo pan | composition; direct | Per sample · stereo vector math; Places a mono source across stereo while keeping perceived power steadier near the center. | {"id": "equal-power-pan", "kind": "playable", "moduleId": "pan", "label": "Equal-power pan", "mode": ""} |
| `fir-highpass` · FIR high-pass by subtraction | filter; direct | Per sample · FIR history reads; Keeps the spectral material above the cutoff by subtracting a time-aligned low-pass result. | {"id": "fir-highpass", "kind": "playable", "moduleId": "fir-highpass", "label": "FIR High-pass", "mode": ""} |
| `fir-bandpass` · FIR band-pass by difference | filter; direct | Per sample · two FIR sums; Isolates a frequency band between two cutoffs. | {"id": "fir-bandpass", "kind": "playable", "moduleId": "fir-bandpass", "label": "FIR Band-pass", "mode": ""} |
| `wavetable-lookup` · Uploaded wavetable lookup | source; direct | Per sample · 2 storage reads; Reads an arbitrary periodic shape from a storage buffer and interpolates between samples. | {"id": "wavetable-lookup", "kind": "playable", "moduleId": "uploaded-wavetable", "label": "Uploaded Wavetable", "mode": "Interpolated lookup"} |
| `trigger-impulse` · Trigger / unit impulse | control; direct | Per sample · integer comparison; Marks one exact sample as an excitation: the smallest possible click, drum trigger, convolution probe, or resonator strike. | {"id": "trigger-impulse", "kind": "playable", "moduleId": "trigger-impulse", "label": "Trigger / Impulse", "mode": ""} |
| `exponential-envelope` · Exponential decay envelope | control; direct | Per sample · stateless exponential; Produces the fast attack and curved energy loss associated with plucks, struck objects, and electronic percussion. | {"id": "exponential-envelope", "kind": "playable", "moduleId": "contour", "label": "Event contour", "mode": "Exponential decay"} |
| `segment-adsr` · Segment / ADSR envelope | control; direct | Per sample · piecewise stateless math; Shapes a note through attack, decay, sustain, and release, or through any sequence of breakpoint segments. | {"id": "segment-adsr", "kind": "playable", "moduleId": "segment-adsr", "label": "Segment ADSR", "mode": ""} |
| `grain-window` · Hann / Gaussian grain window | control; direct | Per sample · stateless window; Fades both ends of a short event so grains, loops, and model changes splice without clicks. | {"id": "grain-window", "kind": "playable", "moduleId": "grain-window", "label": "Grain Window", "mode": ""} |
| `bitmask-sequencer` · Bitmask rhythm sequencer | control; direct | Per sample · integer bit operations; Stores a 32-step gate pattern inside one integer and reveals one rhythmic bit at a time. | {"id": "bitmask-sequencer", "kind": "playable", "moduleId": "bitmask-rhythm", "label": "Bitmask Rhythm", "mode": ""} |
| `interpolated-value-noise` · Interpolated value noise | modulation; direct | Per sample · 2 hashes + interpolation; Turns discrete seeded randomness into continuous wandering control or smooth procedural noise. | {"id": "interpolated-value-noise", "kind": "playable", "moduleId": "noise", "label": "Hash noise", "mode": "Smoothed value noise"} |
| `chirp-oscillator` · Chirp / swept oscillator | source; direct | Per sample · analytic phase; Sweeps frequency continuously; short downward curves make kicks and impacts, while long sweeps scan resonances. | {"id": "chirp-oscillator", "kind": "playable", "moduleId": "chirp-sweep", "label": "Analytic Chirp Sweep", "mode": ""} |
| `supersaw-unison` · Unison / supersaw bank | synthesis; direct | Per sample · parallelizable voice loop; Stacks many slightly detuned oscillators into a wide, beating, high-energy source. | {"id": "supersaw-unison", "kind": "playable", "moduleId": "supersaw", "label": "Supersaw Unison", "mode": ""} |
| `analytic-plucked-string` · Analytic plucked-string series | synthesis; direct | Per sample · finite harmonic/modal sum; Models a plucked string as damped modes whose amplitudes depend on pluck position and whose frequencies bend with stiffness. | {"id": "analytic-plucked-string", "kind": "playable", "moduleId": "analytic-plucked-string", "label": "Analytic Plucked String", "mode": ""} |
| `phase-distortion` · Phase-distortion oscillator | synthesis; direct | Per sample · piecewise phase map; Bends oscillator phase before waveform lookup, changing harmonic content while keeping the fundamental cycle locked. | {"id": "phase-distortion", "kind": "playable", "moduleId": "phase-distortion", "label": "Phase Distortion", "mode": ""} |
| `wave-terrain` · Wave-terrain scan | synthesis; direct | Per sample · texture/buffer lookup; Moves a periodic orbit across a 2D height field and interprets the sampled elevation as a waveform. | {"id": "wave-terrain", "kind": "playable", "moduleId": "wave-terrain", "label": "Analytic Wave Terrain", "mode": ""} |
| `bytebeat-source` · Bytebeat / integer formula | source; direct | Per sample · u32 arithmetic; Turns integer overflow, shifts, masks, and bitwise logic into self-organizing lo-fi melody and rhythm. | {"id": "bytebeat-source", "kind": "playable", "moduleId": "bytebeat", "label": "Bytebeat", "mode": ""} |
| `fractal-recurrence` · Fixed-iteration chaotic recurrence | synthesis; direct | Per sample · fixed loop · stateless; Maps a bounded nonlinear recurrence into brittle tones, squelches, discontinuities, and deterministic pseudo-chaos. | {"id": "fractal-recurrence", "kind": "playable", "moduleId": "fractal-recurrence", "label": "Fractal Recurrence", "mode": ""} |
| `procedural-kick` · Procedural kick drum | synthesis; direct | Per sample · analytic envelope + phase; Combines a rapidly falling oscillator pitch with a slower amplitude decay to create a kick-like impact and body. | {"id": "procedural-kick", "kind": "playable", "moduleId": "procedural-kick", "label": "Procedural Kick", "mode": ""} |
| `procedural-snare` · Procedural snare drum | synthesis; direct | Per sample · hash/noise + envelopes; Layers a short noisy shell or wire burst over a lower decaying tonal body. | {"id": "procedural-snare", "kind": "playable", "moduleId": "procedural-snare", "label": "Procedural Snare", "mode": ""} |
| `metallic-hi-hat` · Metallic hi-hat / cymbal bank | synthesis; direct | Per sample · small oscillator bank; Uses inharmonic pulse or sine components, high-frequency emphasis, and a short decay to suggest metal plates and hats. | {"id": "metallic-hi-hat", "kind": "playable", "moduleId": "metallic-hi-hat", "label": "Metallic Hi-hat", "mode": ""} |
| `clap-burst` · Clap burst train | synthesis; direct | Per sample · noise + window sum; Shapes filtered noise into several closely spaced attacks followed by an optional diffuse tail. | {"id": "clap-burst", "kind": "playable", "moduleId": "clap-burst", "label": "Clap Burst", "mode": ""} |
| `sample-buffer-playback` · Sample playback + interpolation | source; direct | Per sample · 2 storage reads; Reads recorded audio at a movable rate; negative or wrapped playheads enable reverse, loop, and scrubbing behaviors. | {"id": "sample-buffer-playback", "kind": "playable", "moduleId": "gpu-sampler-granulator", "label": "GPU Sampler / Granulator", "mode": "Sample playback"} |
| `granular-sample-cloud` · Sample-granular cloud | synthesis; direct | Per sample · bounded random buffer gathers; Overlaps many short, independently positioned sample fragments into clouds, freezes, swarms, and time-stretched textures. | {"id": "granular-sample-cloud", "kind": "playable", "moduleId": "gpu-sampler-granulator", "label": "GPU Sampler / Granulator", "mode": "Grain cloud"} |
| `fof-formant-grain` · FOF / formant grain | synthesis; direct | Per sample · analytic grain bank; A short exponentially damped sinusoidal grain that becomes a vowel-like formant when repeated at a pitched rate. | {"id": "fof-formant-grain", "kind": "playable", "moduleId": "fof-voice", "label": "FOF Formant Voice", "mode": ""} |
| `sample-rate-reducer` · Sample-rate reducer | shaping; direct | Per sample · indexed history read; Holds samples for several output frames, producing images, stepped transients, and clocked digital roughness. | {"id": "sample-rate-reducer", "kind": "playable", "moduleId": "sample-rate-reducer", "label": "Sample-rate Reducer", "mode": ""} |
| `polynomial-waveshaper` · Polynomial / Chebyshev shaper | shaping; direct | Per sample · fused multiply-add friendly; Maps amplitude through a polynomial; Chebyshev terms can emphasize chosen harmonics for a sine input. | {"id": "polynomial-waveshaper", "kind": "playable", "moduleId": "chebyshev", "label": "Polynomial / Chebyshev shaper", "mode": ""} |
| `full-wave-rectifier` · Rectification / frequency doubling | shaping; direct | Per sample · absolute value; Folds negative waveform halves upward, strongly emphasizing even harmonics and doubling a sine's apparent cycle rate. | {"id": "full-wave-rectifier", "kind": "playable", "moduleId": "full-wave-rectifier", "label": "Full-wave Rectifier", "mode": ""} |
| `constant-power-crossfade` · Constant-power crossfade | composition; direct | Per sample · vector-friendly mix; Moves between two signals with steadier energy than a linear fade when the sources are uncorrelated. | {"id": "constant-power-crossfade", "kind": "playable", "moduleId": "morph-crossfade", "label": "Morph Crossfade", "mode": ""} |
| `mid-side-matrix` · Mid / side matrix | composition; direct | Per sample · stereo matrix; Separates the stereo center from the difference signal so width and spatial processing can be controlled independently. | {"id": "mid-side-matrix", "kind": "playable", "moduleId": "mid-side-width", "label": "Mid / Side Width", "mode": ""} |
| `fractional-delay-read` · Fractional delay interpolation | space; direct | Per sample · 2 history reads; Reads between stored samples so delay time, pitch-like comb spacing, and moving spatial cues can vary smoothly. | {"id": "fractional-delay-read", "kind": "playable", "moduleId": "delay", "label": "Simple Delay", "mode": "Fractional history read"} |
| `chorus-flanger` · Feed-forward chorus / flanger | space; direct | Per sample · history gather · no recursion; Mixes a signal with a slowly moving short delay, creating detuned doubles, comb motion, and ensemble width. | {"id": "chorus-flanger", "kind": "playable", "moduleId": "chorus", "label": "Chorus", "mode": "Modulated delay"} |
| `doppler-delay` · Doppler / moving delay read | space; direct | Per sample · position math + history gather; Turns changing source distance into a variable propagation delay, producing natural pitch shift and motion cues. | {"id": "doppler-delay", "kind": "playable", "moduleId": "doppler-sweep", "label": "Doppler Sweep", "mode": ""} |
| `parallel-voice-bank` · Bounded polyphonic voice bank | composition; direct | Per sample · bounded voice loop; Renders many notes, partial groups, or events into one sample while keeping their control records in GPU buffers. | {"id": "parallel-voice-bank", "kind": "playable", "moduleId": "parallel-voice-bank", "label": "Parallel Voice Bank", "mode": ""} |
| `ambisonic-encode` · First-order ambisonic encode | composition; direct | Per sample · 4-channel vector math; Represents one mono source as an omnidirectional component plus three directional components for later spatial decoding. | {"id": "ambisonic-encode", "kind": "playable", "moduleId": "spatializer", "label": "Directional Spatializer", "mode": "FOA-style field approximation"} |
| `polyblep-oscillator` · PolyBLEP / polynomial edge correction | source; direct | Per sample · local edge correction; Cancels much of the aliasing around saw, pulse, and hard-sync discontinuities with a short polynomial correction. | {"id": "polyblep-oscillator", "kind": "playable", "moduleId": "oscillator", "label": "Oscillator", "mode": "PolyBLEP edge correction"} |
| `log-parameter-map` · Log-frequency parameter map | control; direct | Per sample/control · exponential map; Maps a normalized control evenly across octaves rather than spending most of its travel on the top of a hertz range. | {"id": "log-parameter-map", "kind": "playable", "moduleId": "log-parameter-map", "label": "Log Range Mapper", "mode": ""} |
| `event-relative-envelope` · Event-relative AR / release guard | control; direct | Per sample · event-time arithmetic; Gives every irregular trigger a click-safe onset, decay, and pre-emptive release before the following event. | {"id": "event-relative-envelope", "kind": "playable", "moduleId": "segment-adsr", "label": "Segment ADSR", "mode": "Event-relative release guard"} |
| `euclidean-rhythm` · Euclidean rhythm predicate | control; direct | Per sample · integer modulo; Distributes a chosen number of onsets as evenly as possible across a repeating number of steps. | {"id": "euclidean-rhythm", "kind": "playable", "moduleId": "euclidean-gate", "label": "Euclidean Gate", "mode": ""} |
| `analytic-pitch-glide` · Phase-correct exponential pitch glide | modulation; direct | Per sample · analytic phase integral; Glides linearly in octaves or semitones while keeping oscillator phase continuous and instantaneous pitch correct. | {"id": "analytic-pitch-glide", "kind": "playable", "moduleId": "analytic-glide-oscillator", "label": "Analytic Glide Oscillator", "mode": ""} |
| `cheap-filtered-wave` · Rounded saw / square edge | source; direct | Per sample · analytic waveform; Rounds a waveform discontinuity into a one-knob family that sounds progressively softer and filter-like. | {"id": "cheap-filtered-wave", "kind": "playable", "moduleId": "cheap-filtered-wave", "label": "Rounded-edge Oscillator", "mode": ""} |
| `additive-transfer-filter` · Analytic transfer response on partials | filter; direct | Per sample · partial-parallel response evaluation; Applies a filter's complex magnitude and phase response directly to each known synthesized harmonic without a recursive audio stream. | {"id": "additive-transfer-filter", "kind": "playable", "moduleId": "additive-transfer-filter", "label": "Partial Transfer Filter", "mode": ""} |
| `cyclic-fractal-noise` · Cyclic fractal noise | source; direct | Per sample · fixed trig-heavy octave loop; Creates coherent, structured procedural noise that can sound airy, granular, tonal, or liquid rather than uniformly random. | {"id": "cyclic-fractal-noise", "kind": "playable", "moduleId": "cyclic-fractal-noise", "label": "Cyclic Fractal Noise", "mode": ""} |
| `gaussian-random-pair` · Box–Muller Gaussian pair | modulation; direct | Per event/voice · stateless transform; Turns uniform hashes into bell-shaped random values for natural detune, spatial scatter, modal variation, and grain placement. | {"id": "gaussian-random-pair", "kind": "playable", "moduleId": "gaussian-random-pair", "label": "Gaussian Pair", "mode": ""} |
| `control-derived-ducking` · Control-derived ducking | composition; direct | Per sample · stateless control envelope; Creates sidechain-like pumping directly from a known trigger clock without measuring an audio signal. | {"id": "control-derived-ducking", "kind": "playable", "moduleId": "control-derived-ducking", "label": "Clock Duck", "mode": ""} |
| `dc-blocker` · DC blocker / one-pole filter | filter; block | State-sensitive · recursive scan; Removes very-low-frequency offset introduced by asymmetrical waveshaping, rectification, or modulation. | {"id": "dc-blocker", "kind": "playable", "moduleId": "recursive-filter", "label": "Recursive Filter", "mode": "DC blocker"} |
| `feedback-delay` · True feedback delay | space; block | State-sensitive · delayed recursion; Recirculates echoes so they evolve, saturate, filter, or destabilize over time. | {"id": "feedback-delay", "kind": "playable", "moduleId": "feedback-network", "label": "Feedback Network", "mode": "Feedback delay"} |
| `comb-allpass` · Comb + all-pass network | space; block | State-sensitive · parallel banks; Creates pitched resonances, diffusion, and dense algorithmic reverb from short recursive delay structures. | {"id": "comb-allpass", "kind": "playable", "moduleId": "feedback-network", "label": "Feedback Network", "mode": "Comb + all-pass"} |
| `karplus-strong` · Karplus–Strong / waveguide | synthesis; block | State-sensitive · delayed recursion; Turns a short burst into a plucked string or resonant tube by recirculating a filtered delay line. | {"id": "karplus-strong", "kind": "playable", "moduleId": "wavefield-solver", "label": "Wavefield Solver", "mode": "Karplus\u2013Strong string"} |
| `fft-stft` · FFT / short-time spectrum | architecture; block | Block-parallel · shared memory + barriers; Transforms blocks of samples into complex frequency bins for analysis and spectral processing. | {"id": "fft-stft", "kind": "infrastructure", "featureId": "spectral-frame-engine", "label": "STFT analysis / synthesis engine", "mode": ""} |
| `spectral-remap` · Spectral bin remap | filter; block | Bin-parallel · scatter / gather; Moves, mirrors, quantizes, deletes, or redistributes frequency components before inverse transformation. | {"id": "spectral-remap", "kind": "playable", "moduleId": "spectral-transport", "label": "Spectral Transport", "mode": "Bin remap"} |
| `phase-vocoder` · Phase-vocoder transport | architecture; block | Block-parallel · persistent bin state; Separates time movement from pitch by tracking and rebuilding the phase of STFT bins. | {"id": "phase-vocoder", "kind": "playable", "moduleId": "spectral-transport", "label": "Spectral Transport", "mode": "32-band resonator approximation"} |
| `dynamics-reduction` · Envelope + dynamics reduction | shaping; block | Block-parallel · reduction + state; Measures block loudness for compression, limiting, ducking, normalization, or side-chain control. | {"id": "dynamics-reduction", "kind": "playable", "moduleId": "dynamics", "label": "Dynamics", "mode": "Envelope reduction"} |
| `recursive-biquad` · Biquad / recursive IIR | filter; block | State-sensitive · second-order recurrence; Implements efficient low-pass, high-pass, band-pass, notch, peak, and shelving responses with two poles and two zeros. | {"id": "recursive-biquad", "kind": "playable", "moduleId": "recursive-filter", "label": "Recursive Filter", "mode": "Biquad"} |
| `state-variable-filter` · State-variable filter | filter; block | State-sensitive · ordered integrators; Produces related low-, band-, and high-pass outputs from one resonant state update. | {"id": "state-variable-filter", "kind": "playable", "moduleId": "recursive-filter", "label": "Recursive Filter", "mode": "State variable"} |
| `parallel-prefix-recursion` · Parallel scan for recurrences | architecture; block | Block-parallel · prefix scan + boundary state; Rearranges certain recursive filters or smoothers so a block can be evaluated in parallel while preserving ordered results. | {"id": "parallel-prefix-recursion", "kind": "infrastructure", "featureId": "parallel-recursion-scan", "label": "Parallel recurrence scan", "mode": ""} |
| `overlap-add` · Overlap-add / overlap-save | architecture; block | Block-parallel · overlapping writes / accumulation; Reassembles windowed or convolved blocks into a continuous stream without audible seams. | {"id": "overlap-add", "kind": "infrastructure", "featureId": "spectral-frame-engine", "label": "Overlap-add / overlap-save", "mode": ""} |
| `partitioned-convolution` · Partitioned FFT convolution | space; block | Block-parallel · FFT + spectral multiply-accumulate; Applies very long room, cabinet, resonator, or HRTF impulse responses with bounded block latency. | {"id": "partitioned-convolution", "kind": "playable", "moduleId": "convolution-space", "label": "Convolution Space", "mode": "Staged sparse-tap prototype"} |
| `feedback-delay-network` · Feedback delay network | space; block | State-sensitive · delay bank + matrix mix; Couples several delay lines through a stable matrix to create dense, controllable late reverberation. | {"id": "feedback-delay-network", "kind": "playable", "moduleId": "feedback-network", "label": "Feedback Network", "mode": "Recirculating 4/8-tap field approximation"} |
| `large-grain-engine` · Grain-parallel sample engine | architecture; block | Grain-parallel · random gathers + mix reduction; Scales granular synthesis from a small per-sample loop to hundreds or thousands of independent playheads over large recordings. | {"id": "large-grain-engine", "kind": "playable", "moduleId": "gpu-sampler-granulator", "label": "GPU Sampler / Granulator", "mode": "Bounded 24-grain loop"} |
| `voice-mix-reduction` · Voice / layer mix reduction | architecture; block | Block-parallel · workgroup/subgroup reduction; Combines many independently rendered voices, grains, modes, or spatial paths into the final output channels. | {"id": "voice-mix-reduction", "kind": "infrastructure", "featureId": "parallel-mix-reduction", "label": "Parallel voice / layer reduction", "mode": ""} |
| `million-sinusoid-bank` · Massive additive oscillator bank | synthesis; block | Partial-parallel · persistent phase + reduction; Turns very large collections of sinusoids into resynthesis, spectral models, swarms, and physically derived radiation fields. | {"id": "million-sinusoid-bank", "kind": "playable", "moduleId": "massive-bank", "label": "Massive Bank", "mode": "Sinusoid bank"} |
| `massive-modal-synthesis` · Large modal resonator bank | synthesis; block | Mode-parallel · parameter buffers + reduction; Represents objects and resonant systems as hundreds or thousands of damped modes excited by impacts or continuous forces. | {"id": "massive-modal-synthesis", "kind": "playable", "moduleId": "massive-bank", "label": "Massive Bank", "mode": "Modal resonator bank"} |
| `nonlinear-string-fdtd` · Nonlinear string FDTD | synthesis; block | Grid-parallel · ping-pong state + neighbor reads; Simulates displacement along a stiff or nonlinear string, including dispersion, tension changes, loss, and distributed excitation. | {"id": "nonlinear-string-fdtd", "kind": "playable", "moduleId": "wavefield-solver", "label": "Wavefield Solver", "mode": "Nonlinear string"} |
| `membrane-fdtd` · 2D membrane / plate FDTD | synthesis; block | Grid-parallel · ping-pong textures/buffers; Simulates drums, membranes, plates, and continuously deformable resonant surfaces on a spatial grid. | {"id": "membrane-fdtd", "kind": "playable", "moduleId": "wavefield-solver", "label": "Wavefield Solver", "mode": "Membrane / plate"} |
| `room-acoustics-fdtd` · Room wavefield simulation | space; block | Grid-parallel · many time steps + large state; Propagates acoustic pressure through a 2D or 3D scene so reflections, diffraction, occlusion, and moving boundaries emerge from geometry. | {"id": "room-acoustics-fdtd", "kind": "playable", "moduleId": "wavefield-solver", "label": "Wavefield Solver", "mode": "Room wavefield"} |
| `digital-waveguide-mesh` · Digital waveguide mesh | synthesis; block | Graph/grid-parallel · persistent directional delays; Routes traveling waves through a network of scattering junctions to model strings, plates, tubes, and connected resonant spaces. | {"id": "digital-waveguide-mesh", "kind": "playable", "moduleId": "wavefield-solver", "label": "Wavefield Solver", "mode": "Waveguide mesh"} |
| `hrtf-binaural-convolution` · HRTF binaural convolution | space; block | Source/ear-parallel · FIR or partitioned convolution; Filters a source for each ear using direction-dependent head and pinna responses, creating headphone-localized 3D sound. | {"id": "hrtf-binaural-convolution", "kind": "playable", "moduleId": "spatializer", "label": "Directional Spatializer", "mode": "Analytic binaural-cue approximation"} |
| `ambisonic-decode` · Ambisonic speaker / binaural decode | space; block | Channel-parallel · matrix or convolution bank; Converts an encoded sound field into loudspeaker feeds or headphone signals while preserving directional relationships. | {"id": "ambisonic-decode", "kind": "playable", "moduleId": "spatializer", "label": "Directional Spatializer", "mode": "FOA-style stereo decode"} |
| `sliding-phase-vocoder` · Sliding phase vocoder | architecture; block | Bin-parallel · persistent complex/phase state; Continuously analyzes and rebuilds partial trajectories with finer temporal updates than a conventional frame-at-a-time phase vocoder. | {"id": "sliding-phase-vocoder", "kind": "playable", "moduleId": "spectral-transport", "label": "Spectral Transport", "mode": "Sliding 32-band phase approximation"} |
| `spectral-gate` · Spectral gate / denoiser | filter; block | Bin-parallel · FFT + smoothed state; Attenuates low-energy frequency bins to remove noise, isolate partials, or make spectra flicker and fragment. | {"id": "spectral-gate", "kind": "playable", "moduleId": "spectral-gate", "label": "Spectral Gate", "mode": ""} |
| `audio-analysis-texture` · ShaderToy-style audio texture | architecture; block | Analysis/upload stage · texture reads; Exposes an external audio spectrum and waveform as shader-readable rows for reactive synthesis, modulation, and audiovisual coupling. | {"id": "audio-analysis-texture", "kind": "playable", "moduleId": "audio-analysis-field", "label": "Audio Analysis Field", "mode": "Waveform ring + scalar probes"} |
| `compute-audio-stream-bridge` · Compute-to-audio streaming bridge | architecture; block | Dispatch + storage buffer + readback/queue; Defines the contract that turns parallel shader invocations into ordered stereo blocks that an audio device can play continuously. | {"id": "compute-audio-stream-bridge", "kind": "infrastructure", "featureId": "compute-audio-bridge", "label": "GPU-to-audio chunk bridge", "mode": ""} |
| `phase-prefix-integration` · Parallel phase integration | architecture; block | Block-parallel · prefix sum + carry; Integrates arbitrary time-varying frequency into correct continuous oscillator phase for glides, FM trajectories, and control-rate pitch streams. | {"id": "phase-prefix-integration", "kind": "infrastructure", "featureId": "phase-integrator", "label": "Continuous GPU phase integration", "mode": ""} |
| `hybrid-convolution` · Hybrid / non-uniform convolution | space; block | Multi-rate blocks · direct FIR + FFT tiers; Keeps immediate reflections responsive while processing a very long reverberant tail with progressively larger FFT partitions. | {"id": "hybrid-convolution", "kind": "playable", "moduleId": "convolution-space", "label": "Convolution Space", "mode": "Hybrid sparse-tap prototype"} |
| `oversampled-nonlinearity` · Oversample → nonlinear → decimate | shaping; block | Block/state · polyphase FIR + expanded sample rate; Moves alias products from clipping, folding, rectification, and nonlinear filters into a wider temporary band before removing them. | {"id": "oversampled-nonlinearity", "kind": "playable", "moduleId": "fold", "label": "Wavefolder", "mode": "Oversampled quality"} |
| `filtered-noise-spectrum` · Filtered-noise spectral synthesis | synthesis; block | Bin-parallel · random phase + inverse FFT; Synthesizes breath, wind, bow noise, room air, and evolving textures from a drawn or learned magnitude spectrum. | {"id": "filtered-noise-spectrum", "kind": "playable", "moduleId": "ddsp-resynth", "label": "DDSP Resynth", "mode": "Filtered-noise spectrum"} |
| `vocoder-cross-synthesis` · Vocoder / spectral envelope transfer | filter; block | Block-parallel · dual analysis + band smoothing; Imposes the moving spectral envelope of one sound onto another, producing speech-like carriers and cross-synthesized hybrids. | {"id": "vocoder-cross-synthesis", "kind": "playable", "moduleId": "spectral-vocoder", "label": "Cross-Synthesis Vocoder", "mode": "32-channel filter-bank vocoder"} |
| `lookahead-limiter` · Look-ahead / true-peak limiter | shaping; block | Block-parallel reduction + delayed state; Protects the output from peaks by inspecting future samples before their delayed playback position reaches the gain stage. | {"id": "lookahead-limiter", "kind": "playable", "moduleId": "dynamics", "label": "Dynamics", "mode": "Look-ahead limiter"} |
| `neural-dilated-convolution` · Neural dilated-convolution block | architecture; block | Block-parallel · tensor kernels + weight buffers; Runs learned amplifier, cabinet, distortion, denoising, or timbre transformations over audio blocks. | {"id": "neural-dilated-convolution", "kind": "playable", "moduleId": "neural-processor", "label": "Neural Processor", "mode": "Fixed-weight dilated network"} |
| `neural-recurrent-model` · Neural recurrent / LSTM model | architecture; block | Time-serial per stream · batch-parallel across models; Models stateful nonlinear hardware or temporal sound behavior whose current output depends on a compact learned memory. | {"id": "neural-recurrent-model", "kind": "playable", "moduleId": "neural-processor", "label": "Neural Processor", "mode": "Compact recurrent network"} |
| `ddsp-decoder` · DDSP harmonic + noise decoder | synthesis; block | Control-rate inference + audio-rate DSP blocks; Combines interpretable oscillator and noise synthesis with learned control trajectories for timbre transfer and expressive resynthesis. | {"id": "ddsp-decoder", "kind": "playable", "moduleId": "ddsp-resynth", "label": "DDSP Resynth", "mode": "Harmonic + noise decoder"} |
| `mirror-fold-time-field` · Mirrored-domain time field | control; live | Per sample · 1–8 bounded domain folds; Tiles and reflects a step coordinate into nested, palindromic note orderings. Repeating the fold creates self-similar phrases without storing a note list. | {"id": "mirror-fold-time-field", "kind": "playable", "moduleId": "mirror-fold-sequencer", "label": "Mirror Fold Sequencer", "mode": ""} |
| `sdf-boundary-clock` · Signed shape-boundary clock | control; live | Per sample · analytic 2D shape field; Sweeps a point through circles, boxes, diamonds, hexagons, rings, or crosses. Every contour crossing becomes a musical event. | {"id": "sdf-boundary-clock", "kind": "playable", "moduleId": "sdf-orbit-sequencer", "label": "SDF Shape Sequencer", "mode": ""} |
| `polar-kaleidoscope-clock` · Polar-kaleidoscope clock | control; live | Per sample · polar modulo + reflection; Divides a circular traversal into reflected angular wedges, making radial symmetry audible as mirrored and palindromic pitch motion. | {"id": "polar-kaleidoscope-clock", "kind": "playable", "moduleId": "polar-kaleidoscope-sequencer", "label": "Polar Kaleidoscope", "mode": ""} |
| `voronoi-event-field` · Voronoi site / border event field | control; live | Per sample · fixed five-neighbor search; Treats jittered feature sites as irregular hits, or uses the F2−F1 ridge between neighboring sites as a complementary rhythm. | {"id": "voronoi-event-field", "kind": "playable", "moduleId": "voronoi-cell-sequencer", "label": "Voronoi Cell Sequencer", "mode": ""} |
| `truchet-path-clock` · Truchet-path clock | control; live | Per sample · tile hash + two arc distances; Scans deterministically oriented quarter-circle tiles; proximity to paired corner arcs creates syncopated gates and repeatable pitch identities. | {"id": "truchet-path-clock", "kind": "playable", "moduleId": "truchet-path-sequencer", "label": "Truchet Path Sequencer", "mode": ""} |
| `kifs-fold-clock` · KIFS recursive-fold clock | control; live | Per sample · 1–8 bounded fold iterations; Maps a circular time path through repeated absolute-value, rotation, scale, and translation folds. Nested field regions become self-similar notes and rests. | {"id": "kifs-fold-clock", "kind": "playable", "moduleId": "kifs-fold-sequencer", "label": "KIFS Fold Sequencer", "mode": ""} |
| `interference-lattice-clock` · Interference-lattice clock | control; live | Per sample · 3–12 bounded plane waves; Samples the sum of rotated plane waves along an orbit. Their constructive interference becomes a quasi-periodic event lattice with longer cycles than a single grid. | {"id": "interference-lattice-clock", "kind": "playable", "moduleId": "interference-lattice-sequencer", "label": "Interference Lattice", "mode": ""} |
| `phase-plane-coordinate-field` · Phase-plane trajectory | control; live | Per sample · analytic X/Y control pair; Generates two continuous coordinates from absolute sample time. X and Y can be patched independently into spatial pattern modules. | {"id": "phase-plane-coordinate-field", "kind": "playable", "moduleId": "phase-plane", "label": "Phase Plane", "mode": ""} |
| `tile-mirror-coordinate-field` · Tile + mirror coordinate field | control; live | Per sample · rotation + fract + optional reflection; Transforms incoming X/Y into repeated local coordinates. Mirroring makes cell boundaries continuous and turns one-way travel into forward/reverse motifs. | {"id": "tile-mirror-coordinate-field", "kind": "playable", "moduleId": "tile-mirror-domain", "label": "Tile + Mirror", "mode": ""} |
| `polar-fold-coordinate-field` · Polar-fold coordinate field | control; live | Per sample · length + atan2 + angular fold; Converts X/Y into continuous radius plus repeated, reflected angle. Sector symmetry and radial twist become separately patchable controls. | {"id": "polar-fold-coordinate-field", "kind": "playable", "moduleId": "polar-fold-domain", "label": "Polar Fold", "mode": ""} |
| `sdf-pattern-control-field` · Patchable signed-shape field | control; live | Per sample · repeated analytic shape field; Accepts X/Y and optional extent CV, then outputs a signed field and contour gate for circles, boxes, diamonds, hexagons, rings, or crosses. | {"id": "sdf-pattern-control-field", "kind": "playable", "moduleId": "sdf-pattern-field", "label": "SDF Pattern", "mode": ""} |
| `sdf-boolean-control-field` · SDF boolean / smooth logic | control; live | Per sample · smooth min/max composition; Combines two distance streams as geometric OR, AND, subtraction, or exclusive regions, then emits a new distance and gate. | {"id": "sdf-boolean-control-field", "kind": "playable", "moduleId": "sdf-logic", "label": "SDF Logic", "mode": ""} |
| `interference-control-field` · Patchable interference field | control; live | Per sample · 2–12 bounded plane-wave sum; Accepts X/Y and phase CV, then returns continuous wave interference plus an event envelope at constructive peaks. | {"id": "interference-control-field", "kind": "playable", "moduleId": "interference-field", "label": "Interference Field", "mode": ""} |
| `voronoi-control-field` · Patchable Voronoi event field | control; live | Per sample · fixed local 3×3 feature search; Accepts X/Y and cell-motion CV, then emits a held nearest-cell identity plus a site-center or shared-border gate. | {"id": "voronoi-control-field", "kind": "playable", "moduleId": "voronoi-event-field", "label": "Voronoi Events", "mode": ""} |
| `truchet-router-control-field` · Patchable Truchet arc router | control; live | Per sample · cell hash + two arc distances; Accepts X/Y and turn CV, then outputs tile identity and a gate along paired circular arcs in deterministic tiles. | {"id": "truchet-router-control-field", "kind": "playable", "moduleId": "truchet-router", "label": "Truchet Router", "mode": ""} |
| `hex-triangle-lattice-clock` · Hexagonal / triangular lattice crossings | control; direct | Per sample · affine coordinate transform; Changes square-grid timing into three-axis recurrence. Lattice-line crossings become interlocking accents and cell identity can choose note or articulation. | {"id": "hex-triangle-lattice-clock", "kind": "playable", "moduleId": "hex-triangle-lattice-clock", "label": "Hex / Triangle Lattice", "mode": ""} |
| `log-spiral-event-field` · Logarithmic-spiral event field | control; direct | Per sample · polar conversion + logarithm; Produces nested events at geometric radial intervals. Moving inward or outward creates accelerating or decelerating structures without changing a conventional tempo clock. | {"id": "log-spiral-event-field", "kind": "playable", "moduleId": "log-spiral-event-field", "label": "Log Spiral Events", "mode": ""} |
| `domain-warp-time-field` · Domain-warp microtiming field | control; direct | Per sample · bounded octave loops; Bends a regular trajectory coherently across phrase, beat, and microtiming scales instead of adding unrelated random jitter to each event. | {"id": "domain-warp-time-field", "kind": "playable", "moduleId": "domain-warp-time-field", "label": "Domain-warp Time Field", "mode": ""} |
| `fractal-orbit-trap-events` · Fractal orbit-trap events | control; direct | Per sample · bounded recursive fold loop; Turns minimum recursive distance, escape iteration, or region identity into sparse gates and nonlinear control gestures. | {"id": "fractal-orbit-trap-events", "kind": "playable", "moduleId": "fractal-orbit-trap-events", "label": "Fractal Orbit-trap Events", "mode": ""} |
| `cellular-automaton-score` · Cellular-automaton score lattice | control; live | Ordered generations · conditional ping-pong GPU state; Uses successive automaton generations as gate lanes, scale masks, routing matrices, or note rows. Rule number changes compositional behavior rather than one continuous intensity. | {"id": "cellular-automaton-score", "kind": "playable", "moduleId": "cellular-automaton-score", "label": "Cellular Automaton Score", "mode": ""} |
| `reaction-diffusion-score-lattice` · Reaction–diffusion score lattice | control; live | Persistent 2D state · conditional ping-pong passes; Evolves spots, stripes, splits, and moving chemical boundaries that can be scanned as slow CV, stereo paths, event density, or spectral weights. | {"id": "reaction-diffusion-score-lattice", "kind": "playable", "moduleId": "reaction-diffusion-score-lattice", "label": "Reaction\u2013Diffusion Score Lattice", "mode": ""} |
| `geometric-feedback-lattice` · Geometric feedback / delay lattice | space; live | Persistent storage · conditional ordered history pass; Stores audio energy in cells, then uses tiling, folds, permutations, and diffusion as feedback routing. The geometry becomes a resonant memory rather than a clock. | {"id": "geometric-feedback-lattice", "kind": "playable", "moduleId": "geometric-feedback-lattice", "label": "Geometric Feedback Lattice", "mode": ""} |
| `spectral-sdf` · Spectral signed-distance field | filter; live | 64-band workgroup DFT and overlap-add · conditional GPU spectral state; Treats frequency bins and successive analysis frames as a geometric plane. Circles, boxes, rings, crosses, or spirals keep and suppress moving regions before resynthesis. | {"id": "spectral-sdf", "kind": "playable", "moduleId": "spectral-sdf", "label": "Spectral SDF", "mode": ""} |
| `flow-field-advection` · Flow-field advection | control; live | Bounded particle update + aggregate interpolation · conditional GPU state; Moves a persistent particle cloud through a curl-like field, then reduces its centroid and anisotropy to correlated X/Y controls for pitch, phase, pan, or routing. | {"id": "flow-field-advection", "kind": "playable", "moduleId": "flow-field-advection", "label": "Flow-field Advection", "mode": ""} |
| `raymarch-resonator` · Raymarched SDF resonator | synthesis; live | Bounded SDF ray projection · compact modal recurrence; Turns bounded ray distances and surface identities from an implicit shape into a bank of resonant frequencies, decay weights, and stereo positions. | {"id": "raymarch-resonator", "kind": "playable", "moduleId": "raymarch-resonator", "label": "Raymarch Resonator", "mode": ""} |
| `batch-patch-renderer` · Batch-of-patches renderer | architecture; block | Patch × sample grid · batched output buffers; Auditions or exports hundreds of synth parameterizations at once, using the GPU as a parallel sound-discovery laboratory. | {"id": "batch-patch-renderer", "kind": "workflow", "featureId": "sound-discovery-lab", "label": "Batch sound-discovery renderer", "mode": ""} |

## PHYSICAL_SOUND_DEFINITIONS (5)

Source: [src/physical-sounds.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/physical-sounds.js).

| Source ID / name | Topology / value | Source implementation note |
| --- | --- | --- |
| `particle-cabinet` · Particle Cabinet | stochastic collisions into a modal container | Shake ensembles of particles against the walls of resonant bodies. |
| `impact-ecology` · Impact Ecology | scheduled micro-impacts into a modal body | Bounce, shatter, crumple, roll, and scrape controllable impact populations. |
| `object-forge` · Object Forge | position-dependent modal synthesis | Strike arbitrary wood, glass, metal, ceramic, and imported modal objects. |
| `bowed-things` · Bowed Things | friction excitation into an inharmonic resonator | Rub bars, glass, bowls, and cymbals with pressure-, speed-, and position-sensitive bows. |
| `airflow-objects` · Airflow Objects | Strouhal, quarter-wave, and Helmholtz resonators | Blow across cavities, wires, slots, pipes, and bottles. |

## RECURSION_STUDY_DEFINITIONS (6)

Source: [src/recursion.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/recursion.js).

| Source ID / name | Topology / value | Source implementation note |
| --- | --- | --- |
| `ouroboros-tape` · Fuzzy Donut |  | The rendered buffer from one pass becomes the only input to the next. |
| `spectral-mobius` · Spectral Möbius |  | Each STFT frame folds its upper spectrum back through the lower spectrum. |
| `filter-hydra` · Filter Hydra |  | Every spectral branch divides into inherited low and high children. |
| `cantor-delay` · Cantor Delay |  | Each delay node emits two children after smaller fractions of its parent's wait. |
| `convolution-maw` · Convolution Maw |  | Each generation is convolved with itself, then cropped and normalized before recursing. |
| `phase-labyrinth` · Phase Labyrinth |  | Each inward generation adds one allpass chamber; the unwind removes them in reverse. |

## SRTUSS_MASTER_FAMILIES (8)

Source: [src/srtuss-master.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/srtuss-master.js).

| Program / part identity | Part / role | Source behavior |
| --- | --- | --- |
| `XdSGz1:melody` · noir et blanc | Detuned melody; lead | Fixed-step sine melody, upper harmonic, and short subharmonic. |
| `XdSGz1:bass` · noir et blanc | Pulse + sub bass; bass | Pulse-shaped bass line and the long low sine voice. |
| `XdSGz1:echo` · noir et blanc | Alternating taps; fx | The authored eleven-tap alternating stereo echo, fed by melody and bass. |
| `Xd2GW3:noise-band` · Industry II | Gated noise band; texture | Differentiated high-rate noise shaped by the four-second cycle. |
| `Xd2GW3:engine` · Industry II | Engine tone; harmony | Vibrating engine pair plus its low sine carrier. |
| `Xd2GW3:grind` · Industry II | Grind; texture | Rough high-rate noise sweep modulated by a twenty-radian motion. |
| `Xd2GW3:phase-sweep` · Industry II | Phase sweep; fx | Seven-second programmed nonlinear phase trajectory. |
| `Xd2GW3:thump` · Industry II | Machine thump; kick | Short 1.25-second pitched-noise impact. |
| `Xd2GW3:echo` · Industry II | Machine echo; fx | The authored alternating multitap echo fed by all five dry mechanisms. |
| `ldlfRS:spectral-body` · Shift | Stochastic body; texture | A 256-partial noise-weighted additive oscillator. |
| `ldlfRS:dorian-arp` · Shift | Dorian PWM arp; lead | Deterministic Dorian note selection through a pulse-width voice. |
| `ldlfRS:bass` · Shift | Pulse bass; bass | Low pulse and sine bass gestures following the shared section transposition. |
| `ldlfRS:kick` · Shift | Pitch-drop kicks; kick | Two phase-offset synthetic pitch-drop kick patterns. |
| `ldlfRS:snare` · Shift | Snare noise; snare | Four-step exponentially decaying noise hit. |
| `ldlfRS:hats` · Shift | Hats + ticks; hats | Fast noise ticks with deterministic level variation. |
| `ldlfRS:delay` · Shift | Stereo delays; fx | Two short cross-channel taps fed only by the body and arpeggio. |
| `4tsGD8:tracker-a` · Boulder Dash title | Tracker lane A; lead | First lane of the literal 128-step phase score. |
| `4tsGD8:tracker-b` · Boulder Dash title | Tracker lane B; harmony | Second lane of the literal 128-step phase score. |
| `4tsGD8:intro-bleep` · Boulder Dash title | Intro bleep; percussion | Bright section-gated introductory bleep. |
| `4tsGD8:dust` · Boulder Dash title | Dust bursts; texture | Continuous grit and sharply gated dusty noise swells. |
| `4tsGD8:smear` · Boulder Dash title | Short smear taps; fx | Three delayed copies of the complete dry tracker voice. |
| `lldGDM:metal-bed` · Noise Bands | Metal bed; texture | Texture-weighted additive metal with slowly crossfaded random seeds. |
| `lldGDM:high-tick` · Noise Bands | High tick; lead | Sparse 13 kHz stereo tick embedded in the texture generator. |
| `lldGDM:kick` · Noise Bands | Kick; kick | Two-component falling-pitch kick and click. |
| `lldGDM:hats` · Noise Bands | Hats; hats | Three offset hats plus the slower noise accent. |
| `lldGDM:metal-accents` · Noise Bands | Metal accents; percussion | Paired low metal hits on the 32-beat cycle. |
| `lldGDM:bleep-echo` · Noise Bands | Bleep echo; fx | Quantized bleep with two asymmetric stereo repeats. |
| `ltKSRc:tone-cloud` · Gravity Shielding | Tone cloud; harmony | Stochastic partial cloud blended with a high sine wobble. |
| `ltKSRc:metal-bed` · Gravity Shielding | Texture metal; texture | Thirty texture-fed metallic partials. |
| `ltKSRc:sparks` · Gravity Shielding | Stereo sparks; hats | Rapid alternating exponential spark impulses. |
| `ltKSRc:impact` · Gravity Shielding | Swept impact; fx | Noise onset and nonlinear phase-swept impact gesture. |
| `ltKSRc:thunder` · Gravity Shielding | FBM thunder; bass | Three layered fractal-noise thunder strikes on the 6.2 cycle. |
| `4tdSDB:kick` · DnB | Noise kick; kick | Short noise kick on the nested break pulse. |
| `4tdSDB:metal-hits` · DnB | Metal hits; percussion | Two alternating 100-partial metal drum voices. |
| `4tdSDB:hats` · DnB | Closed + open hats; hats | Fast and slow high-frequency metal hats. |
| `4tdSDB:snare-fill` · DnB | Snare + fill; snare | Noise-and-tone snare gesture with fill modulation. |
| `4tdSDB:bass-sweep` · DnB | Bass sweep; bass | Low falling-frequency sine sweep. |
| `4tdSDB:pad-echo` · DnB | Harmonic pad; harmony | Procedurally voiced additive chord and stereo echo taps. |
| `4tdSDB:transition` · DnB | Transition riser; fx | Texture-metal riser that replaces the mix at section boundaries. |
| `MslBR4:lydian-dyad` · Cipher | Lydian dyad; lead | Two gated high sine voices quantized to Lydian intervals. |
| `MslBR4:root-bass` · Cipher | Root bass; bass | Paired low root oscillators. |
| `MslBR4:chord-pad` · Cipher | Chord pad; harmony | Three additive Lydian pad voices. |
| `MslBR4:pwm-lead` · Cipher | PWM lead; lead | Late-section deterministic pulse-width lead. |
| `MslBR4:feedback` · Cipher | Stereo feedback; fx | Three delayed alternating feedback taps from all tonal voices. |
| `MslBR4:hats` · Cipher | Hats; hats | Fast deterministic noise tick layer. |
| `MslBR4:kick` · Cipher | Kick; kick | Section-gated falling-pitch synthetic kick. |
| `MslBR4:snare` · Cipher | Snare; snare | Section-gated exponential noise snare. |
| `MslBR4:tom` · Cipher | Tom; percussion | Short high falling-pitch drum voice. |

## SIMD_SYNTH_SOURCE_MODELS (8)

Source: [src/simd-synth.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/simd-synth.js).

| Source ID / name | Topology / value | Source implementation note |
| --- | --- | --- |
| `0` · Vector table |  | sine → triangle → saw |
| `1` · Cascade FM |  | four-operator phase color |
| `2` · Wavefold stack |  | folded table layers |
| `3` · Modal metal |  | inharmonic resonator bank |
| `4` · Particle cloud |  | pitched dust and noise |
| `5` · Additive organ |  | nine moving drawbars |
| `6` · Formant bank |  | vowel-weighted harmonics |
| `7` · Vector bytebeat |  | SIMD integer rhythm code |

## SIMD_SYNTH_COMBINERS (6)

Source: [src/simd-synth.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/simd-synth.js).

| Source ID / name | Topology / value | Source implementation note |
| --- | --- | --- |
| `0` · Morph |  | equal-power A/B blend |
| `1` · Stack |  | add both sources |
| `2` · Ring |  | multiply A × B |
| `3` · AM |  | B shapes A level |
| `4` · Phase/FM |  | B bends A phase |
| `5` · Difference |  | A minus B |

## SIMD_SYNTH_SHAPERS (6)

Source: [src/simd-synth.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/simd-synth.js).

| Source ID / name | Topology / value | Source implementation note |
| --- | --- | --- |
| `0` · Clean |  |  |
| `1` · Soft drive |  |  |
| `2` · Wavefold |  |  |
| `3` · Chebyshev |  |  |
| `4` · Rectify |  |  |
| `5` · Bit crush |  |  |

## SIMD_SYNTH_FILTERS (5)

Source: [src/simd-synth.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/simd-synth.js).

| Source ID / name | Topology / value | Source implementation note |
| --- | --- | --- |
| `0` · Bypass |  |  |
| `1` · Low-pass |  |  |
| `2` · Band-pass |  |  |
| `3` · High-pass |  |  |
| `4` · Notch |  |  |

## SIMD_SYNTH_FILTER_ROUTES (6)

Source: [src/simd-synth.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/simd-synth.js).

| Source ID / name | Topology / value | Source implementation note |
| --- | --- | --- |
| `0` · Serial 1 → 2 |  |  |
| `1` · Serial 2 → 1 |  |  |
| `2` · Parallel |  |  |
| `3` · Voice split |  |  |
| `4` · Ring filters |  |  |
| `5` · Feedback |  |  |

## SIMD_SYNTH_FX (6)

Source: [src/simd-synth.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/simd-synth.js).

| Source ID / name | Topology / value | Source implementation note |
| --- | --- | --- |
| `0` · Bypass |  |  |
| `1` · Chorus |  |  |
| `2` · Flanger |  |  |
| `3` · Ping-pong |  |  |
| `4` · Slippery comb |  |  |
| `5` · Diffusion |  |  |

## SIMD_SYNTH_MOD_SOURCES (10)

Source: [src/simd-synth.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/simd-synth.js).

| Source ID / name | Topology / value | Source implementation note |
| --- | --- | --- |
| `0` · Off |  |  |
| `1` · LFO 1 |  |  |
| `2` · LFO 2 |  |  |
| `3` · Amp envelope |  |  |
| `4` · Sequence |  |  |
| `5` · Sample + hold |  |  |
| `6` · Velocity |  |  |
| `7` · Key track |  |  |
| `8` · X gesture |  |  |
| `9` · Y gesture |  |  |

## SIMD_SYNTH_MOD_DESTINATIONS (15)

Source: [src/simd-synth.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/simd-synth.js).

| Source ID / name | Topology / value | Source implementation note |
| --- | --- | --- |
| `0` · Source A pitch |  |  |
| `1` · Source B pitch |  |  |
| `2` · Source A color |  |  |
| `3` · Source B color |  |  |
| `4` · Source A motion |  |  |
| `5` · Source B motion |  |  |
| `6` · Combine mix |  |  |
| `7` · Shaper amount |  |  |
| `8` · Filter 1 cutoff |  |  |
| `9` · Filter 2 cutoff |  |  |
| `10` · Filter 1 resonance |  |  |
| `11` · Filter 2 resonance |  |  |
| `12` · Stereo width |  |  |
| `13` · FX 1 amount |  |  |
| `14` · FX 2 amount |  |  |

## SIMD_SYNTH_SCALES (6)

Source: [src/simd-synth.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/simd-synth.js).

| Source ID / name | Topology / value | Source implementation note |
| --- | --- | --- |
| `0` · Chromatic |  |  |
| `1` · Dorian |  |  |
| `2` · Phrygian |  |  |
| `3` · Harmonic minor |  |  |
| `4` · Whole tone |  |  |
| `5` · Pentatonic |  |  |

## Shared UI module inventory

These modules are component sources. Buttons and fields become performance bindings; they are not automatically audio-processing nodes. Domain canvases/editors are mapped separately in the page matrix.

- [src/ui/foundations/foundations.css](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/foundations/foundations.css)
- [src/ui/foundations/tokens.css](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/foundations/tokens.css)
- [src/ui/index.css](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/index.css)
- [src/ui/index.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/index.js)
- [src/ui/internal.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/internal.js)
- [src/ui/patterns/amplitude-control.css](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/patterns/amplitude-control.css)
- [src/ui/patterns/audio-strip.css](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/patterns/audio-strip.css)
- [src/ui/patterns/audio-strip.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/patterns/audio-strip.js)
- [src/ui/patterns/index.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/patterns/index.js)
- [src/ui/patterns/level-meter.css](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/patterns/level-meter.css)
- [src/ui/patterns/level-meter.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/patterns/level-meter.js)
- [src/ui/patterns/midi-status.css](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/patterns/midi-status.css)
- [src/ui/patterns/midi-status.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/patterns/midi-status.js)
- [src/ui/patterns/signal-monitor.css](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/patterns/signal-monitor.css)
- [src/ui/patterns/signal-monitor.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/patterns/signal-monitor.js)
- [src/ui/primitives/button.css](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/primitives/button.css)
- [src/ui/primitives/button.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/primitives/button.js)
- [src/ui/primitives/choice-switch.css](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/primitives/choice-switch.css)
- [src/ui/primitives/choice-switch.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/primitives/choice-switch.js)
- [src/ui/primitives/control-section.css](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/primitives/control-section.css)
- [src/ui/primitives/control-section.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/primitives/control-section.js)
- [src/ui/primitives/field.css](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/primitives/field.css)
- [src/ui/primitives/motion-mode-group.css](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/primitives/motion-mode-group.css)
- [src/ui/primitives/motion-mode-group.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/primitives/motion-mode-group.js)
- [src/ui/primitives/number-stepper.css](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/primitives/number-stepper.css)
- [src/ui/primitives/number-stepper.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/primitives/number-stepper.js)
- [src/ui/primitives/option-card-group.css](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/primitives/option-card-group.css)
- [src/ui/primitives/option-card-group.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/primitives/option-card-group.js)
- [src/ui/primitives/range-field.css](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/primitives/range-field.css)
- [src/ui/primitives/range-field.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/primitives/range-field.js)
- [src/ui/primitives/select-field.css](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/primitives/select-field.css)
- [src/ui/primitives/select-field.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/primitives/select-field.js)
- [src/ui/primitives/status-readout.css](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/primitives/status-readout.css)
- [src/ui/primitives/status-readout.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/primitives/status-readout.js)
- [src/ui/primitives/step-button.css](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/primitives/step-button.css)
- [src/ui/primitives/step-button.js](https://github.com/blechdom/morphazoid/blob/a67df8f44567b6fe457f2482f0084b24af249d1d/src/ui/primitives/step-button.js)
