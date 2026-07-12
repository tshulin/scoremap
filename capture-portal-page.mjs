/**
 * capture-portal-page.mjs
 * ---------------------------------------------------------------------------
 * Single task: dump the RAW HTML of one portal page (or all) to captures/,
 * so parsers can be developed offline against real payloads.
 *
 * Usage:
 *   bun scripts/capture-portal-page.mjs <page|all>
 *
 * Pages:
 *   student-info | documents | attendance | gradebook |
 *   gradebook-classdetail | home
 *
 * Output:
 *   captures/<page>.html  (gitignored — contains personal data, never commit)
 *   One console line per page: bytes written, redirected=true/false,
 *   "dataSource" array count. redirected=true on gradebook means the portal
 *   bounced to Home — i.e. no active grading period yet.
 *
 * Credentials come from env vars via lib/session.mjs (see .env.example).
 */

// TODO: import { getSessionFromEnv } from './lib/session.mjs';
// TODO: import { capturesDir } from './lib/paths.mjs';
// TODO: import { fetchFollow } from '../src/lib/server/synergy/http.ts';

const PAGES = {
	'student-info': 'PXP2_Student.aspx?AGU=0',
	documents: 'PXP2_Documents.aspx?AGU=0',
	attendance: 'PXP2_Attendance.aspx?AGU=0',
	gradebook: 'PXP2_Gradebook.aspx?AGU=0',
	'gradebook-classdetail': 'PXP2_ClassGrades.aspx?AGU=0',
	home: 'Home_PXP2.aspx'
};

const target = process.argv[2];
if (!target || (target !== 'all' && !(target in PAGES))) {
	console.error(`Usage: bun scripts/capture-portal-page.mjs <page|all>\npages: ${Object.keys(PAGES).join(' | ')}`);
	process.exit(1);
}

// TODO: getSessionFromEnv() -> for each selected page: fetchFollow ->
//       write captures/<name>.html -> report bytes / redirected / dataSource count.
console.error('Placeholder — capture not implemented yet.');
process.exit(1);
