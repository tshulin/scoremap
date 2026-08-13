// Offline tests for the blind relay: pure guards + a local piping/backpressure
// round-trip against a fake TCP server (no network, no portal, deterministic).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { WebSocket } from 'ws';
import { isHostAllowed, isOriginAllowed, ConnectionLimiter, startRelay } from './relay.mjs';

test('host allowlist accepts only <label>.edupoint.com', () => {
	assert.equal(isHostAllowed('ca-pleas-psv.edupoint.com'), true);
	for (const bad of [
		'evil.com',
		'edupoint.com.evil.com',
		'notedupoint.com',
		'internal.local',
		'edupoint.com',
		'',
		null,
		undefined
	]) {
		assert.equal(isHostAllowed(bad), false, `should reject ${JSON.stringify(bad)}`);
	}
});

test('origin allowlist: null allows any, array is exact-match', () => {
	assert.equal(isOriginAllowed('https://anything', null), true);
	const allow = ['https://tshulin.github.io'];
	assert.equal(isOriginAllowed('https://tshulin.github.io', allow), true);
	assert.equal(isOriginAllowed('https://evil.example', allow), false);
	assert.equal(isOriginAllowed(undefined, allow), false);
});

test('ConnectionLimiter caps concurrency and releases; IPs are independent', () => {
	// Rate window large so only the concurrency cap is exercised here.
	const c = new ConnectionLimiter({ windowMs: 1000, maxPerWindow: 100, maxConcurrent: 2 });
	assert.equal(c.tryAcquire('ip', 0), null);
	assert.equal(c.tryAcquire('ip', 0), null);
	assert.equal(c.tryAcquire('ip', 0), 'too many connections');
	c.release('ip');
	assert.equal(c.tryAcquire('ip', 0), null); // slot freed
	assert.equal(c.tryAcquire('ip2', 0), null); // a different IP has its own budget
});

test('ConnectionLimiter rate-limits per window and slides', () => {
	// Concurrency large so only the rate limit is exercised here.
	const r = new ConnectionLimiter({ windowMs: 1000, maxPerWindow: 3, maxConcurrent: 100 });
	assert.equal(r.tryAcquire('ip', 0), null); // 1
	assert.equal(r.tryAcquire('ip', 0), null); // 2
	assert.equal(r.tryAcquire('ip', 0), null); // 3
	assert.equal(r.tryAcquire('ip', 0), 'rate limit'); // 4th within the window
	assert.equal(r.tryAcquire('ip', 2000), null); // window has slid past the first 4
});

// --- local piping integration (fake TCP server stands in for the portal) ---

function once(emitter, event) {
	return new Promise((res) => emitter.once(event, (...args) => res(args)));
}

test('pipes bytes both ways for an allowed host', async () => {
	// Fake upstream echo (upper-cases input).
	const echo = net.createServer((sock) =>
		sock.on('data', (d) => sock.write(Buffer.from(d.toString().toUpperCase())))
	);
	await new Promise((res) => echo.listen(0, '127.0.0.1', res));
	const echoPort = echo.address().port;

	const PORT = 8790;
	const relay = startRelay({
		port: PORT,
		allowedHostRe: /^localhost$/,
		portalPort: echoPort
	});

	const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
	ws.binaryType = 'nodebuffer';
	await once(ws, 'open');
	ws.send(JSON.stringify({ host: 'localhost' }));

	const got = await new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error('no echo')), 3000);
		let sawOk = false;
		ws.on('message', (data, isBinary) => {
			if (!sawOk) {
				sawOk = JSON.parse(data.toString()).ok === true;
				if (sawOk) ws.send(Buffer.from('hello'), { binary: true });
				return;
			}
			if (isBinary) {
				clearTimeout(timer);
				resolve(data.toString());
			}
		});
	});
	assert.equal(got, 'HELLO');

	ws.close();
	await relay.close();
	echo.close();
});

test('rejects a disallowed host with close code 1008', async () => {
	const PORT = 8791;
	const relay = startRelay({ port: PORT, allowedHostRe: /^localhost$/, portalPort: 9 });
	const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
	await once(ws, 'open');
	ws.send(JSON.stringify({ host: 'evil.com' }));
	const [code] = await once(ws, 'close');
	assert.equal(code, 1008);
	await relay.close();
});

test('rejects a disallowed Origin with close code 1008', async () => {
	const PORT = 8792;
	const relay = startRelay({
		port: PORT,
		allowedOrigins: ['https://good.example'],
		allowedHostRe: /^localhost$/,
		portalPort: 9
	});
	const ws = new WebSocket(`ws://127.0.0.1:${PORT}`, { origin: 'https://evil.example' });
	const [code] = await once(ws, 'close');
	assert.equal(code, 1008);
	await relay.close();
});
