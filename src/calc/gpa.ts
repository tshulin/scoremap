export const GPA_GRADES = ['A', 'B', 'C', 'D', 'F'] as const;

export type GpaGrade = (typeof GPA_GRADES)[number];

export interface GpaCourse {
	grade: GpaGrade;
	weighted: boolean;
	credits?: number;
}

export interface SemesterGpa {
	unweighted: number;
	weighted: number;
}

export interface HistoricalGpa {
	unweighted: number;
	weighted: number;
	credits: number;
}

export interface CumulativeProjection {
	semester: SemesterGpa;
	projected: SemesterGpa;
	credits: number;
}

const BASE_POINTS: Record<GpaGrade, number> = {
	A: 4,
	B: 3,
	C: 2,
	D: 1,
	F: 0
};

export function gpaPoints(grade: GpaGrade, weighted = false): number {
	const base = BASE_POINTS[grade];
	return base + (weighted && base > 0 ? 1 : 0);
}

// Portal letters carry +/- modifiers the four-point scale ignores; ungraded
// classes show 'N/A'. Some districts use E as the failing letter.
export function toGpaGrade(letter: string): GpaGrade | null {
	const base = letter.trim().charAt(0).toUpperCase();
	if (base === 'E') return 'F';
	return (GPA_GRADES as readonly string[]).includes(base) ? (base as GpaGrade) : null;
}

// The portal does not say which courses a district weights, so imports guess
// from the course title; the student can correct the type per row.
export function isWeightedCourseName(name: string): boolean {
	return /\b(ap|ib|hn|hp|hon)\b/i.test(name) || /honors|advanced placement/i.test(name);
}

export function semesterGpa(courses: GpaCourse[]): SemesterGpa | null {
	if (courses.length === 0) return null;

	let unweightedTotal = 0;
	let weightedTotal = 0;
	let credits = 0;

	for (const course of courses) {
		const courseCredits = Number.isFinite(course.credits) && Number(course.credits) > 0 ? Number(course.credits) : 1;
		credits += courseCredits;
		unweightedTotal += gpaPoints(course.grade) * courseCredits;
		weightedTotal += gpaPoints(course.grade, course.weighted) * courseCredits;
	}

	return {
		unweighted: unweightedTotal / credits,
		weighted: weightedTotal / credits
	};
}

export function projectCumulativeGpa(courses: GpaCourse[], historical: HistoricalGpa): CumulativeProjection | null {
	const semester = semesterGpa(courses);
	if (
		!semester ||
		!Number.isFinite(historical.unweighted) || historical.unweighted < 0 || historical.unweighted > 5 ||
		!Number.isFinite(historical.weighted) || historical.weighted < 0 || historical.weighted > 5 ||
		!Number.isFinite(historical.credits) || historical.credits <= 0
	) return null;
	const credits = courses.reduce((sum, course) => sum + (Number.isFinite(course.credits) && Number(course.credits) > 0 ? Number(course.credits) : 1), 0);
	const totalCredits = historical.credits + credits;
	return {
		semester,
		credits,
		projected: {
			unweighted: (historical.unweighted * historical.credits + semester.unweighted * credits) / totalCredits,
			weighted: (historical.weighted * historical.credits + semester.weighted * credits) / totalCredits
		}
	};
}
