/** brain.control.v1: bounded, explicit, exact-origin window pairing. */
export const BRAIN_PROTOCOL = 'brain.control.v1';
export const BRAIN_LIMITS = { bytes: 4096, channels: 64, messagesPerSecond: 60, channelLength: 128 } as const;
export type BrainBridgeStatus = 'pairing' | 'connected' | 'disconnected';
export interface BrainBridgeOptions {
  allowedOrigin: string;
  peerWindow: Window;
  nonce: string;
  channels: readonly string[];
  onControl: (channel: string, value: number) => void;
  onStatus?: (status: BrainBridgeStatus) => void;
  eventWindow?: Window;
}
export interface BrainBridge {
  sendControl: (channel: string, value: number) => boolean;
  dispose: () => void;
}
interface Message {
  protocol: typeof BRAIN_PROTOCOL;
  session: string;
  seq: number;
  type: 'hello' | 'ready' | 'control' | 'bye';
  channel?: string;
  value?: number;
}
export function validBrainChannel(channel: string): boolean {
  return /^[A-Za-z0-9_./:-]{1,128}$/.test(channel);
}
function validOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.origin === origin && (url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)));
  } catch { return false; }
}
function decode(data: unknown): Message | null {
  if (typeof data !== 'string' || data.length > BRAIN_LIMITS.bytes || new TextEncoder().encode(data).length > BRAIN_LIMITS.bytes) return null;
  try {
    const value: unknown = JSON.parse(data);
    if (!value || typeof value !== 'object') return null;
    const message = value as Record<string, unknown>;
    if (message.protocol !== BRAIN_PROTOCOL || typeof message.session !== 'string' ||
        !Number.isSafeInteger(message.seq) || (message.seq as number) < 1 ||
        !['hello', 'ready', 'control', 'bye'].includes(message.type as string)) return null;
    if (message.type === 'control' && (typeof message.channel !== 'string' ||
        !validBrainChannel(message.channel) || typeof message.value !== 'number' || !Number.isFinite(message.value))) return null;
    return message as unknown as Message;
  } catch { return null; }
}
export function attachBrainBridge(options: BrainBridgeOptions): BrainBridge {
  if (!validOrigin(options.allowedOrigin)) throw new Error('Brain peer must have an exact HTTPS or loopback origin.');
  if (!/^[a-f0-9]{32,128}$/.test(options.nonce)) throw new Error('Invalid Brain pairing nonce.');
  if (options.channels.length > BRAIN_LIMITS.channels || options.channels.some(channel => !validBrainChannel(channel))) throw new Error('Invalid Brain channel mapping.');
  const channels = new Set(options.channels);
  const host = options.eventWindow ?? window;
  let active = true;
  let connected = false;
  let sequence = 0;
  let receivedSequence = 0;
  let sendWindow = Date.now();
  let receiveWindow = Date.now();
  let sent = 0;
  let received = 0;
  const lastInbound = new Map<string, number>();
  const lastOutbound = new Map<string, number>();
  const started = Date.now();
  let lastPeerSeen = started;
  function post(type: Message['type'], channel?: string, value?: number): void {
    if (!active) return;
    options.peerWindow.postMessage(JSON.stringify({ protocol: BRAIN_PROTOCOL, session: options.nonce, seq: ++sequence, type,
      ...(channel === undefined ? {} : { channel, value }),
    }), options.allowedOrigin);
  }
  function dispose(notifyPeer = true): void {
    if (!active) return;
    if (notifyPeer) post('bye');
    active = false;
    clearInterval(interval);
    host.removeEventListener('message', onMessage);
    lastInbound.clear(); lastOutbound.clear();
    options.onStatus?.('disconnected');
  }
  function onMessage(event: MessageEvent<unknown>): void {
    if (!active || event.origin !== options.allowedOrigin || event.source !== options.peerWindow) return;
    const message = decode(event.data);
    if (!message || message.session !== options.nonce || message.seq <= receivedSequence) return;
    const now = Date.now();
    if (now - receiveWindow >= 1000) { receiveWindow = now; received = 0; }
    if (++received > BRAIN_LIMITS.messagesPerSecond + 4) return;
    receivedSequence = message.seq;
    lastPeerSeen = now;
    if (message.type === 'bye') { dispose(false); return; }
    if (message.type === 'hello') {
      // Queue readiness before onStatus can publish initial control values.
      post('ready');
      if (!connected) { connected = true; options.onStatus?.('connected'); }
      return;
    }
    if (message.type === 'ready') {
      if (!connected) { connected = true; options.onStatus?.('connected'); }
      return;
    }
    if (!connected || message.channel === undefined || message.value === undefined || !channels.has(message.channel)) return;
    lastInbound.set(message.channel, message.value);
    options.onControl(message.channel, message.value);
  }
  host.addEventListener('message', onMessage);
  const interval = setInterval(() => {
    if (options.peerWindow.closed || (connected && Date.now() - lastPeerSeen > 10_000) ||
        (!connected && Date.now() - started > 120_000)) { dispose(); return; }
    post('hello');
  }, 1000);
  options.onStatus?.('pairing');
  post('hello');
  return {
    sendControl(channel, value) {
      if (!active || !connected || !channels.has(channel) || !Number.isFinite(value) ||
          lastInbound.get(channel) === value || lastOutbound.get(channel) === value) return false;
      const now = Date.now();
      if (now - sendWindow >= 1000) { sendWindow = now; sent = 0; }
      if (sent >= BRAIN_LIMITS.messagesPerSecond) return false;
      sent += 1;
      lastInbound.delete(channel);
      lastOutbound.set(channel, value);
      post('control', channel, value);
      return true;
    },
    dispose,
  };
}
export interface BrainPairing { origin: string; nonce: string }
export function readBrainPairing(hash: string, allowedOrigins: readonly string[]): BrainPairing | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const origin = params.get('brainOrigin');
  const nonce = params.get('brainNonce');
  if (!origin || !validOrigin(origin) || !allowedOrigins.includes(origin) || !nonce || !/^[a-f0-9]{32,128}$/.test(nonce)) return null;
  return { origin, nonce };
}
/** Call from a user click. Popup grants no control access until the peer enables it. */
export function openBrainPeer(peerUrl: string): BrainPairing & { peerWindow: Window } {
  const target = new URL(peerUrl);
  if (!validOrigin(target.origin)) throw new Error('Use an HTTPS or loopback VideoBrain URL.');
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(24)), value => value.toString(16).padStart(2, '0')).join('');
  target.hash = new URLSearchParams({ brainOrigin: window.location.origin, brainNonce: nonce }).toString();
  const peerWindow = window.open(target.href, '_blank');
  if (!peerWindow) throw new Error('Allow the VideoBrain window to open, then try pairing again.');
  return { origin: target.origin, nonce, peerWindow };
}
