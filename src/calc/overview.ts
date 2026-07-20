import type { Assignment, Category } from '../domain/index';
import { isCalculable, pointsByCategory } from './points';

export interface CategoryOverviewRow {
	name: string;
	pointsEarned: number;
	pointsPossible: number;
	// earned/possible over visible assignments; null when nothing graded yet.
	currentPct: number | null;
	// The declared weight; null for unweighted classes.
	nominalWeightPct: number | null;
	// Share of the final grade right now, after renormalization over graded
	// categories — "Finals is 20% on paper but 0% of your grade today".
	effectiveWeightPct: number;
	// effectiveWeight × currentPct: points this category adds to the course %.
	// Summed over all rows this equals the course grade.
	contributionPct: number;
	// Declared category totals exceeding the visible assignments (portal hides
	// some assignments); absent when they agree.
	hidden?: { pointsEarned: number; pointsPossible: number };
}

function weightedOverview(assignments: Assignment[], categories: Category[]): CategoryOverviewRow[] {
	const visible = pointsByCategory(assignments);
	const counted = categories.filter((c) => (visible.get(c.name)?.pointsPossible ?? 0) > 0);
	const totalWeight = counted.reduce((n, c) => n + c.weightPercentage, 0);

	return categories.map((c) => {
		const pts = visible.get(c.name) ?? { pointsEarned: 0, pointsPossible: 0 };
		const isCounted = pts.pointsPossible > 0 && totalWeight > 0;
		const currentPct = pts.pointsPossible > 0 ? (pts.pointsEarned / pts.pointsPossible) * 100 : null;
		const effectiveWeightPct = isCounted ? (c.weightPercentage / totalWeight) * 100 : 0;

		const hiddenEarned = c.pointsEarned - pts.pointsEarned;
		const hiddenPossible = c.pointsPossible - pts.pointsPossible;

		return {
			name: c.name,
			pointsEarned: pts.pointsEarned,
			pointsPossible: pts.pointsPossible,
			currentPct,
			nominalWeightPct: c.weightPercentage,
			effectiveWeightPct,
			contributionPct: isCounted ? (currentPct! / 100) * effectiveWeightPct : 0,
			...(hiddenEarned !== 0 || hiddenPossible !== 0
				? { hidden: { pointsEarned: hiddenEarned, pointsPossible: hiddenPossible } }
				: {})
		};
	});
}

function unweightedOverview(assignments: Assignment[]): CategoryOverviewRow[] {
	const buckets = new Map<string, { pointsEarned: number; pointsPossible: number }>();
	let totalPossible = 0;
	for (const a of assignments.filter(isCalculable)) {
		const name = a.category ?? 'All';
		const bucket = buckets.get(name) ?? { pointsEarned: 0, pointsPossible: 0 };
		bucket.pointsEarned += a.pointsEarned!;
		if (!a.extraCredit) {
			bucket.pointsPossible += a.pointsPossible!;
			totalPossible += a.pointsPossible!;
		}
		buckets.set(name, bucket);
	}

	return [...buckets.entries()].map(([name, pts]) => ({
		name,
		pointsEarned: pts.pointsEarned,
		pointsPossible: pts.pointsPossible,
		currentPct: pts.pointsPossible > 0 ? (pts.pointsEarned / pts.pointsPossible) * 100 : null,
		nominalWeightPct: null,
		effectiveWeightPct: totalPossible > 0 ? (pts.pointsPossible / totalPossible) * 100 : 0,
		contributionPct: totalPossible > 0 ? (pts.pointsEarned / totalPossible) * 100 : 0
	}));
}

export function categoryOverview(
	assignments: Assignment[],
	categories?: Category[]
): CategoryOverviewRow[] {
	return categories === undefined || categories.length === 0
		? unweightedOverview(assignments)
		: weightedOverview(assignments, categories);
}
