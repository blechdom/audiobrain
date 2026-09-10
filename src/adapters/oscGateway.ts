export const OSC_PROTOCOL = 'audiobrain.osc.v1';
export interface OscControlMessage {
  protocol: typeof OSC_PROTOCOL;
  address: string;
  args: [{ type: 'f'; value: number }];
}
export function validOscAddress(address: string): boolean { return /^\/[A-Za-z0-9_/-]{1,127}$/.test(address); }
export function parseOscControl(data: unknown): OscControlMessage | null {
  if (typeof data !== 'string' || data.length > 4096 || new TextEncoder().encode(data).length > 4096) return null;
  try {
    const value: unknown = JSON.parse(data);
    if (!value || typeof value !== 'object') return null;
    const message = value as Record<string, unknown>;
    if (message.protocol !== OSC_PROTOCOL || typeof message.address !== 'string' || !validOscAddress(message.address) ||
        !Array.isArray(message.args) || message.args.length !== 1) return null;
    const arg: unknown = message.args[0];
    if (!arg || typeof arg !== 'object') return null;
    const { type, value: number } = arg as Record<string, unknown>;
    if (type !== 'f' || typeof number !== 'number' || !Number.isFinite(Math.fround(number))) return null;
    return message as unknown as OscControlMessage;
  } catch { return null; }
}
/** Browser contract is JSON over an explicitly connected WSS gateway, not UDP. */
export function connectOscGateway(options: {
  url: string;
  addresses: readonly string[];
  onControl: (address: string, value: number) => void;
  onStatus?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  createSocket?: (url: string) => WebSocket;
  pageOrigin?: string;
}): { sendControl: (address: string, value: number) => boolean; dispose: () => void } {
  const endpoint = new URL(options.url);
  const page = new URL(options.pageOrigin ?? window.location.origin);
  const loopback = (host: string) => ['localhost', '127.0.0.1', '[::1]'].includes(host);
  if (endpoint.username || endpoint.password || (endpoint.protocol !== 'wss:' &&
      !(endpoint.protocol === 'ws:' && loopback(endpoint.hostname) && loopback(page.hostname)))) throw new Error('Use WSS; insecure WebSocket is available only when both the app and gateway run on loopback.');
  if (options.addresses.length > 64 || options.addresses.some(address => !validOscAddress(address))) throw new Error('OSC supports up to 64 explicit scalar addresses.');
  const addresses = new Set(options.addresses);
  const socket = (options.createSocket ?? (url => new WebSocket(url)))(endpoint.href);
  let active = true;
  let sent = 0; let received = 0; let windowStart = Date.now();
  const lastInbound = new Map<string, number>();
  const lastOutbound = new Map<string, number>();
  const budget = () => { if (Date.now() - windowStart >= 1000) { windowStart = Date.now(); sent = 0; received = 0; } };
  const onOpen = () => { if (active) options.onStatus?.('connected'); };
  const onError = () => { if (active) options.onStatus?.('error'); };
  const onClose = () => { if (active) dispose(); };
  const onMessage = (event: MessageEvent<unknown>) => {
    if (!active) return;
    budget(); if (++received > 60) return;
    const message = parseOscControl(event.data);
    if (!message || !addresses.has(message.address)) return;
    const value = message.args[0].value;
    lastInbound.set(message.address, value);
    options.onControl(message.address, value);
  };
  function dispose() {
    if (!active) return;
    active = false;
    socket.removeEventListener('open', onOpen); socket.removeEventListener('error', onError);
    socket.removeEventListener('close', onClose); socket.removeEventListener('message', onMessage);
    socket.close(); lastInbound.clear(); lastOutbound.clear();
    options.onStatus?.('disconnected');
  }
  socket.addEventListener('open', onOpen); socket.addEventListener('error', onError);
  socket.addEventListener('close', onClose); socket.addEventListener('message', onMessage);
  options.onStatus?.('connecting');
  return {
    sendControl(address, value) {
      if (!active || socket.readyState !== WebSocket.OPEN || !addresses.has(address) || !Number.isFinite(Math.fround(value)) ||
          lastInbound.get(address) === value || lastOutbound.get(address) === value || socket.bufferedAmount > 65536) return false;
      budget(); if (sent >= 60) return false;
      sent += 1; lastInbound.delete(address); lastOutbound.set(address, value);
      socket.send(JSON.stringify({ protocol: OSC_PROTOCOL, address, args: [{ type: 'f', value }] }));
      return true;
    }, dispose,
  };
}
