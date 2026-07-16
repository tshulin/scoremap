export const portalBase = (domain: string): string =>
	process.env.PORTAL_BASE_OVERRIDE ?? `https://${domain}`;
