import { describe, expect, it } from 'vitest';
import {
	ModuleUnavailableError,
	NoActiveGradingPeriodError,
	SessionExpiredError
} from '../../errors';
import { CookieJar, type PortalResponse } from '../../http';
import type { PortalSession } from '../../login';
import { assignmentRowToDomain } from './assignment';
import { parseLandingClasses } from './landing';
import { fetchGradebook } from './index';
import type { Gradebook } from '../../../domain/index';

const session = (): PortalSession => ({ domain: 'ca-test-psv.edupoint.com', jar: new CookieJar() });

interface FakeResponseInit {
	status?: number;
	headers?: Record<string, string>;
	body?: string;
}

const fakeResponse = ({ status = 200, headers = {}, body = '' }: FakeResponseInit): PortalResponse => {
	const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
	return {
		status,
		ok: status >= 200 && status < 300,
		headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
		text: async () => body,
		arrayBuffer: async () => new TextEncoder().encode(body).buffer as ArrayBuffer
	};
};

interface Call {
	url: string;
	body?: string;
}

function fakeFetch(responses: PortalResponse[]) {
	const calls: Call[] = [];
	const fetchImpl = async (url: string, init: RequestInit): Promise<PortalResponse> => {
		calls.push({ url, body: typeof init.body === 'string' ? init.body : undefined });
		const next = responses.shift();
		if (!next) throw new Error(`unexpected request to ${url}`);
		return next;
	};
	return { fetchImpl, calls };
}

// ---- fixtures mirroring the live capture's markup (sanitized) ----

const FOCUS_DATA = {
	CanShowCourseContent: true,
	Schools: [
		{
			SchoolID: 16,
			SchoolName: 'Sample High School',
			GradingPeriods: [
				{
					Name: 'Progress 1',
					GroupName: 'Regular',
					GU: 'GP-1',
					MarkPeriods: [{ Name: 'P1', GU: 'MP-1' }],
					OrgYearGU: 'OY-1',
					schoolID: 16,
					defaultFocus: true
				},
				{
					Name: 'Quarter 1',
					GroupName: 'Regular',
					GU: 'GP-2',
					MarkPeriods: [{ Name: 'Q1', GU: 'MP-2' }],
					OrgYearGU: 'OY-1',
					schoolID: 16,
					defaultFocus: false
				}
			]
		}
	]
};

const focusFor = (classId: number, markPeriodGu = 'MP-1') => ({
	LoadParams: { ControlName: 'Gradebook_ClassDetails', HideHeader: false },
	FocusArgs: {
		viewName: null,
		studentGU: 'STU-1',
		schoolID: 16,
		classID: classId,
		markPeriodGU: markPeriodGu,
		gradePeriodGU: 'GP-1',
		subjectID: -1,
		teacherID: -1,
		assignmentID: -1,
		standardIdentifier: null,
		AGU: '0',
		OrgYearGU: 'OY-1',
		gradingPeriodGroup: null
	}
});

interface RowSpec {
	classId: number;
	title: string;
	teacher?: string;
	room?: string;
	mark?: string;
	missing?: number;
	lastUpdate?: string;
	history?: string[];
	markPeriodName?: string;
}

const classRow = ({
	classId,
	title,
	teacher = 'Pat Teacher',
	room = 'D-1',
	mark = 'N/A',
	missing = 0,
	lastUpdate = '',
	history = [],
	markPeriodName = 'P1'
}: RowSpec): string => `
<div class="row gb-class-header gb-class-row flexbox horizontal" data-guid="${classId}">
	<div scope="row">
		<button type="button" style="padding-bottom: 0px" class="btn btn-link course-title" data-focus='${JSON.stringify(focusFor(classId))}' data-action="GB.LoadControl">${title}</button>
	</div>
	<div class=''>
		<div class="teacher hide-for-screen">${teacher}</div>
		<div class="teacher-room hide-for-print">Room: ${room}</div>
	</div>
</div>
<div class="row gb-class-row" data-guid="${classId}" data-mark-gu="mp-1">
	<div class="inline" scope="row">
		<button type="button" class="btn btn-link course-markperiod" data-focus='${JSON.stringify(focusFor(classId))}' data-action="GB.LoadControl">${markPeriodName}</button>
	</div>
	<div><span class="mark">${mark}</span></div>
	<div class="class-item-lessemphasis hide-for-print">
		<div>${missing} Missing Assignments</div>
	</div>
	<div class="col-sm-4 hide-for-print">
		<canvas class="sparkline"></canvas>
		<span class="last-update">Last Update: ${lastUpdate}</span>
		<ul class="score-history sr-only">${history.map((h) => `<li>${h}</li>`).join('')}</ul>
	</div>
</div>`;

