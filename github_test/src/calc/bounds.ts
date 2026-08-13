import type { Assignment, Category } from '../domain/index';
import { courseGrade } from './grade';
import { isCalculable } from './points';

export interface RemainingWork {
	// Omitted for unweighted classes (one overall row).
	category?: string;
	pointsRemaining: number;
	// Expected worst/best average % on the remaining work.
	minPct: number;
	maxPct: number;
}

export interface GradeBoundsOptions {
	assignments: Assignment[];
	categories?: Category[];
	remaining: RemainingWork[];
}

export interface GradeBounds {
	min: number;
	max: number;
	perCategory: { name: string; min: number | null; max: number | null }[];
}

// The course grade is monotone increasing in each category's expected
// percentage — a category grade is (E + x·R)/(P + R), rising in x, and both
// grading modes combine category grades with non-negative coefficients. So the
// global minimum is every category at its minPct and the maximum every
// category at its maxPct; no search is needed. Entering remaining points for a
// currently-empty weighted category pulls its weight into the renormalized
// grade, which is exactly the "how much can finals hurt me" question.
export function gradeBounds(options: GradeBoundsOptions): GradeBounds {
	const { assignments, categories, remaining } = options;

	for (const r of remaining) {
		if (r.pointsRemaining < 0) throw new Error('pointsRemaining must be ≥ 0.');
		if (r.minPct > r.maxPct) throw new Error('minPct must be ≤ maxPct.');
	}

	let syntheticId = 0;
	const at = (which: 'minPct' | 'maxPct'): Assignment[] => [
		...assignments,
		...remaining
			.filter((r) => r.pointsRemaining > 0)
			.map(
				(r): Assignment => ({
					id: `bounds-${which}-${syntheticId++}`,
					name: 'Remaining work',
					pointsEarned: (r[which] / 100) * r.pointsRemaining,
					pointsPossible: r.pointsRemaining,
					extraCredit: false,
					notForGrade: false,
					...(r.category !== undefined ? { category: r.category } : {}),
					date: '2099-01-01'
				})
			)
	];

	// Per-category interval: (E + x·R)/(P + R) over that category's own points.
	const perCategory = (categories && categories.length > 0 ? categories.map((c) => c.name) : ['All']).map(
		(name) => {
			let earned = 0;
			let possible = 0;
			for (const a of assignments.filter(isCalculable)) {
				const label = categories && categories.length > 0 ? a.category : 'All';
				if (label !== name) continue;
				earned += a.pointsEarned!;
				if (!a.extraCredit) possible += a.pointsPossible!;
			}
			const rem = remaining
				.filter((r) => (categories && categories.length > 0 ? r.category === name : true))
				.reduce((n, r) => n + r.pointsRemaining, 0);
			const remWeighted = (which: 'minPct' | 'maxPct') =>
				remaining
					.filter((r) => (categories && categories.length > 0 ? r.category === name : true))
					.reduce((n, r) => n + (r[which] / 100) * r.pointsRemaining, 0);

			const total = possible + rem;
			return {
				name,
				min: total > 0 ? ((earned + remWeighted('minPct')) / total) * 100 : null,
				max: total > 0 ? ((earned + remWeighted('maxPct')) / total) * 100 : null
			};
		}
	);

	return {
		min: courseGrade(at('minPct'), categories),
		max: courseGrade(at('maxPct'), categories),
		perCategory
	};
}
