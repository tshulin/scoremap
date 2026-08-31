import { describe, expect, it } from 'vitest';
import { markGrade } from '../../calc/index';
import { parseMobileGradebook } from './gradebook';

// Synthetic mobile Gradebook payload (no personal data) shaped exactly like the live
// data.traditionalGradebook response: a weighted course, a total-points course, and an
// out-of-term-style ungraded course, plus an ungraded assignment.
const PAYLOAD = {
	traditionalGradebook: {
		reportingPeriods: [
			{ index: '0', gradePeriod: 'Progress 1', startDate: '8/13/2026', endDate: '9/18/2026' },
			{ index: '1', gradePeriod: 'Quarter 1', startDate: '8/13/2026', endDate: '10/10/2026' }
		],
		reportingPeriod: { index: '0', gradePeriod: 'Progress 1' },
		courses: [
			{
				period: '6',
				title: 'AP Psychology (HP) (14560)',
				courseName: 'AP Psychology (HP)',
				courseID: '14560',
				room: 'C-1',
				staff: 'Jane Roe',
				staffEMail: 'jroe@example.org',
				marks: [
					{
						markName: 'P1',
						shortMarkName: 'P1',
						calculatedScoreString: 'C',
						calculatedScoreRaw: '77.60',
						gradeCalculationSummary: [
							{ type: 'Multiple Choice Exams', weight: '70%', points: '34.00', pointsPossible: '50.00', weightedPct: '47.60%', calculatedMark: 'D+' },
							{ type: 'Classwork / Homework', weight: '30%', points: '13.00', pointsPossible: '13.00', weightedPct: '30.00%', calculatedMark: 'A+' },
							{ type: 'TOTAL', weight: '100%', points: '47.00', pointsPossible: '63.00', weightedPct: '77.60%', calculatedMark: 'C' }
						],
						assignments: [
							{ gradebookID: 1, measure: 'Unit 1 Exam', type: 'Multiple Choice Exams', date: '8/21/2026', dueDate: '8/21/2026', score: '34', displayScore: '34 out of 50', scoreCalValue: '34', scoreMaxValue: '50', scoreType: 'Raw Score', points: '34 / 50', point: '34', pointPossible: '50', notes: '', measureDescription: '' },
							{ gradebookID: 2, measure: 'Unit 1 Outline', type: 'Classwork / Homework', date: '8/21/2026', dueDate: '8/21/2026', score: '13', displayScore: '13 out of 13', scoreCalValue: '13', scoreMaxValue: '13', scoreType: 'Raw Score', points: '13 / 13', point: '13', pointPossible: '13', notes: '', measureDescription: '' },
							{ gradebookID: 3, measure: 'Summer Vocab', type: 'Multiple Choice Exams', date: '8/15/2026', dueDate: '8/20/2026', score: null, displayScore: 'Not Graded', scoreCalValue: null, scoreMaxValue: null, scoreType: 'Raw Score', points: '55 Points Possible', point: null, pointPossible: null, notes: '', measureDescription: '' }
						]
					}
				]
			},
			{
				period: '4',
				title: 'AP Chemistry (HP) (14829)',
				courseName: 'AP Chemistry (HP)',
				courseID: '14829',
				room: 'S-2',
				staff: 'John Doe',
				marks: [
					{
						markName: 'P1',
						calculatedScoreString: 'B-',
						calculatedScoreRaw: '80.00',
						gradeCalculationSummary: [
							{ type: 'TOTAL', weight: '100%', points: '8.00', pointsPossible: '10.00', weightedPct: '80.00%', calculatedMark: 'B-' }
						],
						assignments: [
							{ gradebookID: 10, measure: 'Lab 1', type: 'Labs', date: '8/20/2026', score: '8', displayScore: '8 out of 10', points: '8 / 10', point: '8', pointPossible: '10', notes: '', measureDescription: '' }
						]
					}
				]
			},
			{
				period: '1',
				title: 'AP Calculus AB (HP) (14807)',
				courseName: 'AP Calculus AB (HP)',
				courseID: '14807',
				room: 'M-3',
				staff: 'Ada Lovelace',
				marks: [
					{ markName: 'P1', calculatedScoreString: 'N/A', calculatedScoreRaw: '0.0', gradeCalculationSummary: {}, assignments: [] }
				]
			}
		]
	}
};

describe('parseMobileGradebook', () => {
	const gradebook = parseMobileGradebook(PAYLOAD as unknown as Record<string, unknown>);
	const [psych, chem, calc] = gradebook.courses;

	it('maps reporting periods and the current index', () => {
		expect(gradebook.reportingPeriods).toEqual([
			{ index: 0, name: 'Progress 1' },
			{ index: 1, name: 'Quarter 1' }
		]);
		expect(gradebook.currentPeriodIndex).toBe(0);
	});

	it('parses weighted categories, dropping the TOTAL rollup', () => {
		expect(psych!.marks[0]!.categories).toEqual([
			{ name: 'Multiple Choice Exams', weightPercentage: 70, pointsEarned: 34, pointsPossible: 50, weightedPercentage: 47.6, letter: 'D+' },
			{ name: 'Classwork / Homework', weightPercentage: 30, pointsEarned: 13, pointsPossible: 13, weightedPercentage: 30, letter: 'A+' }
		]);
	});

	it('computes the weighted grade the portal shows (77.6, not the 74.6 raw)', () => {
		expect(markGrade(psych!.marks[0]!)).toBeCloseTo(77.6, 1);
		expect(psych!.marks[0]!.percentage).toBeCloseTo(77.6, 1);
	});

	it('reads graded and ungraded assignments correctly', () => {
		const [exam, outline, vocab] = psych!.marks[0]!.assignments;
		expect(exam).toMatchObject({ name: 'Unit 1 Exam', pointsEarned: 34, pointsPossible: 50, category: 'Multiple Choice Exams' });
		expect(outline).toMatchObject({ pointsEarned: 13, pointsPossible: 13 });
		// Ungraded: no earned points, possible recovered from the "55 Points Possible" text.
		expect(vocab!.pointsEarned).toBeUndefined();
		expect(vocab!.pointsPossible).toBe(55);
	});

	it('treats a TOTAL-only summary as total points (no categories)', () => {
		expect(chem!.marks[0]!.categories).toBeUndefined();
		expect(markGrade(chem!.marks[0]!)).toBeCloseTo(80, 1);
	});

	it('renders an ungraded course as blank letter, zero percent', () => {
		expect(calc!.marks[0]!.letter).toBe('');
		expect(calc!.marks[0]!.percentage).toBe(0);
		expect(calc!.marks[0]!.assignments).toEqual([]);
	});

	it('strips the trailing courseID from the title', () => {
		expect(psych!.name).toBe('AP Psychology (HP)');
		expect(psych!.title).toBe('AP Psychology (HP)');
	});
});
