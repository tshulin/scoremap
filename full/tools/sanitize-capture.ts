// Remove known student data from a captured portal page.
// Usage: npx tsx tools/sanitize-capture.ts <captures/page.html> [--out test/fixtures/portal/page.html]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { formatReport, sanitizeCapture } from './lib/sanitize.js';

const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith('--'));
const outFlag = args.indexOf('--out');
if (!input) {
	console.error(
		'Usage: npx tsx tools/sanitize-capture.ts <captures/page.html> [--out <path>]\n' +
			'Capture pages first with: npx tsx tools/capture-portal-page.ts <page|all>'
	);
	process.exit(1);
}

const output =
	outFlag !== -1 && args[outFlag + 1]
		? resolve(args[outFlag + 1]!)
		: resolve('test/fixtures/portal', basename(input));

const result = sanitizeCapture(readFileSync(resolve(input), 'utf8'));

console.log(formatReport(result));

if (result.residuals.length > 0) {
	console.error(
		`\nCould not write fixture: ${result.residuals.length} identifying value(s) remain.` +
			'\nUpdate tools/lib/sanitize.ts before retrying.'
	);
	process.exit(1);
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, result.html, 'utf8');

console.log(`\nWrote ${output}`);
console.log(
	'Review the fixture before committing. Search for names, IDs, schools, teachers,\n' +
		'and any other identifying values.'
);
