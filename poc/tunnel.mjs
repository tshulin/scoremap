// Client side — in production this runs IN THE BROWSER.
//
// Here it does exactly what the browser would do: open a WebSocket to the relay,
// then run a full TLS client over that opaque byte pipe so TLS terminates in the
// client (never on the relay), and speak HTTP/1.1 over the TLS stream itself.
//
// The browser build swaps ONE thing: `tls.connect` (Node's userland-transport TLS)
// becomes subtls (a TLS 1.3 client in WASM/JS). Everything else — the WS transport,
// the HTTP shim, the redirect/cookie handling — is identical in kind.

import { WebSocket } from 'ws';
import tls from 'node:tls';
import { Duplex } from 'node:stream';
import zlib from 'node:zlib';

const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Open the WS to the relay, do the {host} handshake, and expose the tunnel as a
// Node Duplex of raw bytes — the equivalent of a browser WebSocket carrying binary
// frames that subtls reads/writes.
function openTunnelDuplex(relayUrl, host) {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(relayUrl);
		ws.binaryType = 'nodebuffer';
		let ready = false;

		ws.on('open', () => ws.send(JSON.stringify({ host })));
		ws.on('error', reject);
		ws.on('message', (data, isBinary) => {
			if (!ready) {
				let ok = false;
				try {
					ok = JSON.parse(data.toString()).ok === true;
				} catch {
					/* not the control frame */
				}
				if (!ok) return reject(new Error(`relay refused tunnel to ${host}`));
				ready = true;

				const duplex = new Duplex({
					write(chunk, _enc, cb) {
						ws.send(chunk, { binary: true }, cb);
					},
					read() {}
				});
				ws.on('message', (d, bin) => {
					if (bin) duplex.push(Buffer.isBuffer(d) ? d : Buffer.from(d));
				});
				ws.on('close', () => duplex.push(null));
				ws.on('error', (e) => duplex.destroy(e));
				duplex.on('close', () => ws.close());
				resolve(duplex);
			}
		});
	});
}

function buildRequest({ method, host, path, headers = {}, body }) {
	const h = {
		Host: host,
		'User-Agent': USER_AGENT,
		Accept: '*/*',
		'Accept-Encoding': 'identity',
		Connection: 'close',
		...headers
	};
	if (body != null) h['Content-Length'] = Buffer.byteLength(body).toString();
	const head =
		`${method} ${path} HTTP/1.1\r\n` +
		Object.entries(h)
			.map(([k, v]) => `${k}: ${v}`)
			.join('\r\n') +
		'\r\n\r\n';
	return body != null ? Buffer.concat([Buffer.from(head), Buffer.from(body)]) : Buffer.from(head);
}

function parseResponse(raw) {
	const sep = raw.indexOf('\r\n\r\n');
	if (sep === -1) throw new Error('no header terminator in response');
	const headerText = raw.subarray(0, sep).toString('latin1');
	let bodyBuf = raw.subarray(sep + 4);

	const lines = headerText.split('\r\n');
	const statusLine = lines[0];
	const status = Number(statusLine.split(' ')[1]);
	const headers = new Map();
	const setCookies = [];
	for (const line of lines.slice(1)) {
		const i = line.indexOf(':');
		if (i === -1) continue;
		const name = line.slice(0, i).trim().toLowerCase();
		const value = line.slice(i + 1).trim();
		if (name === 'set-cookie') setCookies.push(value);
		else headers.set(name, headers.has(name) ? `${headers.get(name)}, ${value}` : value);
	}

	if ((headers.get('transfer-encoding') || '').includes('chunked')) {
		bodyBuf = dechunk(bodyBuf);
	}
	const enc = headers.get('content-encoding') || '';
	if (enc.includes('gzip')) bodyBuf = zlib.gunzipSync(bodyBuf);
	else if (enc.includes('deflate')) bodyBuf = zlib.inflateSync(bodyBuf);

	return { status, statusLine, headers, setCookies, body: bodyBuf.toString('utf8') };
}

function dechunk(buf) {
	const out = [];
	let pos = 0;
	while (pos < buf.length) {
		const nl = buf.indexOf('\r\n', pos);
		if (nl === -1) break;
		const size = parseInt(buf.subarray(pos, nl).toString('latin1').trim(), 16);
		if (!Number.isFinite(size) || size === 0) break;
		const start = nl + 2;
		out.push(buf.subarray(start, start + size));
		pos = start + size + 2;
	}
	return Buffer.concat(out);
}

// One HTTP request over one fresh TLS-over-relay tunnel (Connection: close).
export async function tunnelRequest({ relayUrl, host, method, path, headers, body, timeoutMs = 20_000 }) {
	const duplex = await openTunnelDuplex(relayUrl, host);
	return new Promise((resolve, reject) => {
		const chunks = [];
		const timer = setTimeout(() => {
			sock.destroy();
			reject(new Error(`tunnel request to ${host}${path} timed out`));
		}, timeoutMs);

		const sock = tls.connect(
			{
				socket: duplex,
				servername: host,
				// Real cert validation against the system trust store — the portal's
				// *.edupoint.com cert chains to Go Daddy Root G2. In the browser,
				// subtls does the same against a bundled Go Daddy G2 root.
				rejectUnauthorized: true,
				minVersion: 'TLSv1.2'
			},
			() => {
				sock.write(buildRequest({ method, host, path, headers, body }));
			}
		);
		sock.on('data', (d) => chunks.push(d));
		const finish = () => {
			clearTimeout(timer);
			if (chunks.length === 0) return reject(new Error('empty response'));
			try {
				const res = parseResponse(Buffer.concat(chunks));
				res.protocol = sock.getProtocol();
				res.authorized = sock.authorized;
				res.peerCN = sock.getPeerCertificate()?.subject?.CN;
				resolve(res);
			} catch (e) {
				reject(e);
			}
		};
		sock.on('end', finish);
		sock.on('close', finish);
		sock.on('error', (e) => {
			clearTimeout(timer);
			reject(e);
		});
	});
}
