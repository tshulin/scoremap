import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Scoremap web app - Vite + React.
// The pages under src/ are the design-reference components recreated as a real
// app. The bound design system lives in _ds/ and is loaded as a side-effect
// bundle (see src/lib/ds.js); its token/font CSS is imported in src/main.jsx.
export default defineConfig({
  // Deploy-time base path. GitHub Pages serves project sites from
  // /<repo>/, so its build sets VITE_BASE=/grademax/; dev and root-hosted
  // deploys stay at /.
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  resolve: {
    alias: {
      // subtls (the browser TLS client) falls back to Node's `crypto` when no
      // global crypto exists; browsers always have one, so this dead dynamic
      // import is stubbed to keep the bundler from choking on the Node builtin.
      crypto: fileURLToPath(new URL('./src/transport/cryptoStub.js', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: false,
    // No backend proxy: the app talks to the blind relay over a WebSocket
    // (VITE_RELAY_URL, see src/data/api.js), not to an /api HTTP backend.
  },
});
