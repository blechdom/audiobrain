import { describe, expect, it, vi } from 'vitest';
import { connectOscGateway, parseOscControl } from './oscGateway';

function fixture() {
  const events = new EventTarget();
  const send = vi.fn(); const close = vi.fn();
  const socket = Object.assign(events, { readyState: WebSocket.OPEN, bufferedAmount: 0, send, close }) as unknown as WebSocket;
  const receive = vi.fn(); const status = vi.fn();
  const adapter = connectOscGateway({ url: 'ws://127.0.0.1:8787', pageOrigin: 'http://127.0.0.1:5178', addresses: ['/control'],
    createSocket: () => socket, onControl: receive, onStatus: status });
  return { events, send, close, receive, status, adapter };
}
describe('explicit OSC gateway', () => {
  it('requires WSS from a hosted app and rejects nonlocal insecure sockets', () => {
    const base = { addresses: ['/control'], onControl: () => undefined };
    expect(() => connectOscGateway({ ...base, url: 'ws://127.0.0.1:8787', pageOrigin: 'https://audiobrain.org' })).toThrow('WSS');
    expect(() => connectOscGateway({ ...base, url: 'ws://remote.example:8787', pageOrigin: 'http://127.0.0.1:5178' })).toThrow('WSS');
  });
  it('accepts only its versioned finite scalar contract', () => {
    const encode = (value: unknown) => JSON.stringify({ protocol: 'audiobrain.osc.v1', address: '/control', args: [{ type: 'f', value }] });
    expect(parseOscControl(encode(0.5))?.args[0].value).toBe(0.5);
    expect(parseOscControl(encode(1e300))).toBeNull();
    expect(parseOscControl(encode('0.5'))).toBeNull();
    expect(parseOscControl(' '.repeat(4097))).toBeNull();
  });
  it('routes only mapped controls, suppresses echoes, and disposes socket listeners', () => {
    const { events, adapter, send, close, receive } = fixture();
    events.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ protocol: 'audiobrain.osc.v1', address: '/other', args: [{ type: 'f', value: 0.5 }] }) }));
    expect(receive).not.toHaveBeenCalled();
    events.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ protocol: 'audiobrain.osc.v1', address: '/control', args: [{ type: 'f', value: 0.5 }] }) }));
    expect(receive).toHaveBeenCalledWith('/control', 0.5);
    expect(adapter.sendControl('/control', 0.5)).toBe(false);
    expect(adapter.sendControl('/control', 0.75)).toBe(true);
    expect(send).toHaveBeenCalledOnce();
    adapter.dispose();
    expect(close).toHaveBeenCalledOnce();
    expect(adapter.sendControl('/control', 1)).toBe(false);
  });
});