const landingPage = (rows: string): string => `<!DOCTYPE html><html><head><title>Grade Book</title></head><body>
<script type="text/javascript">
	PXP.AGU = "0";
	PXP.GBFocusData = ${JSON.stringify(FOCUS_DATA)};
	PXP.GBCurrentFocus = ${JSON.stringify({
		LoadParams: { ControlName: null, HideHeader: false },
		FocusArgs: { viewName: '', studentGU: 'STU-1', schoolID: 16, AGU: '0', OrgYearGU: 'OY-1' }
	})};
	PXP.GBInitialGradingPeriods = {};
</script>
<div class="update-panel" data-school-id="16" data-period-group="Regular">${rows}</div>
</body></html>`;

const envelope = (html: string): string =>
	JSON.stringify({
		d: {
			__type: 'PXP.PXPInfo.PXPWebResponse',
			Error: null,
			Data: { html },
			DataType: 'LoadControlResponse'
		}
	});

const errorEnvelope = (message: string): string =>
	JSON.stringify({ d: { Error: { Message: message }, Data: null } });

interface FragmentSpec {
	mark?: string;
	score?: string;
	categories?: unknown[];
	assignments?: unknown[];
}

const detailFragment = ({
	mark = 'N/A',
	score = '0.0%',
	categories = [],
	assignments = []
}: FragmentSpec): string => `
<div class="detail-content">
	<div id="ctl00_CurrentGrade" class="col-md-3">
		<div id="current-grade">
			<div class="mark">${mark}</div>
			<div class="score">${score}</div>
		</div>
		<div id="what-if-grade">
			<div class="mark">N/A</div>
			<div class="score">N/A</div>
		</div>
	</div>
	<div id="CategoryWeightsGrid">
		<div id="CategoryWeightingGrid"></div>
		<script type="text/javascript">
			$('#CategoryWeightingGrid').dxDataGrid(PXP.DevExpress.ExtendGridConfiguration({"columns":[],"dataSource":${JSON.stringify(categories)},"noDataText":"No Data"}));
		</script>
	</div>
	<div id="assignment-details">
		<div id="AssignmentsGrid"></div>
		<script type="text/javascript">
			$('#AssignmentsGrid').dxDataGrid(PXP.DevExpress.ExtendGridConfiguration({"columns":[{"dataField":"Date"}],"dataSource":${JSON.stringify(assignments)},"noDataText":"No Data"}));
		</script>
	</div>
</div>`;

const GB_ROW_GRADED = {
	Date: '08/20/2026',
	googleAssignmentLink: '',
	GBAssignment:
		'<button type="button" class="btn btn-link" data-focus="{&quot;LoadParams&quot;:{&quot;ControlName&quot;:&quot;Gradebook_AssignmentDetails&quot;},&quot;FocusArgs&quot;:{&quot;assignmentID&quot;:5501,&quot;classID&quot;:101}}">Chapter 1 Quiz</button>',
	GBAssignmentType: 'Assessments',
	GBSubject: '',
	GBResources: '',
	GBScore: '8 out of 10',
	GBScoreType: 'Raw Score',
	GBPoints: '8.00 / 10.0000',
	GBNotes: ''
};

const GB_ROW_UNGRADED = {
	...GB_ROW_GRADED,
	GBAssignment: '<button type="button">Lab Report</button>',
	GBAssignmentType: 'Labs',
	GBScore: '',
	GBScoreType: '',
	GBPoints: '10.00 Points Possible'
};

const GB_ROW_NOT_FOR_GRADE = {
	...GB_ROW_GRADED,
	GBAssignment: '<button type="button">Practice Set</button>',
	GBScore: '',
	GBScoreType: '',
	GBPoints: '',
	GBNotes: '(Not For Grading) Optional practice'
};

