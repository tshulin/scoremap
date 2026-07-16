import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
	it('uses defaults when the environment is empty', () => {
		const config = loadConfig({});

		expect(config.port).toBe(3000);
		expect(config.allowedOrigin).toBe('http://localhost:5173');
		expect(config.sessionTtlMs).toBe(20 * 60_000);
		expect(config.trustProxy).toBe(false);
	});

	it('reads the environment', () => {
		const config = loadConfig({
			PORT: '8080',
			ALLOWED_ORIGIN: 'https://grades.example.com',
			SESSION_TTL_MINUTES: '5',
			LOGIN_RATE_LIMIT: '3',
			LOGIN_RATE_WINDOW_MINUTES: '10',
			TRUST_PROXY: 'true'
		});

		expect(config).toEqual({
			port: 8080,
			allowedOrigin: 'https://grades.example.com',
			sessionTtlMs: 5 * 60_000,
			loginLimit: 3,
			loginWindowMs: 10 * 60_000,
			trustProxy: true,
			placeholderData: false
		});
	});

	it('treats an empty variable as unset', () => {
		expect(loadConfig({ PORT: '', ALLOWED_ORIGIN: '  ' }).port).toBe(3000);
		expect(loadConfig({ ALLOWED_ORIGIN: '  ' }).allowedOrigin).toBe('http://localhost:5173');
	});

	it('rejects invalid numeric values', () => {
		expect(() => loadConfig({ PORT: 'eighty' })).toThrow(/PORT must be a positive number/);
		expect(() => loadConfig({ SESSION_TTL_MINUTES: '0' })).toThrow(/positive number/);
		expect(() => loadConfig({ SESSION_TTL_MINUTES: '-5' })).toThrow(/positive number/);
	});

	it('rejects invalid boolean values', () => {
		expect(() => loadConfig({ TRUST_PROXY: 'yes please' })).toThrow(/TRUST_PROXY must be true/);
	});

	it('accepts the usual spellings of a boolean', () => {
		expect(loadConfig({ TRUST_PROXY: '1' }).trustProxy).toBe(true);
		expect(loadConfig({ TRUST_PROXY: 'FALSE' }).trustProxy).toBe(false);
	});
});

describe('loadConfig — placeholder data', () => {
	it('is off by default', () => {
		expect(loadConfig({}).placeholderData).toBe(false);
	});

	it('can be turned on outside production', () => {
		expect(loadConfig({ PLACEHOLDER_DATA: 'true' }).placeholderData).toBe(true);
		expect(loadConfig({ PLACEHOLDER_DATA: 'true', NODE_ENV: 'development' }).placeholderData).toBe(
			true
		);
	});

	it('refuses to start in production rather than serving invented grades', () => {
		expect(() => loadConfig({ PLACEHOLDER_DATA: 'true', NODE_ENV: 'production' })).toThrow(
			/must not be enabled when NODE_ENV=production/
		);
	});

	it('leaves production alone when it is off', () => {
		expect(loadConfig({ NODE_ENV: 'production' }).placeholderData).toBe(false);
		expect(loadConfig({ PLACEHOLDER_DATA: 'false', NODE_ENV: 'production' }).placeholderData).toBe(
			false
		);
	});
});
