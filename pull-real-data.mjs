/**
 * pull-real-data.mjs
 * ---------------------------------------------------------------------------
 * Single task: live end-to-end smoke test — run the real server fetch+parse
 * pipeline for one resource (or all) against a production portal and report
 * pass/fail. Prints ONLY shapes, counts, and booleans — never personal
 * values — so output is safe to share. Writes nothing to disk.
 *
 * Usage:
 *   bun scripts/pull-real-data.mjs <resource|all>
 *
 * Resources:
 *   student-info | documents | attendance | gradebook
 *
 * Exit code: 0 if every selected check passed, 1 otherwise (CI-friendly).
 *
 * Credentials come from env vars via lib/session.mjs (see .env.example).
 */

// TODO: import { getSessionFromEnv } from './lib/session.mjs';
// TODO: import * as synergy from '../src/lib/server/synergy/index.ts';

/**
 * Each check: fetch+parse one resource, summarize WITHOUT personal data.
 * e.g. student-info -> "hasName=true grade=present"
 *      documents    -> "5 documents; types=[Report Card, Transcript]"
 *      attendance   -> "absences=3"
 *      gradebook    -> "4 courses; 2 reporting periods; weighted=3"
 */
const RESOURCES = ['student-info', 'documents', 'attendance', 'gradebook'];

const target = process.argv[2];
if (!target || (target !== 'all' && !RESOURCES.includes(target))) {
	console.error(`Usage: bun scripts/pull-real-data.mjs <resource|all>\nresources: ${RESOURCES.join(' | ')}`);
	process.exit(1);
}

// TODO: getSessionFromEnv() -> run each selected check -> print OK/FAIL lines
//       -> process.exit(failures ? 1 : 0).
console.error('Placeholder — smoke test not implemented yet.');
process.exit(1);
