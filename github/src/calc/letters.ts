// Per-class letter cutoffs. The portal applies each teacher's scale
// server-side and only shows us the results, so cutoffs are OBSERVED from
// (percentage, letter) pairs the portal exposes, inferred conservatively, and
// overridable by the student. GradeCompass never computed cutoffs either - it
// displayed Synergy's letters; this reconstructs the scale those letters imply.

export const LETTER_ORDER = [
	'A+',
	'A',
	'A-',
	'B+',
	'B',
	'B-',
	'C+',
	'C',
	'C-',
	'D+',
	'D',
	'D-',
	'F'
] as const;

export type Letter = (typeof LETTER_ORDER)[number];

export const DEFAULT_SCALE: Record<Letter, number> = {
	'A+': 97,
	A: 93,
	'A-': 90,
	'B+': 87,
	B: 83,
	'B-': 80,
	'C+': 77,
	C: 73,
	'C-': 70,
	'D+': 67,
	D: 63,
	'D-': 60,
	F: 0
};

export interface Observation {
	pct: number;
	letter: string;
}

export interface ScaleRow {
	letter: Letter;
	lowerBound: number;
	source: 'observed' | 'default' | 'custom';
}

const isLetter = (s: string): s is Letter => (LETTER_ORDER as readonly string[]).includes(s);

// An observed pct carrying a letter proves that letter's lower bound is at or
// below that pct. Start from the default scale, drag bounds down to observed
// minimums, then enforce monotonicity (a letter's bound may not exceed the
// next-better letter's). Overrides win over everything.
export function inferScale(
	observations: Observation[],
	overrides: Partial<Record<Letter, number>> = {}
): ScaleRow[] {
	const minObserved = new Map<Letter, number>();
	for (const o of observations) {
		const letter = o.letter.trim();
		if (!isLetter(letter) || !Number.isFinite(o.pct)) continue;
		const current = minObserved.get(letter);
		if (current === undefined || o.pct < current) minObserved.set(letter, o.pct);
	}

	const rows: ScaleRow[] = LETTER_ORDER.map((letter) => {
		const observed = minObserved.get(letter);
		if (observed !== undefined && observed < DEFAULT_SCALE[letter]) {
			return { letter, lowerBound: observed, source: 'observed' };
		}
		return { letter, lowerBound: DEFAULT_SCALE[letter], source: 'default' };
	});

	for (let i = 1; i < rows.length; i++) {
		const better = rows[i - 1]!;
		const row = rows[i]!;
		if (row.lowerBound > better.lowerBound) {
			rows[i] = { ...row, lowerBound: better.lowerBound };
		}
	}

	return rows.map((row) => {
		const override = overrides[row.letter];
		return override !== undefined ? { ...row, lowerBound: override, source: 'custom' } : row;
	});
}

// Best letter whose lower bound the percentage clears.
export function resolveLetter(pct: number, scale: ScaleRow[]): string {
	for (const row of scale) {
		if (pct >= row.lowerBound) return row.letter;
	}
	return 'F';
}

// Merge newly-synced observations into the stored set: one entry per letter,
// keeping the lowest percentage seen (the only value inference uses).
export function mergeObservations(
	existing: Observation[],
	incoming: Observation[]
): Observation[] {
	const byLetter = new Map<string, Observation>();
	for (const o of [...existing, ...incoming]) {
		const letter = o.letter.trim();
		if (!isLetter(letter) || !Number.isFinite(o.pct)) continue;
		const current = byLetter.get(letter);
		if (!current || o.pct < current.pct) byLetter.set(letter, { pct: o.pct, letter });
	}
	return LETTER_ORDER.filter((l) => byLetter.has(l)).map((l) => byLetter.get(l)!);
}
