// DevExpress grid cells are usually plain strings, but two wrapped shapes are
// seen in the wild: an object with the display text under `value`, and that
// same object serialized INTO the string ('{"href":...,"value":"Design
// Brief","dataType":"LinkColumn"}') - live-observed by other scrapers, where
// the hidden link parameters were misread as titles and scores. Unwrap all
// three shapes.
export function cellText(value: unknown): string | undefined {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (trimmed.startsWith('{') && trimmed.includes('"value"')) {
			try {
				const inner = cellText(JSON.parse(trimmed));
				if (inner !== undefined) return inner;
			} catch {
				// not JSON after all - it's the cell text itself
			}
		}
		return value;
	}
	if (typeof value === 'number') return String(value);
	if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
		const inner = (value as Record<string, unknown>)['value'];
		if (inner !== undefined && inner !== value) return cellText(inner);
	}
	return undefined;
}

export function cellNumber(value: unknown): number | undefined {
	const text = cellText(value);
	if (text === undefined) return undefined;
	const cleaned = text.replace(/[%,]/g, '').trim();
	if (cleaned === '') return undefined;
	const parsed = Number.parseFloat(cleaned);
	return Number.isNaN(parsed) ? undefined : parsed;
}
