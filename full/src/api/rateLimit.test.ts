import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rateLimit.js';

function fakeClock(start = 1_000_000) {
	let current = start;
	return {
		now: () => current,
		advance: (ms: number) => {
			current += ms;
		}
	};
}

describe('RateLimiter', () => {
	it('allows attempts up to the limit', () => {
		const limiter = new RateLimiter({ limit: 3, windowMs: 60_000, now: fakeClock().now });

		expect(limiter.check('ip')).toBeUndefined();
		expect(limiter.check('ip')).toBeUndefined();
		expect(limiter.check('ip')).toBeUndefined();
	});

	it('blocks the attempt after the limit', () => {
		const limiter = new RateLimiter({ limit: 2, windowMs: 60_000, now: fakeClock().now });

		limiter.check('ip');
		limiter.check('ip');

		expect(limiter.check('ip')).toBeGreaterThan(0);
	});

	it('tells the caller how long to wait', () => {
		const clock = fakeClock();
		const limiter = new RateLimiter({ limit: 1, windowMs: 60_000, now: clock.now });

		limiter.check('ip');
		clock.advance(20_000);

		expect(limiter.check('ip')).toBe(40);
	});

	it('never asks the caller to wait zero seconds', () => {
		const clock = fakeClock();
		const limiter = new RateLimiter({ limit: 1, windowMs: 60_000, now: clock.now });

		limiter.check('ip');
		clock.advance(59_999);

		expect(limiter.check('ip')).toBe(1);
	});

	it('lets attempts through again once they age out of the window', () => {
		const clock = fakeClock();
		const limiter = new RateLimiter({ limit: 2, windowMs: 60_000, now: clock.now });

		limiter.check('ip');
		limiter.check('ip');
		expect(limiter.check('ip')).toBeGreaterThan(0);

		clock.advance(60_001);
		expect(limiter.check('ip')).toBeUndefined();
	});

	it('slides rather than resetting in fixed blocks', () => {
		const clock = fakeClock();
		const limiter = new RateLimiter({ limit: 2, windowMs: 60_000, now: clock.now });

		limiter.check('ip');
		clock.advance(59_000);
		limiter.check('ip');

		clock.advance(2_000);
		expect(limiter.check('ip')).toBeUndefined();
		expect(limiter.check('ip')).toBeGreaterThan(0);
	});

	it('keeps separate buckets per caller', () => {
		const limiter = new RateLimiter({ limit: 1, windowMs: 60_000, now: fakeClock().now });

		limiter.check('ip-a');

		expect(limiter.check('ip-b')).toBeUndefined();
		expect(limiter.check('ip-a')).toBeGreaterThan(0);
	});

	it('does not grow unboundedly as one-off callers come and go', () => {
		const clock = fakeClock();
		const limiter = new RateLimiter({ limit: 5, windowMs: 60_000, now: clock.now });

		for (let i = 0; i < 150; i++) {
			limiter.check(`ip-${i}`);
			clock.advance(1_000);
		}

		expect(limiter.size).toBeLessThan(150);
	});
});
