// Phase 2 verification (manual, needs network): drive the browser transport
// (subtls + fetch-shim) against the real portal login page THROUGH the blind
// relay. This runs the exact shipping code — Node provides the same WebSocket,
// crypto.subtle and DecompressionStream globals the browser does.
//
//   SYNERGY_DOMAIN=ca-pleas-psv.edupoint.com node verify-transport.mjs
//
// A real-browser smoke test is still the final gate; this proves the logic.

import { startRelay } from '../relay/relay.mjs';
import { createRelayFetch } from './src/transport/fetchShim.js';

const host = process.env.SYNERGY_DOMAIN;
if (!host) {
	console.error('Set SYNERGY_DOMAIN (e.g. ca-pleas-psv.edupoint.com).');
	process.exit(2);
}
const PORT = 8796;
const relay = startRelay({ port: PORT, log: (m) => console.log(`  [relay] ${m}`) });
const relayFetch = createRelayFetch({ relayUrl: `ws://127.0.0.1:${PORT}` });

console.log(`\n=== Phase 2: transport -> ${host} ===`);
let ok = false;
try {
	const res = await relayFetch(`https://${host}/PXP2_Login_Student.aspx?regenerateSessionId=True`, {
		method: 'GET'
	});
	const bodyText = await res.text();
	const setCookies = res.headers.getSetCookie();
	const hasForm = bodyText.includes('__VIEWSTATE');
	console.log(`  HTTP ${res.status}`);
	console.log(`  Set-Cookie count: ${setCookies.length} (${setCookies.map((c) => c.split('=')[0]).join(', ')})`);
	console.log(`  WebForms form (__VIEWSTATE): ${hasForm ? 'yes' : 'no'}`);
	console.log(`  body bytes: ${bodyText.length}`);
	ok = res.status === 200 && hasForm && setCookies.length > 0;
} catch (e) {
	console.log(`  ERROR: ${e.message}`);
}

await relay.close();
console.log(
	ok
		? '\n=== PASS: browser transport speaks HTTPS over the relay and reads Set-Cookie. ===\n'
		: '\n=== FAIL ===\n'
);
process.exit(ok ? 0 : 1);
