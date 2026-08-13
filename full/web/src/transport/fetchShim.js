// HTTP/1.1 over the TLS-through-relay stream. Produces a `fetch`-shaped function
// the portal client can use as its injectable transport (see ../portal/http.ts).
//
// It does what a browser fetch cannot cross-origin: read every Set-Cookie and
// leave redirects to the caller (the portal client follows them manually). One
// request per TLS connection (Connection: close) — simple and correct.

import { openTlsThroughRelay } from './relayTls.js';

const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const utf8 = new TextEncoder();
const latin1 = new TextDecoder('latin1');

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

function dechunk(buf) {
	const parts = [];
	let pos = 0;
	while (pos < buf.length) {
		const nl = indexOf2(buf, 0x0d, 0x0a, pos);
		if (nl === -1) break;
		const size = parseInt(latin1.decode(buf.subarray(pos, nl)).trim(), 16);
		if (!Number.isFinite(size) || size === 0) break;
		const start = nl + 2;
		parts.push(buf.subarray(start, start + size));
		pos = start + size + 2; // skip the chunk's trailing CRLF
	}
	return concat(parts);
}

async function decompress(buf, encoding) {
	const format = encoding.includes('gzip') ? 'gzip' : encoding.includes('deflate') ? 'deflate' : null;
	if (!format) return buf;
	const stream = new Response(buf).body.pipeThrough(new DecompressionStream(format));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function parseResponse(raw, url) {
	const sep = indexOf2Double(raw);
	if (sep === -1) throw new Error('malformed HTTP response (no header terminator)');
	const headerText = latin1.decode(raw.subarray(0, sep));
	let body = raw.subarray(sep + 4);

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

	if ((map.get('transfer-encoding') || '').includes('chunked')) body = dechunk(body);
	body = await decompress(body, map.get('content-encoding') || '');

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

// Find the CRLFCRLF that ends the header block.
function indexOf2Double(buf) {
	for (let i = 0; i < buf.length - 3; i++) {
		if (buf[i] === 0x0d && buf[i + 1] === 0x0a && buf[i + 2] === 0x0d && buf[i + 3] === 0x0a) return i;
	}
	return -1;
}

// Build a fetch-shaped function bound to a relay URL.
export function createRelayFetch({ relayUrl, WebSocketImpl } = {}) {
	if (!relayUrl) throw new Error('createRelayFetch requires a relayUrl');
	return async function relayFetch(url, init = {}) {
		const u = new URL(url);
		const host = u.hostname;
		const path = (u.pathname || '/') + (u.search || '');
		const method = init.method || 'GET';
		const body = init.body;

		const headers = {
			Host: host,
			'User-Agent': USER_AGENT,
			Accept: '*/*',
			'Accept-Encoding': 'identity',
			Connection: 'close',
			...(init.headers || {})
		};
		if (body != null) headers['Content-Length'] = String(utf8.encode(body).length);

		const head =
			`${method} ${path} HTTP/1.1\r\n` +
			Object.entries(headers)
				.map(([k, v]) => `${k}: ${v}`)
				.join('\r\n') +
			'\r\n\r\n';

		const conn = await openTlsThroughRelay(relayUrl, host, { WebSocketImpl });
		try {
			await conn.write(utf8.encode(head));
			if (body != null) await conn.write(utf8.encode(body));
			const parts = [];
			for (;;) {
				const chunk = await conn.read();
				if (chunk === undefined) break;
				parts.push(chunk);
			}
			return await parseResponse(concat(parts), url);
		} finally {
			conn.close();
		}
	};
}
