import { useEffect, useRef, useState } from 'react';
import type { GraphDocument } from '../graph';
import type { AudioBrainRuntime, RuntimeSnapshot } from '../runtime/AudioBrainRuntime';
import { attachBrainBridge, openBrainPeer, type BrainBridge } from '../adapters/brainBridge';
import { bindRuntimeControls, brainNodeChannel } from '../adapters/runtimeControls';
import { connectOscGateway } from '../adapters/oscGateway';

interface ConnectionsPanelProps { runtime: AudioBrainRuntime; snapshot: RuntimeSnapshot; project: GraphDocument }
type Session = { dispose: () => void };

export function ConnectionsPanel({ runtime, snapshot, project }: ConnectionsPanelProps) {
  const [peerUrl, setPeerUrl] = useState('https://videobrain.org/');
  const [gatewayUrl, setGatewayUrl] = useState(location.protocol === 'http:' ? 'ws://127.0.0.1:8081' : '');
  const [error, setError] = useState<string | null>(null);
  const brain = useRef<Session | null>(null);
  const osc = useRef<Session | null>(null);
  const devices = runtime.getMidiDevices();
  const ioNodes = project.nodes.filter(node => node.kind.startsWith('io.brain.') || node.kind.startsWith('io.osc.'));
  const routingKey = JSON.stringify([project.id, ioNodes.map(node => [node.id, node.kind, node.params.channel, node.params.name, node.params.address]),
    project.edges.filter(edge => ioNodes.some(node => node.id === edge.target.nodeId || node.id === edge.source.nodeId))]);

  // Pairing belongs to a live route. Editing its addresses or replacing the graph releases it.
  useEffect(() => () => {
    brain.current?.dispose(); brain.current = null;
    osc.current?.dispose(); osc.current = null;
  }, [routingKey]);

  const report = (reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason));
  const run = (operation: Promise<void>) => { setError(null); void operation.catch(report); };
  const pair = () => {
    setError(null); brain.current?.dispose(); brain.current = null;
    let binding: ReturnType<typeof bindRuntimeControls> | undefined;
    let bridge: BrainBridge | undefined;
    try {
      if (!ioNodes.some(node => node.kind.startsWith('io.brain.'))) throw new Error('Add and connect a Brain Input or Brain Output node first.');
      binding = bindRuntimeControls({ runtime, document: project, kind: 'brain', send: (channel, value) => bridge?.sendControl(channel, value) ?? false });
      const peer = openBrainPeer(peerUrl);
      bridge = attachBrainBridge({ allowedOrigin: peer.origin, nonce: peer.nonce, peerWindow: peer.peerWindow, channels: binding.channels,
        onControl: binding.receive, onStatus: status => {
          runtime.setBridgeStatus('brain', status);
          if (status === 'disconnected') binding?.dispose();
        } });
      const sessionBinding = binding; const sessionBridge = bridge;
      brain.current = { dispose() { sessionBinding.dispose(); sessionBridge.dispose(); } };
    } catch (reason) { binding?.dispose(); bridge?.dispose(); report(reason); }
  };
  const connectOsc = () => {
    setError(null); osc.current?.dispose(); osc.current = null;
    let binding: ReturnType<typeof bindRuntimeControls> | undefined;
    let gateway: ReturnType<typeof connectOscGateway> | undefined;
    try {
      if (!ioNodes.some(node => node.kind.startsWith('io.osc.'))) throw new Error('Add and connect an OSC Input or OSC Output node first.');
      binding = bindRuntimeControls({ runtime, document: project, kind: 'osc', send: (address, value) => gateway?.sendControl(address, value) ?? false });
      gateway = connectOscGateway({ url: gatewayUrl, addresses: binding.channels, onControl: binding.receive, onStatus: status => {
        runtime.setBridgeStatus('osc', status);
        if (status === 'disconnected' || status === 'error') binding?.dispose();
      } });
      const sessionBinding = binding; const sessionGateway = gateway;
      osc.current = { dispose() { sessionBinding.dispose(); sessionGateway.dispose(); } };
    } catch (reason) { binding?.dispose(); gateway?.dispose(); report(reason); }
  };

  return <div className="connections-content">
    <p>Add an input or output node, connect its ports, then enable its device here or on the node.</p>
    {error && <p role="alert" className="connection-error">{error}</p>}
    <div className="connection-card"><h3>MIDI</h3><p>{snapshot.capabilities.midi}</p>
      <button className="secondary-button" onClick={() => run(runtime.enableMidi())}>Enable MIDI</button>
      <button className="subtle-button" onClick={() => runtime.disableMidi()}>Disconnect MIDI</button>
      {devices.inputs.length > 0 && <p>Inputs: {devices.inputs.map(device => device.name).join(', ')}</p>}
      <label className="connection-field">MIDI output device<select value={devices.selectedOutputId ?? ''} onChange={event => runtime.selectMidiOutput(event.target.value || null)}>
        <option value="">No output device selected</option>{devices.outputs.map(device => <option value={device.id} key={device.id}>{device.name}</option>)}
      </select></label>
    </div>
    <div className="connection-card"><h3>Microphone</h3><p>{snapshot.capabilities.microphone}</p>
      <button className="secondary-button" onClick={() => run(runtime.enableMicrophone())}>Enable microphone</button>
      <button className="subtle-button" onClick={() => runtime.disableMicrophone()}>Stop microphone</button>
    </div>
    <div className="connection-card"><h3>Videobrain</h3><p>{snapshot.capabilities.brain}</p>
      <label className="connection-field">Videobrain URL<input type="url" value={peerUrl} onChange={event => setPeerUrl(event.target.value)} placeholder="https://videobrain.org/" /></label>
      <p>Open Videobrain and choose the parameters to connect in its pairing panel. Both windows must stay open.</p>
      <div className="connection-routes">{ioNodes.filter(node => node.kind.startsWith('io.brain.')).map(node => <span key={node.id}>{node.kind.endsWith('.in') ? 'IN' : 'OUT'} <code>{(() => { try { return brainNodeChannel(node); } catch { return 'Invalid channel/name'; } })()}</code></span>)}</div>
      <button className="secondary-button" onClick={pair}>Open and pair Videobrain</button>
      <button className="subtle-button" onClick={() => { brain.current?.dispose(); brain.current = null; }}>Disconnect Videobrain</button>
    </div>
    <div className="connection-card"><h3>OSC gateway</h3><p>{snapshot.capabilities.osc}</p>
      <label className="connection-field">Gateway WebSocket URL<input type="url" value={gatewayUrl} onChange={event => setGatewayUrl(event.target.value)} placeholder="wss://your-gateway.example/" /></label>
      <p>One numeric value per address. A gateway connects this browser to your OSC devices.</p>
      <div className="connection-routes">{ioNodes.filter(node => node.kind.startsWith('io.osc.')).map(node => <span key={node.id}>{node.kind.endsWith('.in') ? 'IN' : 'OUT'} <code>{String(node.params.address)}</code></span>)}</div>
      <button className="secondary-button" onClick={connectOsc}>Connect OSC gateway</button>
      <button className="subtle-button" onClick={() => { osc.current?.dispose(); osc.current = null; }}>Disconnect OSC</button>
    </div>
    <p className="connection-note">Pairings stay active when this panel closes. Changing external routes or presets disconnects them. Device selections and pairing credentials are never saved in projects.</p>
  </div>;
}
