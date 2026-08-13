import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionExpiredError } from './errors.js';
import { CookieJar } from './http.js';
import type { Credentials, PortalSession } from './login.js';
import { assertSessionAlive, SessionStore } from './session.js';

const CREDS: Credentials = {
	domain: 'district-psv.edupoint.com',
	username: 'student@school.net',
	password: 'hunter2'
};

const newSession = (): PortalSession => ({ domain: CREDS.domain, jar: new CookieJar() });

function stubLogin(behavior: () => Promise<PortalSession> = async () => newSession()) {
	const calls: Credentials[] = [];
	const fn = async (creds: Credentials) => {
		calls.push(creds);
		return behavior();
	};
	return { fn, calls };
}

describe('SessionStore', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('creates a session via login and returns a token that resolves it', async () => {
		const { fn, calls } = stubLogin();
		const store = new SessionStore({ loginFn: fn });

		const token = await store.create(CREDS);

		expect(calls).toEqual([CREDS]);
		expect(store.get(token)?.domain).toBe(CREDS.domain);
	});

	it('expires sessions after the idle TTL', async () => {
		const store = new SessionStore({ loginFn: stubLogin().fn, ttlMs: 60_000 });
		const token = await store.create(CREDS);

		vi.advanceTimersByTime(61_000);

		expect(store.get(token)).toBeUndefined();
		expect(store.size).toBe(0);
	});

	it('slides the TTL on every use', async () => {
		const store = new SessionStore({ loginFn: stubLogin().fn, ttlMs: 60_000 });
		const token = await store.create(CREDS);

		for (let i = 0; i < 5; i++) {
			vi.advanceTimersByTime(45_000);
			expect(store.get(token)).toBeDefined();
		}
	});

	it('sweep evicts expired sessions without touching live ones', async () => {
		const store = new SessionStore({ loginFn: stubLogin().fn, ttlMs: 60_000 });
		const oldToken = await store.create(CREDS);
		vi.advanceTimersByTime(45_000);
		const freshToken = await store.create({ ...CREDS, username: 'other@school.net' });
		vi.advanceTimersByTime(30_000);

		store.sweep();

		expect(store.size).toBe(1);
		expect(store.get(freshToken)).toBeDefined();
		expect(store.get(oldToken)).toBeUndefined();
	});

	it('shares one in-flight login for the same account', async () => {
		let release!: (session: PortalSession) => void;
		const gate = new Promise<PortalSession>((resolve) => {
			release = resolve;
		});
		const { fn, calls } = stubLogin(() => gate);
		const store = new SessionStore({ loginFn: fn });

		const first = store.create(CREDS);
		const second = store.create(CREDS);
		release(newSession());
		const [tokenA, tokenB] = await Promise.all([first, second]);

		expect(calls.length).toBe(1);
		expect(tokenA).not.toBe(tokenB);
		expect(store.get(tokenA)).toBe(store.get(tokenB));
	});

	it('does not share logins across different accounts', async () => {
		const { fn, calls } = stubLogin();
		const store = new SessionStore({ loginFn: fn });

		await Promise.all([store.create(CREDS), store.create({ ...CREDS, username: 'b@school.net' })]);

		expect(calls.length).toBe(2);
	});

	describe('withSession', () => {
		it('throws SessionExpiredError for an unknown token', async () => {
			const store = new SessionStore({ loginFn: stubLogin().fn });

			await expect(store.withSession('nope', async () => 'x')).rejects.toThrow(SessionExpiredError);
		});

		it('re-logins once and retries when the portal session died', async () => {
			const { fn, calls } = stubLogin();
			const store = new SessionStore({ loginFn: fn });
			const token = await store.create(CREDS);
			const seen: PortalSession[] = [];
			let attempts = 0;

			const result = await store.withSession(token, async (session) => {
				seen.push(session);
				if (attempts++ === 0) throw new SessionExpiredError('bounced to login');
				return 'data';
			});

			expect(result).toBe('data');
			expect(calls.length).toBe(2);
			expect(seen[0]).not.toBe(seen[1]);
			expect(store.get(token)).toBe(seen[1]);
		});

		it('gives up after one retry', async () => {
			const store = new SessionStore({ loginFn: stubLogin().fn });
			const token = await store.create(CREDS);
			let attempts = 0;

			await expect(
				store.withSession(token, async () => {
					attempts++;
					throw new SessionExpiredError('still dead');
				})
			).rejects.toThrow(SessionExpiredError);
			expect(attempts).toBe(2);
		});

		it('cannot recover an adopted cookie session (no credentials)', async () => {
			const { fn, calls } = stubLogin();
			const store = new SessionStore({ loginFn: fn });
			const token = store.adopt(newSession());

			await expect(
				store.withSession(token, async () => {
					throw new SessionExpiredError('bounced');
				})
			).rejects.toThrow(SessionExpiredError);
			expect(calls.length).toBe(0);
		});

		it('passes through non-session errors untouched', async () => {
			const { fn, calls } = stubLogin();
			const store = new SessionStore({ loginFn: fn });
			const token = await store.create(CREDS);

			await expect(
				store.withSession(token, async () => {
					throw new TypeError('unrelated');
				})
			).rejects.toThrow(TypeError);
			expect(calls.length).toBe(1);
		});
	});
});

describe('assertSessionAlive', () => {
	it('throws when the page landed on the login module', () => {
		expect(() =>
			assertSessionAlive({
				finalUrl:
					'https://district-psv.edupoint.com/PXP2_Login_Student.aspx?regenerateSessionId=True'
			})
		).toThrow(SessionExpiredError);
	});

	it('passes for normal portal pages', () => {
		expect(() =>
			assertSessionAlive({
				finalUrl: 'https://district-psv.edupoint.com/PXP2_Gradebook.aspx?AGU=0'
			})
		).not.toThrow();
	});
});
