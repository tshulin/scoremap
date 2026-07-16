import { serve } from '@hono/node-server';
import { loadConfig } from '../api/config.js';
import { createMockPortal, MOCK_CREDENTIALS } from './portal.js';

const config = loadConfig();
const mockPort = Number(process.env.MOCK_PORT ?? 3001);
const port = config.port;

serve({ fetch: createMockPortal().fetch, port: mockPort });

process.env.PORTAL_BASE_OVERRIDE = `http://localhost:${mockPort}`;

const { createApp } = await import('../api/app.js');
serve({ fetch: createApp({ config }).fetch, port });

console.log(`mock portal   http://localhost:${mockPort}`);
console.log(`backend       http://localhost:${port}  (PORTAL_BASE_OVERRIDE -> mock portal)`);
console.log(
	`mock login    domain=${MOCK_CREDENTIALS.domain} user=${MOCK_CREDENTIALS.username} pass=${MOCK_CREDENTIALS.password}`
);
console.log('gradebook is unavailable by default');
