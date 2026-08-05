import type { Assignment, Category } from '../domain/index';
import { courseGrade } from './grade';
import { isCalculable } from './points';

export interface GradePoint {
	date: string;
	grade: number;
	assignments: Assignment[];
}

// The grade-over-time series is derived, not stored: replay calculable
// assignments in date order and take the course grade after each date. The
// last point therefore always equals the current computed grade. Editing a
// past score rewrites the "past" - inherent to a derived series.
export function gradeSeries(assignments: Assignment[], categories?: Category[]): GradePoint[] {
	const byDate = new Map<string, Assignment[]>();
	for (const a of assignments.filter(isCalculable)) {
		const bucket = byDate.get(a.date);
		if (bucket) bucket.push(a);
		else byDate.set(a.date, [a]);
	}

	const series: GradePoint[] = [];
	const running: Assignment[] = [];
	for (const date of [...byDate.keys()].sort()) {
		const todays = byDate.get(date)!;
		running.push(...todays);
		series.push({ date, grade: courseGrade(running, categories), assignments: todays });
	}
	return series;
}
