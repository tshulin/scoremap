import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context } from 'hono';

export interface RateLimiterOptions {
	limit: number;
	windowMs: number;
	now?: () => number;
}

const SWEEP_EVERY = 100;

export class RateLimiter {
	private readonly hits = new Map<string, number[]>();
	private readonly limit: number;
	private readonly windowMs: number;
	private readonly now: () => number;
	private checksSinceSweep = 0;

	constructor(options: RateLimiterOptions) {
		this.limit = options.limit;
		this.windowMs = options.windowMs;
		this.now = options.now ?? Date.now;
	}

	check(key: string): number | undefined {
		const now = this.now();
		if (++this.checksSinceSweep >= SWEEP_EVERY) this.sweep(now);

		const recent = (this.hits.get(key) ?? []).filter((at) => at > now - this.windowMs);

		if (recent.length >= this.limit) {
			this.hits.set(key, recent);
			const oldest = recent[0] ?? now;
			return Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
		}

		recent.push(now);
		this.hits.set(key, recent);
		return undefined;
	}

	private sweep(now: number): void {
		this.checksSinceSweep = 0;
		for (const [key, timestamps] of this.hits) {
			if (timestamps.every((at) => at <= now - this.windowMs)) this.hits.delete(key);
		}
	}

	get size(): number {
		return this.hits.size;
	}
}

export function clientKey(c: Context, trustProxy: boolean): string {
	if (trustProxy) {
		const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
		if (forwarded) return forwarded;
	}
	try {
		return getConnInfo(c).remote.address ?? 'unknown';
	} catch {
		return 'unknown';
	}
}
