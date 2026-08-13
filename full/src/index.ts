import { serve } from '@hono/node-server';
import { createApp } from './api/app.js';
import { loadConfig } from './api/config.js';

const config = loadConfig();

serve({ fetch: createApp({ config }).fetch, port: config.port });
console.log(`grademax backend listening on http://localhost:${config.port}`);
