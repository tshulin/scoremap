
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/(authed)" | "/" | "/api" | "/api/synergy" | "/(authed)/attendance" | "/dev-login" | "/(authed)/documents" | "/(authed)/documents/document" | "/(authed)/feedback" | "/(authed)/grades" | "/(authed)/grades/data" | "/(authed)/grades/[index]" | "/login" | "/(authed)/mail" | "/(authed)/mail/attachment" | "/migrate" | "/migrate/import" | "/privacy" | "/signup" | "/signup/google" | "/(authed)/studentinfo";
		RouteParams(): {
			"/(authed)/grades/[index]": { index: string }
		};
		LayoutParams(): {
			"/(authed)": { index?: string };
			"/": { index?: string };
			"/api": Record<string, never>;
			"/api/synergy": Record<string, never>;
			"/(authed)/attendance": Record<string, never>;
			"/dev-login": Record<string, never>;
			"/(authed)/documents": Record<string, never>;
			"/(authed)/documents/document": Record<string, never>;
			"/(authed)/feedback": Record<string, never>;
			"/(authed)/grades": { index?: string };
			"/(authed)/grades/data": Record<string, never>;
			"/(authed)/grades/[index]": { index: string };
			"/login": Record<string, never>;
			"/(authed)/mail": Record<string, never>;
			"/(authed)/mail/attachment": Record<string, never>;
			"/migrate": Record<string, never>;
			"/migrate/import": Record<string, never>;
			"/privacy": Record<string, never>;
			"/signup": Record<string, never>;
			"/signup/google": Record<string, never>;
			"/(authed)/studentinfo": Record<string, never>
		};
		Pathname(): "/" | "/api" | "/api/" | "/api/synergy" | "/api/synergy/" | "/attendance" | "/attendance/" | "/dev-login" | "/dev-login/" | "/documents" | "/documents/" | "/documents/document" | "/documents/document/" | "/feedback" | "/feedback/" | "/grades" | "/grades/" | "/grades/data" | "/grades/data/" | `/grades/${string}` & {} | `/grades/${string}/` & {} | "/login" | "/login/" | "/mail" | "/mail/" | "/mail/attachment" | "/mail/attachment/" | "/migrate" | "/migrate/" | "/migrate/import" | "/migrate/import/" | "/privacy" | "/privacy/" | "/signup" | "/signup/" | "/signup/google" | "/signup/google/" | "/studentinfo" | "/studentinfo/";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/apple-touch-icon-180x180.png" | "/demo_dark.webp" | "/demo_light.webp" | "/favicon.ico" | "/favicon.svg" | "/manifest.json" | "/maskable-icon-512x512.png" | "/mockServiceWorker.js" | "/password-reset-location.png" | "/pwa-192x192.png" | "/pwa-512x512.png" | "/pwa-64x64.png" | "/robots.txt" | string & {};
	}
}