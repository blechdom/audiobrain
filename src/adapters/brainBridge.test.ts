import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachBrainBridge, BRAIN_PROTOCOL, readBrainPairing } from './brainBridge';

const origin = 'https://videobrain.org';
const nonce = 'a'.repeat(48);
const cleanup: (() => void)[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup.splice(0).forEach(dispose => dispose()); document.body.innerHTML = ''; vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture() {
  const frame = document.createElement('iframe'); document.body.append(frame);
  const candidate = frame.contentWindow;
  if (!candidate) throw new Error('Missing fixture window');
  const peer: Window = candidate;
  const post = vi.spyOn(peer, 'postMessage').mockImplementation(() => undefined);
  const onControl = vi.fn(); const onStatus = vi.fn();
  const bridge = attachBrainBridge({ allowedOrigin: origin, peerWindow: peer, nonce, channels: ['audiobrain-v1/value'], onControl, onStatus });
  cleanup.push(bridge.dispose);
  let seq = 0;
  function receive(overrides: Record<string, unknown> = {}, source: Window = peer, messageOrigin = origin) {
    window.dispatchEvent(new MessageEvent('message', { source, origin: messageOrigin,
      data: JSON.stringify({ protocol: BRAIN_PROTOCOL, session: nonce, seq: ++seq, type: 'control', channel: 'audiobrain-v1/value', value: 0.5, ...overrides }),
    }));
  }
  return { peer, post, onControl, onStatus, bridge, receive };
}
describe('Brain control pairing', () => {
  it('requires a handshake before controls and targets one exact origin', () => {
    const { bridge, receive, onControl, onStatus, post } = fixture();
    expect(bridge.sendControl('audiobrain-v1/value', 0.4)).toBe(false);
    receive(); expect(onControl).not.toHaveBeenCalled();
    receive({ type: 'hello' });
    expect(onStatus).toHaveBeenLastCalledWith('connected');
    receive(); expect(onControl).toHaveBeenCalledWith('audiobrain-v1/value', 0.5);
    expect(post.mock.calls.every(call => (call[1] as unknown) === origin)).toBe(true);
  });

  it('rejects wrong origin, source, nonce, protocol, sequence and unmapped channels', () => {
    const { receive, onControl } = fixture(); receive({ type: 'ready' });
    receive({}, window); receive({}, undefined, 'https://attacker.example');
    receive({ session: 'b'.repeat(48) }); receive({ protocol: 'another.protocol' });
    receive({ channel: 'unmapped' }); receive({ value: '0.5' });
    receive({ seq: 1 }); receive({ seq: 0 });
    expect(onControl).not.toHaveBeenCalled();
    receive({ value: 0.7 }); expect(onControl).toHaveBeenCalledExactlyOnceWith('audiobrain-v1/value', 0.7);
  });

  it('bounds messages and outbound rate and suppresses direct value echoes', () => {
    const { bridge, receive, peer, onControl } = fixture(); receive({ type: 'ready' });
    window.dispatchEvent(new MessageEvent('message', { source: peer, origin, data: ' '.repeat(4097) }));
    expect(onControl).not.toHaveBeenCalled();
    receive({ value: 0.5 });
    expect(bridge.sendControl('audiobrain-v1/value', 0.5)).toBe(false);
    expect(bridge.sendControl('audiobrain-v1/value', 0.6)).toBe(true);
    expect(bridge.sendControl('audiobrain-v1/value', 0.5)).toBe(true);
    expect(bridge.sendControl('audiobrain-v1/value', Infinity)).toBe(false);
    expect(bridge.sendControl('unmapped', 1)).toBe(false);
    let accepted = 2;
    for (let value = 1; value < 100; value += 1) if (bridge.sendControl('audiobrain-v1/value', value)) accepted += 1;
    expect(accepted).toBe(60);
    vi.advanceTimersByTime(1000);
    expect(bridge.sendControl('audiobrain-v1/value', 100)).toBe(true);
  });

  it('releases the listener and retry timer on dispose or remote goodbye', () => {
    const { bridge, receive, onControl, onStatus } = fixture(); receive({ type: 'hello' });
    receive({ type: 'bye' }); receive(); bridge.dispose();
    expect(onControl).not.toHaveBeenCalled();
    expect(onStatus).toHaveBeenLastCalledWith('disconnected');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('parses only explicitly allowed pairing origins and well-formed nonces', () => {
    expect(readBrainPairing(`#brainOrigin=${encodeURIComponent(origin)}&brainNonce=${nonce}`, [origin])).toEqual({ origin, nonce });
    expect(readBrainPairing(`#brainOrigin=${encodeURIComponent(origin)}&brainNonce=${nonce}`, [])).toBeNull();
    expect(readBrainPairing(`#brainOrigin=${encodeURIComponent(origin)}&brainNonce=short`, [origin])).toBeNull();
  });
});

it('queues the handshake before a connected callback publishes its initial value', () => {
  const frame = document.createElement('iframe'); document.body.append(frame);
  const peer = frame.contentWindow; if (!peer) throw new Error('Missing fixture window');
  const post = vi.spyOn(peer, 'postMessage').mockImplementation(() => undefined);
  const bridge = attachBrainBridge({ allowedOrigin: origin, peerWindow: peer, nonce, channels: ['initial'],
    onControl: () => undefined,
    onStatus(status) { if (status === 'connected') bridge.sendControl('initial', 0.5); },
  }); cleanup.push(bridge.dispose);
  window.dispatchEvent(new MessageEvent('message', { source: peer, origin,
    data: JSON.stringify({ protocol: BRAIN_PROTOCOL, session: nonce, seq: 1, type: 'hello' }),
  }));
  expect(post.mock.calls.map(call => (JSON.parse(call[0] as string) as { type: string }).type)).toEqual(['hello', 'ready', 'control']);
});
