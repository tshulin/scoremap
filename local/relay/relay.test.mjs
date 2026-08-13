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

test('a denied attempt does not extend its own rate window', () => {
	// Recording every ATTEMPT let a client retrying in a loop keep pushing its
	// window forward, so it could never fall back under the limit.
	const r = new ConnectionLimiter({ windowMs: 1000, maxPerWindow: 2, maxConcurrent: 100 });
	assert.equal(r.tryAcquire('ip', 0), null);
	assert.equal(r.tryAcquire('ip', 0), null);

	// Hammer it well past the window with rejected attempts.
	for (let t = 100; t <= 900; t += 100) assert.equal(r.tryAcquire('ip', t), 'rate limit');

	// The two ACCEPTED connections at t=0 have now aged out, so the client is
	// allowed again — the retries must not have counted.
	assert.equal(r.tryAcquire('ip', 1001), null);
});

test('a connection refused for concurrency does not spend rate budget', () => {
	const r = new ConnectionLimiter({ windowMs: 1000, maxPerWindow: 3, maxConcurrent: 1 });
	assert.equal(r.tryAcquire('ip', 0), null);
	assert.equal(r.tryAcquire('ip', 0), 'too many connections');
	assert.equal(r.tryAcquire('ip', 0), 'too many connections');
	r.release('ip');
	// Only the first attempt was ever recorded, so two of three remain.
	assert.equal(r.tryAcquire('ip', 0), null);
	assert.equal(r.tryAcquire('ip', 0), 'too many connections');
});

test('ConnectionLimiter caps total concurrency across all IPs', () => {
	const c = new ConnectionLimiter({
		windowMs: 1000,
		maxPerWindow: 100,
		maxConcurrent: 2,
		maxTotalConcurrent: 3
	});
	assert.equal(c.tryAcquire('a', 0), null);
	assert.equal(c.tryAcquire('a', 0), null);
	assert.equal(c.tryAcquire('b', 0), null); // 3 total
	// 'b' is well within its own budget; the relay itself is full.
	assert.equal(c.tryAcquire('b', 0), 'relay at capacity');
	assert.equal(c.tryAcquire('c', 0), 'relay at capacity');
	assert.deepEqual(c.stats(), { total: 3, ips: 2, tracked: 2 });

	c.release('a');
	assert.equal(c.tryAcquire('c', 0), null);
});

test('a misbehaving IP is named as such even when the relay is full', () => {
	// Otherwise one abusive client's log lines read as "the relay is busy".
	const c = new ConnectionLimiter({
		windowMs: 1000,
		maxPerWindow: 100,
		maxConcurrent: 1,
		maxTotalConcurrent: 1
	});
	assert.equal(c.tryAcquire('hog', 0), null);
	assert.equal(c.tryAcquire('hog', 0), 'too many connections');
	assert.equal(c.tryAcquire('other', 0), 'relay at capacity');
});

test('releasing frees a global slot exactly once', () => {
	const c = new ConnectionLimiter({ maxPerWindow: 100, maxConcurrent: 5, maxTotalConcurrent: 2 });
	assert.equal(c.tryAcquire('a', 0), null);
	c.release('a');
	c.release('a'); // a stray double-release must not create capacity
	c.release('nobody');
	assert.equal(c.stats().total, 0);

	assert.equal(c.tryAcquire('a', 0), null);
	assert.equal(c.tryAcquire('b', 0), null);
	assert.equal(c.tryAcquire('c', 0), 'relay at capacity');
});

test('a returning IP does not accumulate stale timestamps', () => {
	// The window must prune, not grow, or a long-lived client eventually trips a
	// limit it never actually exceeded.
	const c = new ConnectionLimiter({ windowMs: 1000, maxPerWindow: 3, maxConcurrent: 5 });
	for (let t = 0; t <= 20_000; t += 2000) {
		assert.equal(c.tryAcquire('ip', t), null, `reconnect at t=${t}`);
		c.release('ip');
	}
	assert.equal(c.stats().tracked, 1);
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
