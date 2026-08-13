import { beforeEach, describe, expect, it, vi } from 'vitest';

// The relay/TLS layer is replaced by an in-memory HTTP server per connection, so
// these tests exercise the framing, pooling and retry logic directly.
const hoisted = vi.hoisted(() => ({ open: null }));
vi.mock('./relayTls.js', () => ({
	openTlsThroughRelay: (relayUrl, host, opts) => hoisted.open(relayUrl, host, opts)
}));

const { createRelayFetch } = await import('./fetchShim.js');

const enc = new TextEncoder();
const latin1 = new TextDecoder('latin1');

function bytes(parts) {
	let len = 0;
	for (const p of parts) len += p.length;
	const out = new Uint8Array(len);
	let off = 0;
	for (const p of parts) {
		out.set(p, off);
		off += p.length;
	}
	return out;
}

function headerEnd(buf) {
	for (let i = 0; i < buf.length - 3; i++) {
		if (buf[i] === 0x0d && buf[i + 1] === 0x0a && buf[i + 2] === 0x0d && buf[i + 3] === 0x0a) return i;
	}
	return -1;
}

function encodeResponse({ status = 200, headers = {}, body = '', chunked = false, noLength = false }) {
	const payload = typeof body === 'string' ? enc.encode(body) : body;
	const lines = [`HTTP/1.1 ${status} Status`];
	for (const [k, v] of Object.entries(headers)) {
		for (const one of Array.isArray(v) ? v : [v]) lines.push(`${k}: ${one}`);
	}

	let framed;
	if (chunked) {
		lines.push('Transfer-Encoding: chunked');
		if (payload.length === 0) {
			framed = enc.encode('0\r\n\r\n');
		} else {
			// Two chunks, so the reader has to reassemble across chunk boundaries.
			const mid = Math.ceil(payload.length / 2);
			framed = bytes([
				enc.encode(`${mid.toString(16)}\r\n`),
				payload.subarray(0, mid),
				enc.encode('\r\n'),
				enc.encode(`${(payload.length - mid).toString(16)}\r\n`),
				payload.subarray(mid),
				enc.encode('\r\n0\r\n\r\n')
			]);
		}
	} else {
		if (!noLength) lines.push(`Content-Length: ${payload.length}`);
		framed = payload;
	}

	return bytes([enc.encode(`${lines.join('\r\n')}\r\n\r\n`), framed]);
}

// One fake connection = one HTTP/1.1 server that answers requests in order.
function createFakeConn(index, respond) {
	let inbox = new Uint8Array(0);
	const outbox = [];
	let waiter = null;
	let dead = false;
	let parsing = false;
	let seen = 0;

	const conn = { index, closed: false, requests: [], cert: null };

	const pump = () => {
		if (!waiter) return;
		if (outbox.length > 0) {
			const w = waiter;
			waiter = null;
			w(outbox.shift());
		} else if (dead) {
			const w = waiter;
			waiter = null;
			w(undefined);
		}
	};

	const parse = async () => {
		if (parsing) return;
		parsing = true;
		try {
			for (;;) {
				const at = headerEnd(inbox);
				if (at === -1) return;
				const head = latin1.decode(inbox.subarray(0, at));
				const cl = /content-length:\s*(\d+)/i.exec(head);
				const need = at + 4 + (cl ? Number(cl[1]) : 0);
				if (inbox.length < need) return;

				const request = { head, body: latin1.decode(inbox.subarray(at + 4, need)), index: seen++ };
				inbox = inbox.subarray(need);
				conn.requests.push(request);

				const spec = await respond(request, conn);
				if (spec === 'die') {
					dead = true;
					pump();
					return;
				}
				outbox.push(spec instanceof Uint8Array ? spec : encodeResponse(spec));
				pump();
			}
		} finally {
			parsing = false;
		}
	};

	conn.read = () =>
		new Promise((resolve) => {
			waiter = resolve;
			pump();
		});
	conn.write = async (data) => {
		if (dead) return;
		inbox = bytes([inbox, data]);
		void parse();
	};
	conn.close = () => {
		conn.closed = true;
		dead = true;
		pump();
	};
	return conn;
}

let opened;
let respond;

function install({ onOpen } = {}) {
	hoisted.open = async (_relayUrl, host) => {
		if (onOpen) await onOpen(opened.length);
		const conn = createFakeConn(opened.length, respond);
		conn.host = host;
		opened.push(conn);
		return conn;
	};
}

beforeEach(() => {
	opened = [];
	respond = () => ({ body: 'ok' });
	install();
});

const URL_A = 'https://ca-test-psv.edupoint.com/PXP2_Student.aspx?AGU=0';

