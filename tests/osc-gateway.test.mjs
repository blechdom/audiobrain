import assert from 'node:assert/strict';
import { createSocket } from 'node:dgram';
import { once } from 'node:events';
import test from 'node:test';
import { WebSocket } from 'ws';
import { decodeOscFloat, encodeOscFloat, startOscGateway } from '../server/osc-gateway.mjs';

test('OSC scalar codec rejects bundles, nonfinite floats and invalid addresses', () => {
  const encoded = encodeOscFloat('/audiobrain/control', 0.625);
  assert.deepEqual(decodeOscFloat(encoded), { protocol: 'audiobrain.osc.v1', address: '/audiobrain/control', args: [{ type: 'f', value: 0.625 }] });
  assert.equal(decodeOscFloat(Buffer.from('#bundle\0')), null);
  assert.throws(() => encodeOscFloat('/test', Infinity));
  assert.throws(() => encodeOscFloat('not-an-address', 1));
  assert.equal(decodeOscFloat(Buffer.concat([encoded, Buffer.alloc(4)])), null);
});

test('loopback gateway exchanges real UDP and WebSocket messages and rejects another origin', { timeout: 5000 }, async () => {
  const receiver = createSocket('udp4');
  receiver.bind(0, '127.0.0.1'); await once(receiver, 'listening');
  const gateway = await startOscGateway({ port: 0, listenPort: 0, targetPort: receiver.address().port });
  const client = new WebSocket(`ws://127.0.0.1:${gateway.port}`, { origin: 'http://127.0.0.1:5178' });
  try {
    await once(client, 'open');
    const packetPromise = once(receiver, 'message');
    client.send(JSON.stringify({ protocol: 'audiobrain.osc.v1', address: '/test', args: [{ type: 'f', value: 0.25 }] }));
    const [packet] = await packetPromise;
    assert.equal(decodeOscFloat(packet).args[0].value, 0.25);
    const messagePromise = once(client, 'message');
    receiver.send(encodeOscFloat('/return', 0.75), gateway.listenPort, '127.0.0.1');
    const [response] = await messagePromise;
    assert.equal(JSON.parse(response.toString()).args[0].value, 0.75);
    const rejected = new WebSocket(`ws://127.0.0.1:${gateway.port}`, { origin: 'https://unapproved.example' });
    const [error] = await once(rejected, 'error');
    assert.match(error.message, /403/);
  } finally { client.terminate(); receiver.close(); await gateway.close(); }
});
