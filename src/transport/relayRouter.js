// Two relays, two lanes. The router owns one connection pool per relay
// (createRelayFetch) and hands out two fetch functions:
//
//   primary   - the hot lane: login, student info, the gradebook. Served by
//               the relay nearest the user (region match), so grades render
//               off the lowest-latency path.
//   secondary - the cold lane: attendance, documents, mail. Served by the
//               OTHER relay, so background loading never queues behind the
//               grades the student is waiting to see.
//
// Failover: an error that is provably the relay's fault - the WebSocket would
// not open, or the relay closed/refused the tunnel before any HTTP bytes
// moved - benches that relay for a minute and retries the request on the
// other one. Those errors all happen before the request touches the portal,
// so the retry can never replay something the portal already processed.
// Anything else (portal 5xx, parse trouble, a connection dying mid-response)
// propagates untouched: it is not the relay's fault, and retrying it here
// could double-submit a request the portal saw.
//
// With a single relay configured (dev, or one region unset) both lanes share
// it and failover has nowhere to go - the router degrades to exactly the old
// single-pool behavior.

import { createRelayFetch } from './fetchShim.js';

// The complete set of pre-portal failures relayTls.js can throw.
const RELAY_ERROR_RE = /relay (connection failed|closed before handshake|refused tunnel)/;
export const isRelayError = (e) => !!e && RELAY_ERROR_RE.test(e.message || '');

const BENCH_MS = 60_000;

export function createRelayRouter({
	relays, // [{ url, region? }] - one or two entries
	preferRegion, // 'west' | 'east': which coast the user is closer to
	benchMs = BENCH_MS,
	now = () => Date.now(),
	fetchFactory = createRelayFetch,
	...fetchOptions // forwarded to every pool (maxConnections, WebSocketImpl, ...)
} = {}) {
	if (!relays || relays.length === 0) {
		throw new Error('createRelayRouter requires at least one relay');
	}
	const nodes = relays.map((r) => ({
		url: r.url,
		region: r.region ?? null,
		fetch: fetchFactory({ relayUrl: r.url, ...fetchOptions }),
		benchedUntil: 0
	}));

	const preferred = nodes.find((n) => n.region && n.region === preferRegion) ?? nodes[0];
	const other = nodes.find((n) => n !== preferred) ?? preferred;
	let failovers = 0; // times a request had to leave its lane's relay

	const laneFetch = (order) => {
		const lane = async (url, init) => {
			const t = now();
			const healthy = order.filter((n) => n.benchedUntil <= t);
			// Every relay benched: try the lane's own anyway - a bench must delay
			// recovery probes, never turn "slow" into "down".
			const candidates = healthy.length > 0 ? healthy : [order[0]];
			let lastError;
			for (const node of candidates) {
				try {
					return await node.fetch(url, init);
				} catch (e) {
					lastError = e;
					if (!isRelayError(e)) throw e;
					node.benchedUntil = now() + benchMs;
					failovers++;
				}
			}
			throw lastError;
		};
		lane.stats = () =>
			order.map((n) => ({ url: n.url, benchedUntil: n.benchedUntil, ...(n.fetch.stats ? n.fetch.stats() : {}) }));
		return lane;
	};

	const single = other === preferred;
	return {
		primary: laneFetch(single ? [preferred] : [preferred, other]),
		secondary: laneFetch(single ? [preferred] : [other, preferred]),
		relays: nodes.map((n) => ({ url: n.url, region: n.region })),
		preferredUrl: preferred.url,
		preferredRegion: preferred.region,
		failovers: () => failovers
	};
}
