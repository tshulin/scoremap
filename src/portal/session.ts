import { randomUUID } from 'node:crypto';
import { SessionExpiredError } from './errors.js';
import type { FetchFollowOptions, PageResult } from './http.js';
import { login as realLogin, type Credentials, type PortalSession } from './login.js';

const DEFAULT_TTL_MS = 20 * 60_000;

export type LoginFn = (creds: Credentials, options?: FetchFollowOptions) => Promise<PortalSession>;

interface SessionEntry {
	session: PortalSession;
	// Cookie-only sessions have no credentials for renewal.
	creds: Credentials | undefined;
	lastUsedAt: number;
}

export interface SessionStoreOptions {
	ttlMs?: number;
	loginFn?: LoginFn;
	fetchOptions?: FetchFollowOptions;
}

export class SessionStore {
	private readonly entries = new Map<string, SessionEntry>();
	private readonly inFlightLogins = new Map<string, Promise<PortalSession>>();
	private readonly ttlMs: number;
	private readonly loginFn: LoginFn;
	private readonly fetchOptions: FetchFollowOptions | undefined;

	constructor(options: SessionStoreOptions = {}) {
		this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
		this.loginFn = options.loginFn ?? realLogin;
		this.fetchOptions = options.fetchOptions;
	}

	async create(creds: Credentials): Promise<string> {
		const session = await this.loginDeduped(creds);
		return this.adopt(session, creds);
	}

	adopt(session: PortalSession, creds?: Credentials): string {
		const token = randomUUID();
		this.entries.set(token, { session, creds, lastUsedAt: Date.now() });
		return token;
	}

	get(token: string): PortalSession | undefined {
		return this.liveEntry(token)?.session;
	}

	delete(token: string): void {
		this.entries.delete(token);
	}

	sweep(): void {
		for (const [token, entry] of this.entries) {
			if (this.expired(entry)) this.entries.delete(token);
		}
	}

	get size(): number {
		return this.entries.size;
	}

	async withSession<T>(token: string, fn: (session: PortalSession) => Promise<T>): Promise<T> {
		const entry = this.liveEntry(token);
		if (!entry) throw new SessionExpiredError('Session not found or expired. Log in again.');
		try {
			return await fn(entry.session);
		} catch (error) {
			if (!(error instanceof SessionExpiredError) || !entry.creds) throw error;
			entry.session = await this.loginDeduped(entry.creds);
			entry.lastUsedAt = Date.now();
			return await fn(entry.session);
		}
	}

	private expired(entry: SessionEntry): boolean {
		return Date.now() - entry.lastUsedAt > this.ttlMs;
	}

	private liveEntry(token: string): SessionEntry | undefined {
		const entry = this.entries.get(token);
		if (!entry) return undefined;
		if (this.expired(entry)) {
			this.entries.delete(token);
			return undefined;
		}
		entry.lastUsedAt = Date.now();
		return entry;
	}

	private loginDeduped(creds: Credentials): Promise<PortalSession> {
		const key = `${creds.domain}\0${creds.username}`;
		const existing = this.inFlightLogins.get(key);
		if (existing) return existing;
		const attempt = this.loginFn(creds, this.fetchOptions).finally(() =>
			this.inFlightLogins.delete(key)
		);
		this.inFlightLogins.set(key, attempt);
		return attempt;
	}
}

export function assertSessionAlive(page: Pick<PageResult, 'finalUrl'>): void {
	if (/PXP2_Login/i.test(new URL(page.finalUrl).pathname)) {
		throw new SessionExpiredError(`The portal redirected to the login page (${page.finalUrl}).`);
	}
}
