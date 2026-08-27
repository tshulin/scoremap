import { describe, expect, it, vi } from 'vitest';
import { createRelayRouter, isRelayError } from './relayRouter.js';

// A fetchFactory whose per-relay behavior is scripted by url.
const factory = (behaviors) =>
	vi.fn(({ relayUrl }) => {
		const fn = vi.fn(async (url, init) => {
			const b = behaviors[relayUrl];
			if (b instanceof Error) throw b;
			return { via: relayUrl, url, init };
		});
		return fn;
	});

const RELAYS = [
	{ url: 'ws://west', region: 'west' },
	{ url: 'ws://east', region: 'east' }
];

const relayDown = new Error('relay connection failed');

describe('isRelayError', () => {
	it('matches exactly the pre-portal failures relayTls can throw', () => {
		expect(isRelayError(new Error('relay connection failed'))).toBe(true);
		expect(isRelayError(new Error('relay closed before handshake'))).toBe(true);
		expect(isRelayError(new Error('relay refused tunnel to x.edupoint.com'))).toBe(true);
		expect(isRelayError(new Error('the connection closed mid-response'))).toBe(false);
		expect(isRelayError(new Error('HTTP 500'))).toBe(false);
		expect(isRelayError(null)).toBe(false);
	});
});

describe('createRelayRouter', () => {
	it('requires at least one relay', () => {
		expect(() => createRelayRouter({ relays: [] })).toThrow(/at least one relay/);
	});

	it('serves the hot lane from the region match and the cold lane from the other', async () => {
		const router = createRelayRouter({ relays: RELAYS, preferRegion: 'west', fetchFactory: factory({}) });
		expect((await router.primary('https://d.edupoint.com/a')).via).toBe('ws://west');
		expect((await router.secondary('https://d.edupoint.com/a')).via).toBe('ws://east');
	});

	it('flips both lanes when the user is closer to the east coast', async () => {
		const router = createRelayRouter({ relays: RELAYS, preferRegion: 'east', fetchFactory: factory({}) });
		expect((await router.primary('https://d.edupoint.com/a')).via).toBe('ws://east');
		expect((await router.secondary('https://d.edupoint.com/a')).via).toBe('ws://west');
	});

	it('shares a single relay across both lanes when only one is configured', async () => {
		const router = createRelayRouter({
			relays: [{ url: 'ws://only' }],
			preferRegion: 'west',
			fetchFactory: factory({})
		});
		expect((await router.primary('https://d.edupoint.com/a')).via).toBe('ws://only');
		expect((await router.secondary('https://d.edupoint.com/a')).via).toBe('ws://only');
	});

	it('fails over to the other relay when the lane relay is down, and benches it', async () => {
		let t = 0;
		const router = createRelayRouter({
			relays: RELAYS,
			preferRegion: 'west',
			fetchFactory: factory({ 'ws://west': relayDown }),
			benchMs: 60_000,
			now: () => t
		});
		const res = await router.primary('https://d.edupoint.com/a');
		expect(res.via).toBe('ws://east');
		// While benched, the west relay is not even tried.
		t = 30_000;
		expect((await router.primary('https://d.edupoint.com/b')).via).toBe('ws://east');
		expect(router.primary.stats()[0].benchedUntil).toBe(60_000);
	});

	it('lets a benched relay try again after the bench expires', async () => {
		let t = 0;
		const behaviors = { 'ws://west': relayDown };
		const router = createRelayRouter({
			relays: RELAYS,
			preferRegion: 'west',
			fetchFactory: factory(behaviors),
			benchMs: 60_000,
			now: () => t
		});
		await router.primary('https://d.edupoint.com/a'); // benches west
		delete behaviors['ws://west']; // relay recovers
		t = 60_001;
		expect((await router.primary('https://d.edupoint.com/b')).via).toBe('ws://west');
	});

	it('propagates portal-level failures without failing over', async () => {
		const portalError = new Error('HTTP 500 from the portal');
		const router = createRelayRouter({
			relays: RELAYS,
			preferRegion: 'west',
			fetchFactory: factory({ 'ws://west': portalError })
		});
		await expect(router.primary('https://d.edupoint.com/a')).rejects.toBe(portalError);
		expect(router.primary.stats()[0].benchedUntil).toBe(0);
	});

	it('throws the relay error when every relay is down', async () => {
		const router = createRelayRouter({
			relays: RELAYS,
			preferRegion: 'west',
			fetchFactory: factory({ 'ws://west': relayDown, 'ws://east': new Error('relay closed before handshake') })
		});
		await expect(router.primary('https://d.edupoint.com/a')).rejects.toThrow(/relay/);
	});

	it('still probes the lane relay when everything is benched', async () => {
		let t = 0;
		const behaviors = { 'ws://west': relayDown, 'ws://east': relayDown };
		const router = createRelayRouter({
			relays: RELAYS,
			preferRegion: 'west',
			fetchFactory: factory(behaviors),
			benchMs: 60_000,
			now: () => t
		});
		await expect(router.primary('https://d.edupoint.com/a')).rejects.toThrow(/relay/);
		// Both benched; a recovered lane relay still gets the probe.
		delete behaviors['ws://west'];
		t = 10_000;
		expect((await router.primary('https://d.edupoint.com/b')).via).toBe('ws://west');
	});

	it('fails over without exposing usage counters', async () => {
		const router = createRelayRouter({
			relays: RELAYS,
			preferRegion: 'east',
			fetchFactory: factory({ 'ws://east': relayDown })
		});
		expect((await router.primary('https://d.edupoint.com/a')).via).toBe('ws://west');
		expect(router).not.toHaveProperty('failovers');
		expect(router).not.toHaveProperty('preferredRegion');
	});
});
