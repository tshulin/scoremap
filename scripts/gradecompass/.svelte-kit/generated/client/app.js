import * as client_hooks from '../../../src/hooks.client.ts';


export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8'),
	() => import('./nodes/9'),
	() => import('./nodes/10'),
	() => import('./nodes/11'),
	() => import('./nodes/12'),
	() => import('./nodes/13'),
	() => import('./nodes/14'),
	() => import('./nodes/15'),
	() => import('./nodes/16'),
	() => import('./nodes/17'),
	() => import('./nodes/18'),
	() => import('./nodes/19'),
	() => import('./nodes/20'),
	() => import('./nodes/21')
];

export const server_loads = [0];

export const dictionary = {
		"/": [5],
		"/(authed)/attendance": [6,[2]],
		"/dev-login": [16],
		"/(authed)/documents": [7,[2]],
		"/(authed)/documents/document": [8,[2]],
		"/(authed)/feedback": [9,[2]],
		"/(authed)/grades": [10,[2,3]],
		"/(authed)/grades/data": [11,[2,3]],
		"/(authed)/grades/[index]": [~12,[2,3]],
		"/login": [17],
		"/(authed)/mail": [13,[2]],
		"/(authed)/mail/attachment": [14,[2]],
		"/migrate/import": [18],
		"/privacy": [19],
		"/signup": [20,[4]],
		"/signup/google": [21,[4]],
		"/(authed)/studentinfo": [15,[2]]
	};

export const hooks = {
	handleError: client_hooks.handleError || (({ error }) => { console.error(error) }),
	init: client_hooks.init,
	reroute: (() => {}),
	transport: {}
};

export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.decode]));
export const encoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.encode]));

export const hash = false;

export const decode = (type, value) => decoders[type](value);

export { default as root } from '../root.js';