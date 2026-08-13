
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * Environment variables [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env`. Like [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), this module cannot be imported into client-side code. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * _Unlike_ [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), the values exported from this module are statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * ```ts
 * import { API_KEY } from '$env/static/private';
 * ```
 * 
 * Note that all environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * 
 * ```
 * MY_FEATURE_FLAG=""
 * ```
 * 
 * You can override `.env` values from the command line like so:
 * 
 * ```sh
 * MY_FEATURE_FLAG="enabled" npm run dev
 * ```
 */
declare module '$env/static/private' {
	export const AI_AGENT: string;
	export const ALLUSERSPROFILE: string;
	export const APPDATA: string;
	export const CLAUDECODE: string;
	export const CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT: string;
	export const CLAUDE_CODE_CHILD_SESSION: string;
	export const CLAUDE_CODE_ENTRYPOINT: string;
	export const CLAUDE_CODE_EXECPATH: string;
	export const CLAUDE_CODE_SESSION_ID: string;
	export const CLAUDE_EFFORT: string;
	export const CLAUDE_JOB_DIR: string;
	export const COLORTERM: string;
	export const COMMONPROGRAMFILES: string;
	export const COMPUTERNAME: string;
	export const COMSPEC: string;
	export const COREPACK_ENABLE_AUTO_PIN: string;
	export const CommonProgramW6432: string;
	export const DriverData: string;
	export const EXEPATH: string;
	export const FORCE_COLOR: string;
	export const GIT_EDITOR: string;
	export const HOME: string;
	export const HOMEDRIVE: string;
	export const HOMEPATH: string;
	export const INVOCATION_ID: string;
	export const LOCALAPPDATA: string;
	export const LOGONSERVER: string;
	export const MSYSTEM: string;
	export const NUMBER_OF_PROCESSORS: string;
	export const NoDefaultCurrentDirectoryInExePath: string;
	export const OLDPWD: string;
	export const OS: string;
	export const OneDrive: string;
	export const PATH: string;
	export const PATHEXT: string;
	export const PLINK_PROTOCOL: string;
	export const PROCESSOR_ARCHITECTURE: string;
	export const PROCESSOR_IDENTIFIER: string;
	export const PROCESSOR_LEVEL: string;
	export const PROCESSOR_REVISION: string;
	export const PROGRAMFILES: string;
	export const PSModulePath: string;
	export const PUBLIC: string;
	export const PWD: string;
	export const ProgramData: string;
	export const ProgramW6432: string;
	export const SESSIONNAME: string;
	export const SHELL: string;
	export const SHLVL: string;
	export const SYNERGY_DEV_COOKIE: string;
	export const SYNERGY_DEV_DOMAIN: string;
	export const SYSTEMDRIVE: string;
	export const SYSTEMROOT: string;
	export const TEMP: string;
	export const TERM: string;
	export const TMP: string;
	export const USERDOMAIN: string;
	export const USERDOMAIN_ROAMINGPROFILE: string;
	export const USERNAME: string;
	export const USERPROFILE: string;
	export const WINDIR: string;
	export const _: string;
	export const npm_config_local_prefix: string;
	export const npm_config_user_agent: string;
	export const npm_execpath: string;
	export const npm_package_name: string;
	export const npm_package_json: string;
	export const npm_package_version: string;
	export const NODE: string;
	export const npm_node_execpath: string;
	export const npm_command: string;
	export const NODE_ENV: string;
}

/**
 * Similar to [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private), except that it only includes environment variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Values are replaced statically at build time.
 * 
 * ```ts
 * import { PUBLIC_BASE_URL } from '$env/static/public';
 * ```
 */
declare module '$env/static/public' {
	export const PUBLIC_DISABLE_MSW: string;
}

/**
 * This module provides access to runtime environment variables, as defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * This module cannot be imported into client-side code.
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * console.log(env.DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` always includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 */
declare module '$env/dynamic/private' {
	export const env: {
		AI_AGENT: string;
		ALLUSERSPROFILE: string;
		APPDATA: string;
		CLAUDECODE: string;
		CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT: string;
		CLAUDE_CODE_CHILD_SESSION: string;
		CLAUDE_CODE_ENTRYPOINT: string;
		CLAUDE_CODE_EXECPATH: string;
		CLAUDE_CODE_SESSION_ID: string;
		CLAUDE_EFFORT: string;
		CLAUDE_JOB_DIR: string;
		COLORTERM: string;
		COMMONPROGRAMFILES: string;
		COMPUTERNAME: string;
		COMSPEC: string;
		COREPACK_ENABLE_AUTO_PIN: string;
		CommonProgramW6432: string;
		DriverData: string;
		EXEPATH: string;
		FORCE_COLOR: string;
		GIT_EDITOR: string;
		HOME: string;
		HOMEDRIVE: string;
		HOMEPATH: string;
		INVOCATION_ID: string;
		LOCALAPPDATA: string;
		LOGONSERVER: string;
		MSYSTEM: string;
		NUMBER_OF_PROCESSORS: string;
		NoDefaultCurrentDirectoryInExePath: string;
		OLDPWD: string;
		OS: string;
		OneDrive: string;
		PATH: string;
		PATHEXT: string;
		PLINK_PROTOCOL: string;
		PROCESSOR_ARCHITECTURE: string;
		PROCESSOR_IDENTIFIER: string;
		PROCESSOR_LEVEL: string;
		PROCESSOR_REVISION: string;
		PROGRAMFILES: string;
		PSModulePath: string;
		PUBLIC: string;
		PWD: string;
		ProgramData: string;
		ProgramW6432: string;
		SESSIONNAME: string;
		SHELL: string;
		SHLVL: string;
		SYNERGY_DEV_COOKIE: string;
		SYNERGY_DEV_DOMAIN: string;
		SYSTEMDRIVE: string;
		SYSTEMROOT: string;
		TEMP: string;
		TERM: string;
		TMP: string;
		USERDOMAIN: string;
		USERDOMAIN_ROAMINGPROFILE: string;
		USERNAME: string;
		USERPROFILE: string;
		WINDIR: string;
		_: string;
		npm_config_local_prefix: string;
		npm_config_user_agent: string;
		npm_execpath: string;
		npm_package_name: string;
		npm_package_json: string;
		npm_package_version: string;
		NODE: string;
		npm_node_execpath: string;
		npm_command: string;
		NODE_ENV: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * Similar to [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), but only includes variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Note that public dynamic environment variables must all be sent from the server to the client, causing larger network requests — when possible, use `$env/static/public` instead.
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.PUBLIC_DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		PUBLIC_DISABLE_MSW: string;
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
