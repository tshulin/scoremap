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
