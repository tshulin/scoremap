export const GPA_GRADES = ['A', 'B', 'C', 'D', 'F'] as const;

export type GpaGrade = (typeof GPA_GRADES)[number];

export interface GpaCourse {
	grade: GpaGrade;
	weighted: boolean;
}

export interface SemesterGpa {
	unweighted: number;
	weighted: number;
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
// classes show '—'. Some districts use E as the failing letter.
export function toGpaGrade(letter: string): GpaGrade | null {
	const base = letter.trim().charAt(0).toUpperCase();
	if (base === 'E') return 'F';
	return (GPA_GRADES as readonly string[]).includes(base) ? (base as GpaGrade) : null;
}

// The portal does not say which courses a district weights, so imports guess
// from the course title; the student can correct the type per row.
export function isWeightedCourseName(name: string): boolean {
	return /\b(ap|ib|hn)\b/i.test(name) || /honors|advanced placement/i.test(name);
}

export function semesterGpa(courses: GpaCourse[]): SemesterGpa | null {
	if (courses.length === 0) return null;

	let unweightedTotal = 0;
	let weightedTotal = 0;

	for (const course of courses) {
		unweightedTotal += gpaPoints(course.grade);
		weightedTotal += gpaPoints(course.grade, course.weighted);
	}

	return {
		unweighted: unweightedTotal / courses.length,
		weighted: weightedTotal / courses.length
	};
}