describe('fetchGradebook', () => {
	it('syncs an untouched term in a single request', async () => {
		const { fetchImpl, calls } = fakeFetch([
			fakeResponse({
				body: landingPage(
					classRow({ classId: 101, title: '1: AP Statistics (HP)' }) +
						classRow({ classId: 102, title: '2: AP Chemistry (HP)', teacher: 'Sam Cruz', room: 'B-2' })
				)
			})
		]);

		const gradebook = await fetchGradebook(session(), undefined, { fetchImpl });

		expect(calls).toHaveLength(1);
		expect(calls[0]!.url).toContain('PXP2_Gradebook.aspx');
		expect(gradebook.reportingPeriods.map((p) => p.name)).toEqual(['Progress 1', 'Quarter 1']);
		expect(gradebook.currentPeriodIndex).toBe(0);
		expect(gradebook.courses).toHaveLength(2);

		const [stats, chem] = gradebook.courses;
		expect(stats!.name).toBe('AP Statistics (HP)');
		expect(stats!.period).toBe('1');
		expect(stats!.room).toBe('D-1');
		expect(stats!.staff.name).toBe('Pat Teacher');
		expect(stats!.marks[0]!).toMatchObject({
			name: 'Progress 1',
			shortName: 'P1',
			letter: '',
			percentage: 0,
			assignments: []
		});
		expect(chem!.staff.name).toBe('Sam Cruz');
		expect(gradebook.unreadableCourses).toBe(0);
	});

	it('fetches details only for classes with signs of work', async () => {
		const { fetchImpl, calls } = fakeFetch([
			fakeResponse({
				body: landingPage(
					classRow({ classId: 101, title: '1: AP Statistics (HP)', mark: 'B+', lastUpdate: '08/21/2026' }) +
						classRow({ classId: 102, title: '2: AP Chemistry (HP)' })
				)
			}),
			fakeResponse({
				body: envelope(
					detailFragment({
						mark: 'B+',
						score: '87.30%',
						assignments: [GB_ROW_GRADED, GB_ROW_UNGRADED, GB_ROW_NOT_FOR_GRADE]
					})
				)
			})
		]);

		const gradebook = await fetchGradebook(session(), undefined, { fetchImpl });

		expect(calls).toHaveLength(2);
		expect(calls[1]!.url).toContain('PXP2Communication.asmx/LoadControl');
		expect(calls[1]!.body).toContain('"control":"Gradebook_ClassDetails"');
		expect(calls[1]!.body).toContain('"classID":101');

		const mark = gradebook.courses[0]!.marks[0]!;
		expect(mark.letter).toBe('B+');
		expect(mark.percentage).toBe(87.3);
		expect(mark.assignments).toHaveLength(3);

		const [quiz, lab, practice] = mark.assignments;
		expect(quiz!.id).toBe('5501');
		expect(quiz!.name).toBe('Chapter 1 Quiz');
		expect(quiz!.category).toBe('Assessments');
		expect(quiz!.pointsEarned).toBe(8);
		expect(quiz!.pointsPossible).toBe(10);
		expect(quiz!.unscaledPoints).toBeUndefined();
		expect(quiz!.date).toBe('2026-08-20');
		expect(lab!.pointsEarned).toBeUndefined();
		expect(lab!.pointsPossible).toBe(10);
		expect(practice!.notForGrade).toBe(true);
		expect(practice!.comments).toBe('Optional practice');

		expect(gradebook.courses[1]!.marks[0]!.assignments).toEqual([]);
	});

	it('reads weighted categories when the grid recognizably carries them', async () => {
		const { fetchImpl } = fakeFetch([
			fakeResponse({
				body: landingPage(classRow({ classId: 101, title: '1: AP Statistics (HP)', mark: 'A' }))
			}),
			fakeResponse({
				body: envelope(
					detailFragment({
						mark: 'A',
						score: '93.10%',
						categories: [
							{
								CategoryName: 'Tests',
								Weight: '60%',
								Points: 45,
								PointsPossible: 50,
								WeightedPct: '54.0%',
								CalculatedMark: 'A'
							},
							{
								CategoryName: 'Homework',
								Weight: '40%',
								Points: 18,
								PointsPossible: 20,
								WeightedPct: '36.0%',
								CalculatedMark: 'A'
							}
						],
						assignments: [GB_ROW_GRADED]
					})
				)
			})
		]);

		const gradebook = await fetchGradebook(session(), undefined, { fetchImpl });
		const mark = gradebook.courses[0]!.marks[0]!;
		expect(mark.categories).toEqual([
			{
				name: 'Tests',
				weightPercentage: 60,
				pointsEarned: 45,
				pointsPossible: 50,
				weightedPercentage: 54,
				letter: 'A'
			},
			{
				name: 'Homework',
				weightPercentage: 40,
				pointsEarned: 18,
				pointsPossible: 20,
				weightedPercentage: 36,
				letter: 'A'
			}
		]);
		expect(gradebook.unreadableCategories).toBe(0);
	});

	it('drops the whole category list when any row is unreadable, and counts it', async () => {
		const { fetchImpl } = fakeFetch([
			fakeResponse({
				body: landingPage(classRow({ classId: 101, title: '1: AP Statistics (HP)', mark: 'A' }))
			}),
			fakeResponse({
				body: envelope(
					detailFragment({
						mark: 'A',
						score: '93.10%',
						categories: [
							{ CategoryName: 'Tests', Weight: '60%', Points: 45, PointsPossible: 50, WeightedPct: '54.0%', CalculatedMark: 'A' },
							{ CategoryName: 'Mystery', Weight: 'soon' }
						],
						assignments: [GB_ROW_GRADED]
					})
				)
			})
		]);

		const gradebook = await fetchGradebook(session(), undefined, { fetchImpl });
		expect(gradebook.courses[0]!.marks[0]!.categories).toBeUndefined();
		expect(gradebook.unreadableCategories).toBe(2);
	});

	it('degrades an unreadable assignment row, not the course', async () => {
		const { fetchImpl } = fakeFetch([
			fakeResponse({
				body: landingPage(classRow({ classId: 101, title: '1: AP Statistics (HP)', mark: 'B+' }))
			}),
			fakeResponse({
				body: envelope(
					detailFragment({
						mark: 'B+',
						score: '87.30%',
						assignments: [GB_ROW_GRADED, { ...GB_ROW_GRADED, Date: 'sometime' }]
					})
				)
			})
		]);

		const gradebook = await fetchGradebook(session(), undefined, { fetchImpl });
		expect(gradebook.courses[0]!.marks[0]!.assignments).toHaveLength(1);
		expect(gradebook.unreadableAssignments).toBe(1);
	});

	it('degrades a course whose detail response is unreadable, and counts it', async () => {
		const { fetchImpl, calls } = fakeFetch([
			fakeResponse({
				body: landingPage(
					classRow({ classId: 101, title: '1: AP Statistics (HP)', mark: 'B+ 87.3%' }) +
						classRow({ classId: 102, title: '2: AP Chemistry (HP)', mark: 'A' })
				)
			}),
			fakeResponse({ body: 'this is not json' }),
			fakeResponse({
				body: envelope(detailFragment({ mark: 'A', score: '95.00%', assignments: [GB_ROW_GRADED] }))
			})
		]);

		const gradebook = await fetchGradebook(session(), undefined, { fetchImpl });
		expect(calls).toHaveLength(3);
		expect(gradebook.unreadableCourses).toBe(1);
		// The degraded course keeps what the landing row showed, splitting a
		// combined "letter percent" mark.
		expect(gradebook.courses[0]!.marks[0]!.letter).toBe('B+');
		expect(gradebook.courses[0]!.marks[0]!.percentage).toBe(87.3);
		expect(gradebook.courses[0]!.marks[0]!.assignments).toEqual([]);
		expect(gradebook.courses[1]!.marks[0]!.percentage).toBe(95);
	});

	it('a dead session surfaces as SessionExpiredError', async () => {
		const { fetchImpl } = fakeFetch([
			fakeResponse({
				body: landingPage(classRow({ classId: 101, title: '1: AP Statistics (HP)', mark: 'B+' }))
			}),
			fakeResponse({ body: errorEnvelope('INVALID_CONTEXT') })
		]);

		await expect(fetchGradebook(session(), undefined, { fetchImpl })).rejects.toBeInstanceOf(
			SessionExpiredError
		);
	});

	it('another portal error surfaces as ModuleUnavailableError', async () => {
		const { fetchImpl } = fakeFetch([
			fakeResponse({
				body: landingPage(classRow({ classId: 101, title: '1: AP Statistics (HP)', mark: 'B+' }))
			}),
			fakeResponse({ body: errorEnvelope('Something portal-side went wrong.') })
		]);

		await expect(fetchGradebook(session(), undefined, { fetchImpl })).rejects.toBeInstanceOf(
			ModuleUnavailableError
		);
	});

	it('out of term still raises NoActiveGradingPeriodError', async () => {
		const { fetchImpl } = fakeFetch([
			fakeResponse({ status: 302, headers: { location: '/Home_PXP2.aspx' } }),
			fakeResponse({ body: '<html><body>Home</body></html>' })
		]);

		await expect(fetchGradebook(session(), undefined, { fetchImpl })).rejects.toBeInstanceOf(
			NoActiveGradingPeriodError
		);
	});

	it('a non-default period costs exactly one extra class-list request', async () => {
		const { fetchImpl, calls } = fakeFetch([
			fakeResponse({
				body: landingPage(classRow({ classId: 101, title: '1: AP Statistics (HP)' }))
			}),
			fakeResponse({
				body: envelope(
					classRow({ classId: 101, title: '1: AP Statistics (HP)', markPeriodName: 'Q1' })
				)
			})
		]);

		const gradebook = await fetchGradebook(session(), 1, { fetchImpl });

		expect(calls).toHaveLength(2);
		expect(calls[1]!.body).toContain('"control":"Gradebook_SchoolClasses"');
		expect(calls[1]!.body).toContain('"gradePeriodGU":"GP-2"');
		expect(gradebook.currentPeriodIndex).toBe(1);
		expect(gradebook.courses[0]!.marks[0]!.name).toBe('Quarter 1');
		expect(gradebook.courses[0]!.marks[0]!.shortName).toBe('Q1');
	});
});

