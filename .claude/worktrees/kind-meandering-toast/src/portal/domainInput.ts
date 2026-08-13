// Forgiving parser for the "StudentVUE domain" field. Users paste whatever
// they have — a bare hostname, a full login URL, the URL of their gradebook
// page, a link with no scheme — and we pull the portal address out of it.
//
// A portal address is a hostname plus an optional base path: most districts
// live at a bare host ("ca-sfu-psv.edupoint.com"), but ~30% of them share a
// server under a path ("studentvue.geneseeisd.org/wpa"). Page files
// ("PXP2_Gradebook.aspx"), queries, and fragments are never part of it.

const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const PATH_SEGMENT_RE = /^[a-z0-9][a-z0-9._~-]*$/;

// Something hostname-shaped inside larger text (requires at least one dot),
// with an optional /path run after it.
const HOSTNAME_ANYWHERE_RE = /[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+(\/[a-z0-9._~-]+)*/i;

/** True for a normalized portal address ("host" or "host/base/path"). */
export function isPortalDomain(domain: string): boolean {
	const [host, ...segments] = domain.split('/');
	if (!host || !HOST_RE.test(host)) return false;
	return segments.every((s) => PATH_SEGMENT_RE.test(s));
}

const fromUrl = (url: URL): string | null => {
	const host = url.hostname.replace(/\.+$/, '').toLowerCase();
	if (!HOST_RE.test(host)) return null;
	// Path: drop empty segments, then drop a trailing page file — any last
	// segment with a dot in it ("PXP2_Login_Student.aspx", "default.aspx").
	const segments = url.pathname.toLowerCase().split('/').filter(Boolean);
	if (segments.length && segments[segments.length - 1]!.includes('.')) segments.pop();
	const domain = [host, ...segments].join('/');
	return isPortalDomain(domain) ? domain : host;
};

/**
 * Extract the portal address from whatever the user pasted, or null if
 * nothing hostname-shaped is in there.
 *
 *   "ca-sfu-psv.edupoint.com"                                    → "ca-sfu-psv.edupoint.com"
 *   "https://ca-sfu-psv.edupoint.com/PXP2_Gradebook.aspx?AGU=0"  → "ca-sfu-psv.edupoint.com"
 *   "  HTTP://CA-SFU-PSV.EDUPOINT.COM/  "                        → "ca-sfu-psv.edupoint.com"
 *   "studentvue.geneseeisd.org/wpa/PXP2_Login_Student.aspx"      → "studentvue.geneseeisd.org/wpa"
 */
export function extractPortalDomain(input: string): string | null {
	const raw = (input ?? '').trim();
	if (!raw) return null;

	// Try to parse the whole thing as a URL: as pasted (has a scheme),
	// scheme-relative ("//host/path"), or with https:// prepended (covers bare
	// hostnames and "host/path" copies without a scheme).
	const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
		? raw
		: raw.startsWith('//')
			? `https:${raw}`
			: `https://${raw}`;
	try {
		const domain = fromUrl(new URL(candidate));
		if (domain) return domain;
	} catch {
		/* not URL-shaped; fall through */
	}

	// Last resort: the first hostname-looking run anywhere in the text.
	const match = raw.match(HOSTNAME_ANYWHERE_RE);
	if (!match) return null;
	try {
		return fromUrl(new URL(`https://${match[0]}`));
	} catch {
		return null;
	}
}
