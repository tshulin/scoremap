// The PXP2 login + an authenticated page fetch, driven entirely over the tunnel.
// This mirrors src/portal/login.ts (WebForms login: read hidden fields, POST
// credentials, detect failure by the login form re-rendering) and the manual
// redirect + cookie-jar handling from src/portal/http.ts fetchFollow.

import { tunnelRequest } from './tunnel.mjs';

const LOGIN_PATH = '/PXP2_Login_Student.aspx?regenerateSessionId=True';

class CookieJar {
	#c = new Map();
	absorb(setCookies) {
		for (const line of setCookies) {
			const nv = line.split(';', 1)[0] ?? '';
			const eq = nv.indexOf('=');
			if (eq === -1) continue;
			const name = nv.slice(0, eq).trim();
			if (name) this.#c.set(name, nv.slice(eq + 1).trim());
		}
	}
	header() {
		return [...this.#c.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
	}
	names() {
		return [...this.#c.keys()];
	}
	get size() {
		return this.#c.size;
	}
}

const decodeEntities = (s) =>
	s
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');

function formInputs(html) {
	const inputs = new Map();
	for (const [tag] of html.matchAll(/<input\b[^>]*>/gi)) {
		const name = /\bname="([^"]*)"/i.exec(tag)?.[1];
		if (!name) continue;
		const type = /\btype="([^"]*)"/i.exec(tag)?.[1]?.toLowerCase() ?? 'text';
		if ((type === 'checkbox' || type === 'radio') && !/\bchecked\b/i.test(tag)) continue;
		const value = /\bvalue="([^"]*)"/i.exec(tag)?.[1] ?? '';
		inputs.set(decodeEntities(name), decodeEntities(value));
	}
	return inputs;
}

function resolvePath(currentPath, location) {
	if (/^https?:\/\//i.test(location)) {
		const u = new URL(location);
		return u.pathname + u.search;
	}
	if (location.startsWith('/')) return location;
	const base = currentPath.split('?')[0];
	const dir = base.slice(0, base.lastIndexOf('/') + 1);
	return dir + location;
}

// Follow redirects manually, absorbing Set-Cookie on every hop (the whole reason
// a browser fetch can't do this: it hides cross-origin Set-Cookie from JS).
async function follow(ctx, { method, path, headers = {}, body }) {
	let curPath = path;
	let curMethod = method;
	let curBody = body;
	for (let hop = 0; hop <= 10; hop++) {
		ctx.tunnels++;
		const res = await tunnelRequest({
			relayUrl: ctx.relayUrl,
			host: ctx.host,
			method: curMethod,
			path: curPath,
			headers: { ...headers, ...(ctx.jar.size ? { Cookie: ctx.jar.header() } : {}) },
			body: curBody
		});
		ctx.jar.absorb(res.setCookies);
		ctx.lastProtocol = res.protocol;
		ctx.lastAuthorized = res.authorized;
		ctx.lastPeerCN = res.peerCN;
		const loc = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
		if (!loc) return { ...res, finalPath: curPath };
		curPath = resolvePath(curPath, loc);
		curMethod = 'GET';
		curBody = undefined;
		headers = {};
	}
	throw new Error('too many redirects');
}

export async function runLogin({ relayUrl, host, username, password }) {
	const ctx = { relayUrl, host, jar: new CookieJar(), tunnels: 0 };

	// 1. GET the login page.
	const loginPage = await follow(ctx, { method: 'GET', path: LOGIN_PATH });
	const fields = formInputs(loginPage.body);
	if (!fields.has('__VIEWSTATE')) {
		throw new Error('login page did not render a WebForms form (wrong host?)');
	}

	// 2. Fill in the username/password fields (found by name, like login.ts).
	let userField, passField;
	for (const name of fields.keys()) {
		if (!userField && /user/i.test(name)) userField = name;
		if (!passField && /pass|pwd/i.test(name)) passField = name;
	}
	if (!userField || !passField) throw new Error('could not find username/password fields');
	fields.set(userField, username);
	fields.set(passField, password);

	// 3. POST credentials.
	const posted = await follow(ctx, {
		method: 'POST',
		path: loginPage.finalPath,
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams([...fields]).toString()
	});

	const onLoginPage = /PXP2_Login/i.test(posted.finalPath);
	if (onLoginPage) throw new Error('AUTH FAILED — portal re-rendered the login form');

	// 4. Prove the session works: pull an authenticated page and read a field.
	const student = await follow(ctx, { method: 'GET', path: '/PXP2_Student.aspx' });
	const name =
		/<span[^>]*class="[^"]*student-name[^"]*"[^>]*>([^<]+)</i.exec(student.body)?.[1]?.trim() ||
		/"StudentName"\s*:\s*"([^"]+)"/i.exec(student.body)?.[1] ||
		/<title>([^<]+)<\/title>/i.exec(student.body)?.[1]?.trim();

	return {
		ok: true,
		tunnels: ctx.tunnels,
		protocol: ctx.lastProtocol,
		certAuthorized: ctx.lastAuthorized,
		peerCN: ctx.lastPeerCN,
		cookieNames: ctx.jar.names(),
		landedPath: posted.finalPath,
		studentPageStatus: student.status,
		studentPageBytes: student.body.length,
		studentName: name ?? null
	};
}
