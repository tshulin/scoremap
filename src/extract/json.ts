const DATA_SOURCE_NEEDLE = '"dataSource":';

export function extractJsonAfter(source: string, needle: string): unknown {
	const start = source.indexOf(needle);
	if (start === -1) return undefined;

	let i = start + needle.length;
	while (i < source.length && source[i] !== '[' && source[i] !== '{') i++;
	if (i >= source.length) return undefined;

	const open = source[i];
	const close = open === '[' ? ']' : '}';
	let depth = 0;
	let inString = false;
	let escaped = false;

	for (let j = i; j < source.length; j++) {
		const ch = source[j];
		if (escaped) {
			escaped = false;
			continue;
		}
		if (ch === '\\') {
			escaped = true;
			continue;
		}
		if (ch === '"') {
			inString = !inString;
			continue;
		}
		if (inString) continue;
		if (ch === open) {
			depth++;
		} else if (ch === close) {
			depth--;
			if (depth === 0) {
				try {
					return JSON.parse(source.slice(i, j + 1));
				} catch {
					return undefined;
				}
			}
		}
	}
	return undefined;
}

const isRecordArray = (value: unknown): value is Array<Record<string, unknown>> =>
	Array.isArray(value) &&
	value.length > 0 &&
	typeof value[0] === 'object' &&
	value[0] !== null &&
	!Array.isArray(value[0]);

export function findDataSourceWithKeys(
	html: string,
	keys: string[]
): Array<Record<string, unknown>> {
	let from = 0;
	for (;;) {
		const idx = html.indexOf(DATA_SOURCE_NEEDLE, from);
		if (idx === -1) return [];
		const value = extractJsonAfter(html.slice(idx), DATA_SOURCE_NEEDLE);
		if (isRecordArray(value) && keys.some((key) => key in value[0]!)) {
			return value;
		}
		from = idx + DATA_SOURCE_NEEDLE.length;
	}
}

export function countDataSources(html: string): number {
	return (html.match(/"dataSource":/g) ?? []).length;
}
