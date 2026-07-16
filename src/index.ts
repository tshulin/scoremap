import { serve } from '@hono/node-server';
import { createApp } from './api/app.js';

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: createApp().fetch, port });
console.log(`grademax backend listening on http://localhost:${port}`);