describe('parseLandingClasses', () => {
	it('falls back to the mark-period button when the course title carries no data-focus', () => {
		const html = `
<div class="gb-class-header" data-guid="9">
	<button class="course-title">AP Physics 2</button>
	<div class="teacher hide-for-screen">Dr. Ortega</div>
</div>
<div class="gb-class-row" data-mark-gu="physics-mark">
	<button class="course-markperiod" data-focus='${JSON.stringify(focusFor(9))}'>Quarter 1</button>
	<span class="mark">A- 91.8%</span>
</div>`;

		const classes = parseLandingClasses(html);
		expect(classes).toHaveLength(1);
		expect(classes[0]!.name).toBe('AP Physics 2');
		expect(classes[0]!.mark).toBe('A- 91.8%');
		expect(classes[0]!.mayHaveWork).toBe(true);
		expect((classes[0]!.focusArgs as { classID?: number }).classID).toBe(9);
	});

	it('reads an entity-encoded double-quoted data-focus attribute', () => {
		const focus = JSON.stringify(focusFor(7)).replace(/"/g, '&quot;');
		const html = `
<div class="row gb-class-header gb-class-row" data-guid="7">
	<button type="button" class="btn btn-link course-title" data-focus="${focus}" data-action="GB.LoadControl">3: Art</button>
	<div class="teacher hide-for-screen">Lee Artist</div>
	<div class="teacher-room hide-for-print">Room: A-1</div>
</div>
<div class="row gb-class-row" data-guid="7">
	<span class="mark">N/A</span>
	<div>0 Missing Assignments</div>
</div>`;

		const classes = parseLandingClasses(html);
		expect(classes).toHaveLength(1);
		expect(classes[0]!.classId).toBe('7');
		expect(classes[0]!.name).toBe('Art');
		expect(classes[0]!.mayHaveWork).toBe(false);
		expect((classes[0]!.focusArgs as { classID?: number }).classID).toBe(7);
	});
});

// Verbatim shape of a live Pleasanton row (captured 2026-08-21, values
// sanitized): link cells are JSON-stringified LinkColumn objects whose
// hrefAttributes embed the assignment's own data-focus, dates use 2-digit
// years, and GBPoints carries the scaled score while GBScore holds the raw one.
const GB_ROW_LIVE = {
	gradeBookId: '396634',
	studentId: '27729',
	Teacher: 'Jane Doe',
	Date: '8/14/26',
	googleAssignmentLink:
		'{"googleAssignmentLinkURL":"","googleAssignmentVisible":false,"dataType":"AssignmentColumnWithGoogleLink"}',
	GBAssignment:
		'{"href":"javascript:","hrefAttributes":"data-focus={\\"LoadParams\\":{\\"ControlName\\":\\"Gradebook_AssignmentDetails\\",\\"HideHeader\\":false},\\"FocusArgs\\":{\\"viewName\\":null,\\"studentGU\\":\\"00000000-0000-0000-0000-000000000000\\",\\"schoolID\\":16,\\"classID\\":14756,\\"markPeriodGU\\":\\"00000000-0000-0000-0000-000000000001\\",\\"gradePeriodGU\\":\\"00000000-0000-0000-0000-000000000002\\",\\"subjectID\\":-1,\\"teacherID\\":-1,\\"assignmentID\\":396634,\\"standardIdentifier\\":null,\\"AGU\\":\\"0\\",\\"OrgYearGU\\":\\"00000000-0000-0000-0000-000000000003\\",\\"gradingPeriodGroup\\":null}} data-action=GB.LoadControl","value":"Pre-Assessment","dataType":"LinkColumn"}',
	GBAssignmentType: 'Test',
	GBResources: '0',
	GBSubject: '',
	GBScore:
		'{"href":"javascript:","hrefAttributes":"data-focus={\\"LoadParams\\":{\\"ControlName\\":\\"Gradebook_AssignmentDetails\\",\\"HideHeader\\":false},\\"FocusArgs\\":{\\"assignmentID\\":396634}} data-action=GB.LoadControl","value":"15 out of 19.0000","dataType":"LinkColumn"}',
	GBScoreType: 'Raw Score',
	GBPoints: '7.89/10.0000',
	GBNotes: '',
	GBDropBox: ''
};

describe('assignmentRowToDomain', () => {
	it('adapts the live row shape (stringified LinkColumn cells, 2-digit year, scaled points)', () => {
		const a = assignmentRowToDomain(GB_ROW_LIVE);
		expect(a).toMatchObject({
			id: '396634',
			name: 'Pre-Assessment',
			category: 'Test',
			pointsEarned: 7.89,
			pointsPossible: 10,
			unscaledPoints: { pointsEarned: 15, pointsPossible: 19 },
			extraCredit: false,
			notForGrade: false,
			date: '2026-08-14'
		});
	});

	it('adapts a graded GB row', () => {
		const a = assignmentRowToDomain(GB_ROW_GRADED);
		expect(a).toMatchObject({
			id: '5501',
			name: 'Chapter 1 Quiz',
			category: 'Assessments',
			pointsEarned: 8,
			pointsPossible: 10,
			extraCredit: false,
			notForGrade: false,
			date: '2026-08-20'
		});
		expect(a.unscaledPoints).toBeUndefined();
	});

	it('keeps an ungraded row ungraded (absent, not zero)', () => {
		const a = assignmentRowToDomain(GB_ROW_UNGRADED);
		expect(a.pointsEarned).toBeUndefined();
		expect(a.pointsPossible).toBe(10);
	});

	it('reads not-for-grading from the notes text', () => {
		const a = assignmentRowToDomain(GB_ROW_NOT_FOR_GRADE);
		expect(a.notForGrade).toBe(true);
		expect(a.comments).toBe('Optional practice');
	});

	it('detects scaled points when the raw score differs from the points', () => {
		const a = assignmentRowToDomain({
			...GB_ROW_GRADED,
			GBPoints: '4.00 / 5.0000',
			GBScore: '8 out of 10',
			GBScoreType: 'Raw Score'
		});
		expect(a.pointsEarned).toBe(4);
		expect(a.pointsPossible).toBe(5);
		expect(a.unscaledPoints).toEqual({ pointsEarned: 8, pointsPossible: 10 });
	});

	it('unwraps object-shaped cells', () => {
		const a = assignmentRowToDomain({
			...GB_ROW_GRADED,
			GBPoints: { value: '8.00 / 10.0000' },
			GBAssignmentType: { value: 'Assessments' }
		});
		expect(a.pointsEarned).toBe(8);
		expect(a.category).toBe('Assessments');
	});

	it('adapts the bare-number convention (GBScore earned, GBPoints possible)', () => {
		const a = assignmentRowToDomain({
			GBAssignmentID: 'assignment-1',
			GBAssignment: '<span>Induction Quiz</span>',
			GBScore: '17',
			GBPoints: '20',
			GBScoreType: 'Score',
			GBNotes: '',
			Date: '08/12/2026'
		});
		expect(a).toMatchObject({ id: 'assignment-1', name: 'Induction Quiz', pointsEarned: 17, pointsPossible: 20 });
	});

	it('keeps a Missing score ungraded under the bare-number convention', () => {
		const a = assignmentRowToDomain({
			GBAssignmentID: 'assignment-2',
			GBAssignment: 'Lab Report',
			GBScore: 'Missing',
			GBPoints: '15',
			GBScoreType: 'Missing',
			GBNotes: '',
			Date: '08/12/2026'
		});
		expect(a.pointsEarned).toBeUndefined();
		expect(a.pointsPossible).toBe(15);
	});

	it('unwraps JSON-string LinkColumn cells and keeps the hidden id', () => {
		const a = assignmentRowToDomain({
			gradeBookId: 'assignment-3',
			GBAssignment: JSON.stringify({
				href: 'javascript:',
				hrefAttributes: 'data-focus={"LoadParams":{"ControlName":"Gradebook_AssignmentDetails"},"FocusArgs":{"assignmentID":777}}',
				value: 'Design Brief',
				dataType: 'LinkColumn'
			}),
			GBScore: JSON.stringify({ href: 'javascript:', value: 'Not Due', dataType: 'LinkColumn' }),
			GBPoints: '1.00 Points Possible',
			GBScoreType: '',
			GBNotes: '',
			Date: '08/12/2026'
		});
		expect(a.name).toBe('Design Brief');
		// The plain row key outranks the id mined from the link parameters.
		expect(a.id).toBe('assignment-3');
		expect(a.pointsEarned).toBeUndefined();
		expect(a.pointsPossible).toBe(1);
	});

	it('mines the id from an escaped link cell when the row has no id key', () => {
		const a = assignmentRowToDomain({
			GBAssignment: JSON.stringify({
				hrefAttributes: 'data-focus={"FocusArgs":{"assignmentID":777}}',
				value: 'Design Brief',
				dataType: 'LinkColumn'
			}),
			GBPoints: '1.00 Points Possible',
			Date: '08/12/2026'
		});
		expect(a.id).toBe('777');
	});

	it('passes a legacy raw row through unchanged', () => {
		const a = assignmentRowToDomain({
			GradebookID: '99',
			Measure: 'Essay',
			Type: 'Writing',
			Date: '08/22/2026',
			Point: '18',
			PointPossible: '20',
			Notes: ''
		});
		expect(a).toMatchObject({ id: '99', name: 'Essay', pointsEarned: 18, pointsPossible: 20 });
	});
});

describe('fetchGradebook progressive partials', () => {
	it('emits a grades-only gradebook once, off the landing page - never per class detail', async () => {
		const { fetchImpl } = fakeFetch([
			fakeResponse({
				body: landingPage(
					classRow({ classId: 101, title: '1: AP Statistics (HP)', mark: 'B+', lastUpdate: '08/21/2026' }) +
						classRow({ classId: 102, title: '2: AP Chemistry (HP)' })
				)
			}),
			fakeResponse({
				body: envelope(
					detailFragment({
						mark: 'B+',
						score: '87.30%',
						assignments: [GB_ROW_GRADED]
					})
				)
			})
		]);

		const partials: Gradebook[] = [];
		const gradebook = await fetchGradebook(session(), undefined, { fetchImpl }, {
			onPartial: (gb) => partials.push(gb)
		});

		// Exactly one: the landing page. Class details must NOT re-emit - grades
		// arrive as one visual update, assignments as one more (the return value).
		expect(partials).toHaveLength(1);
		// That one partial already carries every class with its landing mark -
		// and no assignments anywhere.
		expect(partials[0]!.courses).toHaveLength(2);
		expect(partials[0]!.courses[0]!.marks[0]!.letter).toBe('B+');
		expect(partials[0]!.courses.every((c) => c.marks[0]!.assignments.length === 0)).toBe(true);
		// The final gradebook carries the assignments the partial lacked.
		expect(gradebook.courses[0]!.marks[0]!.assignments.length).toBeGreaterThan(0);
	});

	it('makes no partial emissions when no hook is passed', async () => {
		const { fetchImpl } = fakeFetch([
			fakeResponse({ body: landingPage(classRow({ classId: 101, title: '1: AP Statistics (HP)' })) })
		]);
		const gradebook = await fetchGradebook(session(), undefined, { fetchImpl });
		expect(gradebook.courses).toHaveLength(1);
	});
});