describe('createRelayFetch', () => {
	it('requires a relay URL', () => {
		expect(() => createRelayFetch({})).toThrow(/requires a relayUrl/);
	});

	it('reuses one connection across sequential requests', async () => {
		const relayFetch = createRelayFetch({ relayUrl: 'ws://relay' });

		for (let i = 0; i < 5; i++) {
			const response = await relayFetch(URL_A, {});
			expect(await response.text()).toBe('ok');
		}

		// The whole point: five requests, one relay connection (one WebSocket,
		// one TLS handshake) instead of five.
		expect(opened).toHaveLength(1);
		expect(opened[0].requests).toHaveLength(5);
		expect(opened[0].requests[0].head).toMatch(/Connection: keep-alive/);
	});

	it('sends the request line, host and body the portal expects', async () => {
		const relayFetch = createRelayFetch({ relayUrl: 'ws://relay' });
		await relayFetch('https://ca-test-psv.edupoint.com/st_api/ST.Messaging/GetMessages?PORTAL=3', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: 'PVUE=1' },
			body: 'data=%7B%7D'
		});

		const { head, body } = opened[0].requests[0];
		expect(head.split('\r\n')[0]).toBe('POST /st_api/ST.Messaging/GetMessages?PORTAL=3 HTTP/1.1');
		expect(head).toMatch(/Host: ca-test-psv\.edupoint\.com/);
		expect(head).toMatch(/Content-Length: 11/);
		expect(head).toMatch(/Cookie: PVUE=1/);
		expect(body).toBe('data=%7B%7D');
	});

	it('reads a chunked response and stays aligned for the next one', async () => {
		const pages = ['<html>first</html>', '<html>second</html>'];
		respond = (req) => ({ chunked: true, body: pages[req.index] });
		const relayFetch = createRelayFetch({ relayUrl: 'ws://relay' });

		expect(await (await relayFetch(URL_A, {})).text()).toBe(pages[0]);
		// A misframed first body would corrupt this one - that is the failure
		// mode keep-alive introduces, so it is the thing worth asserting.
		expect(await (await relayFetch(URL_A, {})).text()).toBe(pages[1]);
		expect(opened).toHaveLength(1);
	});

	it('exposes every Set-Cookie separately', async () => {
		respond = () => ({
			status: 302,
			headers: { 'Set-Cookie': ['PVUE=abc; Path=/', 'ASP.NET_SessionId=xyz; HttpOnly'], Location: '/Home_PXP2.aspx' }
		});
		const relayFetch = createRelayFetch({ relayUrl: 'ws://relay' });
		const response = await relayFetch(URL_A, {});

		expect(response.status).toBe(302);
		expect(response.ok).toBe(false);
		expect(response.headers.get('location')).toBe('/Home_PXP2.aspx');
		expect(response.headers.getSetCookie()).toEqual([
			'PVUE=abc; Path=/',
			'ASP.NET_SessionId=xyz; HttpOnly'
		]);
	});

	it('returns binary bodies intact', async () => {
		const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0x0d, 0x0a, 0x1a]);
		respond = () => ({ headers: { 'Content-Type': 'application/pdf' }, body: pdf });
		const relayFetch = createRelayFetch({ relayUrl: 'ws://relay' });

		const buffer = await (await relayFetch(URL_A, {})).arrayBuffer();
		expect(new Uint8Array(buffer)).toEqual(pdf);
	});

	it('never opens more connections than the pool allows', async () => {
		const gate = [];
		respond = (req) => new Promise((resolve) => gate.push(() => resolve({ body: `r${req.index}` })));
		const relayFetch = createRelayFetch({ relayUrl: 'ws://relay', maxConnections: 4 });

		const inFlight = Array.from({ length: 12 }, () => relayFetch(URL_A, {}));
		await vi.waitFor(() => expect(gate.length).toBe(4));
		// Twelve concurrent requests, and the relay only ever sees four sockets -
		// its per-IP concurrency cap can no longer be tripped by fanning out.
		expect(opened).toHaveLength(4);

		for (let i = 0; i < 12; i++) {
			await vi.waitFor(() => expect(gate.length).toBeGreaterThan(i));
			gate[i]();
		}
		const responses = await Promise.all(inFlight);
		expect(responses).toHaveLength(12);
		expect(opened).toHaveLength(4);
	});

	it('retries on a fresh connection when a pooled one has gone away', async () => {
		// The connection accepts the first request and is dead by the second -
		// exactly what an idle keep-alive socket dropped by the portal looks like.
		respond = (req, conn) => (conn.index === 0 && req.index === 1 ? 'die' : { body: `c${conn.index}` });
		const relayFetch = createRelayFetch({ relayUrl: 'ws://relay' });

		expect(await (await relayFetch(URL_A, {})).text()).toBe('c0');
		expect(await (await relayFetch(URL_A, {})).text()).toBe('c1');
		expect(opened).toHaveLength(2);
		expect(opened[0].closed).toBe(true);
	});

	it('does not replay a request the portal already started answering', async () => {
		// A truncated response means the request WAS processed; retrying it could
		// repeat a side effect, so the failure has to surface instead.
		respond = () => bytes([enc.encode('HTTP/1.1 200 Status\r\nContent-Length: 50\r\n\r\nonly-a-few')]);
		const relayFetch = createRelayFetch({ relayUrl: 'ws://relay' });
		const first = relayFetch(URL_A, {});
		// The fake never closes on its own, so end the stream to force the failure.
		await vi.waitFor(() => expect(opened).toHaveLength(1));
		await vi.waitFor(() => expect(opened[0].requests).toHaveLength(1));
		opened[0].close();

		await expect(first).rejects.toThrow(/closed mid-response/);
		expect(opened).toHaveLength(1);
	});

	it('drops the connection when the portal says Connection: close', async () => {
		respond = (req, conn) => ({ headers: { Connection: 'close' }, body: `c${conn.index}` });
		const relayFetch = createRelayFetch({ relayUrl: 'ws://relay' });

		await relayFetch(URL_A, {});
		await relayFetch(URL_A, {});
		expect(opened).toHaveLength(2);
		expect(opened[0].closed).toBe(true);
	});

	it('drops the connection when a body is delimited by EOF', async () => {
		respond = (req, conn) => ({ noLength: conn.index === 0, body: `c${conn.index}` });
		const relayFetch = createRelayFetch({ relayUrl: 'ws://relay' });

		const pending = relayFetch(URL_A, {});
		await vi.waitFor(() => expect(opened[0]?.requests).toHaveLength(1));
		opened[0].close(); // an unframed body ends only when the peer hangs up
		expect(await (await pending).text()).toBe('c0');

		expect(await (await relayFetch(URL_A, {})).text()).toBe('c1');
		expect(opened).toHaveLength(2);
	});

	it('retires a connection that sat idle too long instead of reusing it', async () => {
		let clock = 0;
		const relayFetch = createRelayFetch({
			relayUrl: 'ws://relay',
			idleCloseMs: 15_000,
			now: () => clock
		});

		await relayFetch(URL_A, {});
		clock = 14_000;
		await relayFetch(URL_A, {});
		expect(opened).toHaveLength(1); // still fresh enough to reuse

		clock = 40_000;
		await relayFetch(URL_A, {});
		expect(opened).toHaveLength(2);
		expect(opened[0].closed).toBe(true);
	});

	// An idle connection holds one of the relay's per-IP slots until something
	// closes it. Waiting for the next request to notice is not good enough: a
	// student who stops clicking must stop occupying the school's slots.
	describe('idle connections are closed, not just skipped', () => {
		// A manual scheduler, driven alongside the injected clock so the timer and
		// `now()` can never disagree.
		function fakeScheduler() {
			let timers = [];
			let clock = 0;
			return {
				now: () => clock,
				setTimer: (fn, ms) => {
					const timer = { at: clock + ms, fn };
					timers.push(timer);
					return timer;
				},
				advance(ms) {
					clock += ms;
					const due = timers.filter((t) => t.at <= clock);
					timers = timers.filter((t) => t.at > clock);
					for (const t of due) t.fn();
				},
				pending: () => timers.length
			};
		}

		it('closes an idle connection on its own, with no further requests', async () => {
			const s = fakeScheduler();
			const relayFetch = createRelayFetch({
				relayUrl: 'ws://relay',
				idleCloseMs: 15_000,
				now: s.now,
				setTimer: s.setTimer
			});

			await relayFetch(URL_A, {});
			expect(opened[0].closed).toBe(false);
			expect(relayFetch.stats()).toEqual({ live: 1, idle: 1 });

			s.advance(14_000);
			expect(opened[0].closed).toBe(false); // still inside the reuse window

			s.advance(2_000);
			// Nothing asked for a connection - the pool closed it by itself.
			expect(opened[0].closed).toBe(true);
			expect(relayFetch.stats()).toEqual({ live: 0, idle: 0 });
		});

		it('closes every idle connection a burst left behind', async () => {
			const s = fakeScheduler();
			let release;
			const gate = new Promise((resolve) => {
				release = resolve;
			});
			respond = async () => {
				await gate;
				return { body: 'ok' };
			};
			const relayFetch = createRelayFetch({
				relayUrl: 'ws://relay',
				maxConnections: 2,
				idleCloseMs: 15_000,
				now: s.now,
				setTimer: s.setTimer
			});

			const burst = [relayFetch(URL_A, {}), relayFetch(URL_A, {})];
			await vi.waitFor(() => expect(opened).toHaveLength(2));
			release();
			await Promise.all(burst);
			expect(relayFetch.stats()).toEqual({ live: 2, idle: 2 });

			s.advance(16_000);
			expect(opened.every((c) => c.closed)).toBe(true);
			expect(relayFetch.stats()).toEqual({ live: 0, idle: 0 });
		});

		it('keeps a connection that was used again inside the window', async () => {
			const s = fakeScheduler();
			const relayFetch = createRelayFetch({
				relayUrl: 'ws://relay',
				idleCloseMs: 15_000,
				now: s.now,
				setTimer: s.setTimer
			});

			await relayFetch(URL_A, {});
			s.advance(10_000);
			await relayFetch(URL_A, {}); // resets the idle clock
			expect(opened).toHaveLength(1);

			s.advance(10_000); // 20s since the first use, 10s since the second
			expect(opened[0].closed).toBe(false);

			s.advance(6_000);
			expect(opened[0].closed).toBe(true);
		});

		it('arms no timer while the pool is empty', async () => {
			const s = fakeScheduler();
			const relayFetch = createRelayFetch({
				relayUrl: 'ws://relay',
				idleCloseMs: 15_000,
				now: s.now,
				setTimer: s.setTimer
			});

			expect(s.pending()).toBe(0);
			await relayFetch(URL_A, {});
			expect(s.pending()).toBe(1);

			s.advance(16_000);
			// Swept clean, and nothing left to wake up for.
			expect(s.pending()).toBe(0);
		});
	});

	it('holds at most two connections by default', async () => {
		let release;
		const gate = new Promise((resolve) => {
			release = resolve;
		});
		respond = async (req, conn) => {
			await gate;
			return { body: `c${conn.index}` };
		};
		const relayFetch = createRelayFetch({ relayUrl: 'ws://relay' });

		const all = Array.from({ length: 8 }, () => relayFetch(URL_A, {}));
		await vi.waitFor(() => expect(opened.length).toBeGreaterThan(0));
		// The default cap is what bounds a tab's share of the school's relay slots.
		expect(opened).toHaveLength(2);

		release();
		await Promise.all(all);
		expect(opened).toHaveLength(2);
	});

	it('honours an abort signal instead of hanging forever', async () => {
		respond = () => new Promise(() => {}); // a portal that never answers
		const relayFetch = createRelayFetch({ relayUrl: 'ws://relay' });
		const controller = new AbortController();

		const pending = relayFetch(URL_A, { signal: controller.signal });
		await vi.waitFor(() => expect(opened).toHaveLength(1));
		controller.abort(new DOMException('timed out', 'TimeoutError'));

		await expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
		// The stream is mid-response, so the connection must not go back in the pool.
		expect(opened[0].closed).toBe(true);
		expect(relayFetch.stats()).toEqual({ live: 0, idle: 0 });
	});

	it('does not leak a pool slot when a queued request is aborted', async () => {
		// The acquire cannot be cancelled, so the connection it hands over after
		// the caller has given up must still be returned to the pool. Leaking it
		// would shrink the pool by one on every timeout until nothing could run.
		const gate = [];
		let answered = 0;
		respond = () => {
			const label = `r${answered++}`;
			return new Promise((resolve) => gate.push(() => resolve({ body: label })));
		};
		const relayFetch = createRelayFetch({ relayUrl: 'ws://relay', maxConnections: 1 });
		const controller = new AbortController();

		const first = relayFetch(URL_A, {});
		await vi.waitFor(() => expect(gate).toHaveLength(1));
		const queued = relayFetch(URL_A, { signal: controller.signal });
		await new Promise((resolve) => setTimeout(resolve, 10));

		controller.abort(new DOMException('timed out', 'TimeoutError'));
		await expect(queued).rejects.toMatchObject({ name: 'TimeoutError' });

		gate[0]();
		expect(await (await first).text()).toBe('r0');
		await vi.waitFor(() => expect(relayFetch.stats().live).toBe(0));

		const third = relayFetch(URL_A, {});
		await vi.waitFor(() => expect(gate).toHaveLength(2));
		gate[1]();
		expect(await (await third).text()).toBe('r1');
	});

	it('releases its pool slot when opening a connection fails', async () => {
		let attempts = 0;
		install({
			onOpen: () => {
				if (++attempts <= 2) throw new Error('relay connection failed');
			}
		});
		const relayFetch = createRelayFetch({ relayUrl: 'ws://relay', maxConnections: 1 });

		await expect(relayFetch(URL_A, {})).rejects.toThrow(/relay connection failed/);
		await expect(relayFetch(URL_A, {})).rejects.toThrow(/relay connection failed/);
		// A leaked slot would make this third call wait forever instead of trying.
		expect(await (await relayFetch(URL_A, {})).text()).toBe('ok');
	});
});
