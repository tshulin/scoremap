import { serve } from '@hono/node-server';
import { loadConfig } from '../api/config.js';
import { createMockPortal, MOCK_CREDENTIALS } from './portal.js';

const flag = (name: string, fallback: boolean): boolean =>
	(process.env[name] ?? String(fallback)).toLowerCase() === 'true';

// Dev exists to give the frontend something to build against, so the stand-ins are on
// unless asked otherwise. Both are refused in production by loadConfig.
process.env['PLACEHOLDER_DATA'] ??= 'true';
const withAbsences = flag('MOCK_WITH_ABSENCES', true);
const gradebookAvailable = flag('MOCK_GRADEBOOK_AVAILABLE', false);

const config = loadConfig();
const mockPort = Number(process.env['MOCK_PORT'] ?? 3001);
const port = config.port;

serve({ fetch: createMockPortal({ withAbsences, gradebookAvailable }).fetch, port: mockPort });

process.env['PORTAL_BASE_OVERRIDE'] = `http://localhost:${mockPort}`;

const { createApp } = await import('../api/app.js');
serve({ fetch: createApp({ config }).fetch, port });

console.log(`mock portal   http://localhost:${mockPort}`);
console.log(`backend       http://localhost:${port}  (PORTAL_BASE_OVERRIDE -> mock portal)`);
console.log(
	`mock login    domain=${MOCK_CREDENTIALS.domain} user=${MOCK_CREDENTIALS.username} pass=${MOCK_CREDENTIALS.password}`
);
console.log('');
console.log('data sources:');
console.log(`  student, documents   real parsers over committed fixtures`);
console.log(
	`  attendance           real parser, ${withAbsences ? 'synthetic absences (MOCK_WITH_ABSENCES=false for the empty state)' : 'no absences (MOCK_WITH_ABSENCES=true for rows)'}`
);
console.log(
	`  gradebook            ${
		config.placeholderData
			? 'PLACEHOLDER — sample data, not parsed (X-Grademax-Placeholder: true)'
			: 'live path only; 409 until an active grading period exists'
	}`
);
