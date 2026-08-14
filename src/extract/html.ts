const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' '
};

export function decodeEntities(text: string): string {
	return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
		if (body[0] === '#') {
			const code =
				body[1] === 'x' || body[1] === 'X'
					? Number.parseInt(body.slice(2), 16)
					: Number.parseInt(body.slice(1), 10);
			return Number.isNaN(code) ? match : String.fromCodePoint(code);
		}
		return NAMED_ENTITIES[body.toLowerCase()] ?? match;
	});
}

export function stripTags(html: string): string {
	return decodeEntities(html.replace(/<[^>]+>/g, ''))
		.replace(/\s+/g, ' ')
		.trim();
}

export function parseLabeledFields(html: string): Record<string, string> {
	const fields: Record<string, string> = {};
	const re =
		/<span[^>]*\bclass="[^"]*\btbl_label\b[^"]*"[^>]*>([^<]+)<\/span>\s*<br\s*\/?>\s*([^<]*)/gi;
	for (const match of html.matchAll(re)) {
		const label = decodeEntities(match[1] ?? '').trim();
		if (label) fields[label] = decodeEntities(match[2] ?? '').trim();
	}
	return fields;
}

export function bootstrapValue(html: string, key: string): string | undefined {
	const re = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*")`);
	const match = re.exec(html);
	if (!match?.[1]) return undefined;
	try {
		const parsed: unknown = JSON.parse(match[1]);
		return typeof parsed === 'string' ? parsed : undefined;
	} catch {
		return undefined;
	}
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
