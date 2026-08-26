// HTTP/1.1 over the TLS-through-relay stream. Produces a `fetch`-shaped function
// the portal client can use as its injectable transport (see ../portal/http.ts).
//
// It does what a browser fetch cannot cross-origin: read every Set-Cookie and
// leave redirects to the caller (the portal client follows them manually).
//
// Connections are POOLED AND REUSED (HTTP keep-alive). Every TLS connection is
// one WebSocket at the relay, and the relay caps both concurrent connections and
// connections per minute per client IP. One request per connection made a single
// sync cost ~14 of them - over the concurrency cap and half the per-minute
// budget - so mail requests failed and took student info down with them. Reuse
// turns a sync into a handful of connections, and the pool size is the app's
// global ceiling on how many it can ever hold open at once.
//
// The cost of sharing a connection: a response body must be framed exactly
// (Content-Length or chunked) so the stream is left positioned at the start of
// the next response. Reading to EOF is only valid for a connection we then drop.

import { openTlsThroughRelay } from './relayTls.js';

const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Per-POOL cap, and the app now runs one pool per relay (see relayRouter.js),
// so a dual-relay build can hold up to twice this many. The deployed relays
// allow 64 concurrent per IP - the number here stays small anyway because a
// whole school shares one public IP behind NAT, and idle pooled connections
// still occupy relay slots. 3 covers the gradebook landing page plus a full
// wave of class-detail requests without queueing.
const MAX_CONNECTIONS = 3;

// An idle pooled connection is worth keeping for the next request in a burst,
// and worth nothing after that - but it still occupies one of the relay's
// per-IP slots until somebody closes it. So they are CLOSED on this timer, not
// merely skipped when stale: waiting for the relay's own idle timeout (120s)
// meant one student parked slots for two minutes after they stopped clicking.
const IDLE_CLOSE_MS = 15_000;

const utf8 = new TextEncoder();
const latin1 = new TextDecoder('latin1');

// Node keeps a process alive for a pending timer. A pool sweep must never do
// that, or a CLI script (and every test run) would hang on an idle connection.
const defaultSetTimer = (fn, ms) => {
	const id = setTimeout(fn, ms);
	if (id && typeof id === 'object' && typeof id.unref === 'function') id.unref();
	return id;
};

