export interface ApiConfig {
	port: number;
	allowedOrigin: string;
	sessionTtlMs: number;
	loginLimit: number;
	loginWindowMs: number;
	trustProxy: boolean;
	placeholderData: boolean;
}

const DEFAULTS = {
	port: 3000,
	allowedOrigin: 'http://localhost:5173',
	sessionTtlMinutes: 20,
	loginLimit: 10,
	loginWindowMinutes: 5
};

function positiveNumber(name: string, raw: string | undefined, fallback: number): number {
	if (raw === undefined || raw.trim() === '') return fallback;
	const value = Number(raw);
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error(`${name} must be a positive number, got ${JSON.stringify(raw)}.`);
	}
	return value;
}

function boolean(name: string, raw: string | undefined, fallback: boolean): boolean {
	if (raw === undefined || raw.trim() === '') return fallback;
	const value = raw.trim().toLowerCase();
	if (value === 'true' || value === '1') return true;
	if (value === 'false' || value === '0') return false;
	throw new Error(`${name} must be true or false, got ${JSON.stringify(raw)}.`);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
	return {
		port: positiveNumber('PORT', env['PORT'], DEFAULTS.port),
		allowedOrigin: env['ALLOWED_ORIGIN']?.trim() || DEFAULTS.allowedOrigin,
		sessionTtlMs:
			positiveNumber(
				'SESSION_TTL_MINUTES',
				env['SESSION_TTL_MINUTES'],
				DEFAULTS.sessionTtlMinutes
			) * 60_000,
		loginLimit: positiveNumber('LOGIN_RATE_LIMIT', env['LOGIN_RATE_LIMIT'], DEFAULTS.loginLimit),
		loginWindowMs:
			positiveNumber(
				'LOGIN_RATE_WINDOW_MINUTES',
				env['LOGIN_RATE_WINDOW_MINUTES'],
				DEFAULTS.loginWindowMinutes
			) * 60_000,
		trustProxy: boolean('TRUST_PROXY', env['TRUST_PROXY'], false),
		placeholderData: placeholder(env)
	};
}

// Invented grades must never reach a student who believes they are real, so production
// refuses to start rather than quietly ignoring the flag.
function placeholder(env: NodeJS.ProcessEnv): boolean {
	const on = boolean('PLACEHOLDER_DATA', env['PLACEHOLDER_DATA'], false);
	if (on && env['NODE_ENV'] === 'production') {
		throw new Error('PLACEHOLDER_DATA must not be enabled when NODE_ENV=production.');
	}
	return on;
}
