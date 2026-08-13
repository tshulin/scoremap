// Portal base URL. Defaults to the real portal over HTTPS; the relay fetch-shim
// reads the host from the URL to open its tunnel. Overridable for tests (e.g.
// pointing the whole client at a mock) without relying on Node's process.env.
let override: string | null = null;

export function setPortalBaseOverride(value: string | null): void {
	override = value;
}

export const portalBase = (domain: string): string => override ?? `https://${domain}`;