function concat(parts) {
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

// Index of a 2-byte needle (e.g. CRLF) in a Uint8Array, from `start`.
function indexOf2(buf, b0, b1, start = 0) {
	for (let i = start; i < buf.length - 1; i++) {
		if (buf[i] === b0 && buf[i + 1] === b1) return i;
	}
	return -1;
}

// Find the CRLFCRLF that ends the header block.
function indexOfHeaderEnd(buf) {
	for (let i = 0; i < buf.length - 3; i++) {
		if (buf[i] === 0x0d && buf[i + 1] === 0x0a && buf[i + 2] === 0x0d && buf[i + 3] === 0x0a) return i;
	}
	return -1;
}

const findCrlf = (buf) => indexOf2(buf, 0x0d, 0x0a);

async function decompress(buf, encoding) {
	const format = encoding.includes('gzip') ? 'gzip' : encoding.includes('deflate') ? 'deflate' : null;
	if (!format) return buf;
	const stream = new Response(buf).body.pipeThrough(new DecompressionStream(format));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

// A buffered byte stream over one TLS connection, read across many responses.
// `received` is how many bytes the peer has ever sent, which is what tells a
// dead pooled connection (nothing at all) from a real mid-response failure.
function makeReader(conn) {
	let buf = new Uint8Array(0);
	let eof = false;
	let received = 0;

	const pull = async () => {
		if (eof) return false;
		const chunk = await conn.read();
		if (chunk === undefined) {
			eof = true;
			return false;
		}
		if (chunk.length === 0) return true;
		received += chunk.length;
		buf = buf.length === 0 ? chunk : concat([buf, chunk]);
		return true;
	};

	const consume = (n) => {
		const out = buf.subarray(0, n);
		buf = buf.subarray(n);
		return out;
	};

	return {
		received: () => received,
		// Grow the buffer until `locate` finds something; -1 if the peer hung up first.
		async find(locate) {
			for (;;) {
				const at = locate(buf);
				if (at !== -1) return at;
				if (!(await pull())) return -1;
			}
		},
		consume,
		async exactly(n) {
			while (buf.length < n) {
				if (!(await pull())) throw new Error('the connection closed mid-response');
			}
			return consume(n);
		},
		async toEnd() {
			while (await pull());
			return consume(buf.length);
		}
	};
}

async function readHead(reader) {
	const at = await reader.find(indexOfHeaderEnd);
	if (at === -1) throw new Error('malformed HTTP response (no header terminator)');
	const headerText = latin1.decode(reader.consume(at + 4).subarray(0, at));

	const lines = headerText.split('\r\n');
	const status = Number(lines[0].split(' ')[1]);
	const map = new Map(); // lower-name -> combined value
	const setCookies = [];
	for (const line of lines.slice(1)) {
		const i = line.indexOf(':');
		if (i === -1) continue;
		const name = line.slice(0, i).trim();
		const value = line.slice(i + 1).trim();
		if (name.toLowerCase() === 'set-cookie') {
			setCookies.push(value);
			continue;
		}
		const key = name.toLowerCase();
		map.set(key, map.has(key) ? `${map.get(key)}, ${value}` : value);
	}
	return { status, map, setCookies };
}

async function readChunked(reader) {
	const parts = [];
	for (;;) {
		const nl = await reader.find(findCrlf);
		if (nl === -1) throw new Error('the connection closed inside a chunk header');
		const header = latin1.decode(reader.consume(nl + 2));
		const size = parseInt(header.trim().split(';')[0], 16); // ignore chunk extensions
		if (!Number.isFinite(size) || size < 0) throw new Error('malformed chunk size');
		if (size === 0) break;
		parts.push(await reader.exactly(size));
		await reader.exactly(2); // the CRLF that ends every chunk
	}
	// Optional trailer headers, then the blank line that ends the message.
	for (;;) {
		const nl = await reader.find(findCrlf);
		if (nl === -1) break;
		if (reader.consume(nl + 2).length === 2) break;
	}
	return concat(parts);
}

const bodiless = (status, method) =>
	method === 'HEAD' || status === 204 || status === 304 || (status >= 100 && status < 200);

// `framed` is false only when the body's end is the connection's end, which
// makes the connection unusable for anything after it.
async function readBody(reader, status, map, method) {
	if (bodiless(status, method)) return { bytes: new Uint8Array(0), framed: true };

	if ((map.get('transfer-encoding') || '').toLowerCase().includes('chunked')) {
		return { bytes: await readChunked(reader), framed: true };
	}

	const length = map.get('content-length');
	if (length !== undefined) {
		const n = Number(length);
		if (!Number.isInteger(n) || n < 0) {
			throw new Error(`invalid Content-Length ${JSON.stringify(length)}`);
		}
		return { bytes: await reader.exactly(n), framed: true };
	}

	return { bytes: await reader.toEnd(), framed: false };
}

function makeResponse(url, status, map, setCookies, body) {
	const headers = {
		get: (name) => {
			const key = String(name).toLowerCase();
			if (key === 'set-cookie') return setCookies.length ? setCookies.join(', ') : null;
			return map.has(key) ? map.get(key) : null;
		},
		getSetCookie: () => setCookies.slice()
	};

	return {
		url,
		status,
		ok: status >= 200 && status < 300,
		headers,
		text: async () => new TextDecoder().decode(body),
		arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)
	};
}

function buildRequest(u, init) {
	const method = init.method || 'GET';
	const path = (u.pathname || '/') + (u.search || '');
	const body = init.body == null ? null : utf8.encode(init.body);

	const headers = {
		Host: u.hostname,
		'User-Agent': USER_AGENT,
		Accept: '*/*',
		// identity keeps response framing simple; the portal's pages are small.
		'Accept-Encoding': 'identity',
		Connection: 'keep-alive',
		...(init.headers || {})
	};
	if (body !== null) headers['Content-Length'] = String(body.length);

	const head =
		`${method} ${path} HTTP/1.1\r\n` +
		Object.entries(headers)
			.map(([k, v]) => `${k}: ${v}`)
			.join('\r\n') +
		'\r\n\r\n';

	return { method, head, body };
}

async function exchange(entry, url, { method, head, body }) {
	await entry.conn.write(utf8.encode(head));
	if (body !== null) await entry.conn.write(body);

	const { status, map, setCookies } = await readHead(entry.reader);
	const { bytes, framed } = await readBody(entry.reader, status, map, method);
	const decoded = await decompress(bytes, map.get('content-encoding') || '');
	const reusable = framed && !/(?:^|,\s*)close/i.test(map.get('connection') || '');

	return { response: makeResponse(url, status, map, setCookies, decoded), reusable };
}

// The pool is the app's global limit on concurrent relay connections: a request
// that cannot get one waits rather than opening another.
function createPool({
	relayUrl,
	WebSocketImpl,
	maxConnections,
	idleCloseMs,
	now = () => Date.now(),
	setTimer = defaultSetTimer
}) {
	const idle = new Map(); // host -> entry[], least-recently-used first
	const waiters = [];
	let live = 0;
	let sweepTimer = null;

	const wake = () => {
		const next = waiters.shift();
		if (next) next();
	};

	const retire = (entry) => {
		live--;
		try {
			entry.close();
		} catch {
			/* already closing */
		}
	};

	// Closes every connection that has been idle past its welcome, then re-arms
	// for whichever one expires next. Nothing is scheduled while the pool is
	// empty, so an idle app holds no timer and no sockets.
	const sweep = () => {
		sweepTimer = null;
		const cutoff = now() - idleCloseMs;
		for (const [host, list] of [...idle]) {
			while (list.length > 0 && list[0].lastUsed <= cutoff) retire(list.shift());
			if (list.length === 0) idle.delete(host);
		}
		schedule();
	};

	// Arms for the oldest idle entry. An entry taken back out of the pool before
	// its turn just makes the timer fire early - the sweep finds nothing due and
	// re-arms - so only `release` needs to schedule.
	const schedule = () => {
		if (sweepTimer !== null) return;
		let oldest = Infinity;
		for (const list of idle.values()) {
			if (list.length > 0 && list[0].lastUsed < oldest) oldest = list[0].lastUsed;
		}
		if (oldest === Infinity) return;
		sweepTimer = setTimer(sweep, Math.max(0, oldest + idleCloseMs - now()));
	};

	const takeIdle = (host) => {
		const list = idle.get(host);
		while (list && list.length > 0) {
			const entry = list.pop();
			if (now() - entry.lastUsed <= idleCloseMs) {
				entry.reused = true;
				return entry;
			}
			retire(entry);
		}
		return null;
	};

	// Only reachable with more than one host in play; without it a waiter for
	// host B could sleep forever behind connections idling on host A.
	const freeSlot = () => {
		for (const [host, list] of idle) {
			const entry = list.shift();
			if (!entry) {
				idle.delete(host);
				continue;
			}
			retire(entry);
			return true;
		}
		return false;
	};

	return {
		async acquire(host) {
			for (;;) {
				const reused = takeIdle(host);
				if (reused) return reused;

				if (live >= maxConnections && freeSlot()) continue;

				if (live < maxConnections) {
					live++;
					try {
						const conn = await openTlsThroughRelay(relayUrl, host, { WebSocketImpl });
						return {
							host,
							conn,
							reader: makeReader(conn),
							close: conn.close,
							lastUsed: now(),
							reused: false
						};
					} catch (e) {
						live--;
						wake();
						throw e;
					}
				}

				await new Promise((resolve) => waiters.push(resolve));
			}
		},

		release(entry) {
			entry.lastUsed = now();
			const list = idle.get(entry.host);
			if (list) list.push(entry);
			else idle.set(entry.host, [entry]);
			schedule();
			wake();
		},

		discard(entry) {
			retire(entry);
			wake();
		},

		stats: () => ({ live, idle: [...idle.values()].reduce((n, l) => n + l.length, 0) })
	};
}

const isAbort = (e) => !!e && (e.name === 'AbortError' || e.name === 'TimeoutError');

// The relay transport is not a browser fetch, so it has to honour the caller's
// AbortSignal itself - without this the per-hop timeout in portal/http.ts does
// nothing and a stalled connection hangs forever.
function abortable(promise, signal) {
	if (!signal) return promise;
	if (signal.aborted) return Promise.reject(signal.reason);
	return new Promise((resolve, reject) => {
		const onAbort = () => reject(signal.reason);
		signal.addEventListener('abort', onAbort, { once: true });
		promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
	});
}

// Waiting for a pool slot has to be interruptible, or a timeout could not fire
// while every connection is busy. The acquire itself cannot be cancelled, so
// whatever it eventually produces is handed straight back - otherwise an aborted
// request would leak a connection that is checked out but owned by nobody.
async function acquireFor(pool, host, signal) {
	const pending = pool.acquire(host);
	if (!signal) return pending;
	try {
		return await abortable(pending, signal);
	} catch (e) {
		pending.then(
			(entry) => pool.discard(entry),
			() => {}
		);
		throw e;
	}
}

// Build a fetch-shaped function bound to a relay URL. One pool per call, so the
// app's single shared instance (src/data/api.js) is what bounds concurrency.
export function createRelayFetch({
	relayUrl,
	WebSocketImpl,
	maxConnections = MAX_CONNECTIONS,
	idleCloseMs = IDLE_CLOSE_MS,
	now,
	setTimer
} = {}) {
	if (!relayUrl) throw new Error('createRelayFetch requires a relayUrl');
	const pool = createPool({
		relayUrl,
		WebSocketImpl,
		maxConnections,
		idleCloseMs,
		now,
		...(setTimer ? { setTimer } : {})
	});

	const relayFetch = async function relayFetch(url, init = {}) {
		const u = new URL(url);
		const request = buildRequest(u, init);
		const { signal } = init;

		// A pooled connection may have been closed by the far end since its last
		// use, which is indistinguishable from a healthy one until we write to it.
		// One retry on a fresh connection is expected, not exceptional - but only
		// when the peer sent nothing back, so a request the portal actually
		// processed is never replayed.
		for (let attempt = 0; ; attempt++) {
			const entry = await acquireFor(pool, u.hostname, signal);
			const mark = entry.reader.received();
			try {
				const { response, reusable } = await abortable(exchange(entry, url, request), signal);
				if (reusable) pool.release(entry);
				else pool.discard(entry);
				return response;
			} catch (e) {
				pool.discard(entry);
				const untouched = entry.reused && entry.reader.received() === mark;
				if (attempt === 0 && untouched && !isAbort(e)) continue;
				throw e;
			}
		}
	};

	relayFetch.stats = pool.stats;
	return relayFetch;
}
