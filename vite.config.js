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
  server: {
    port: 5173,
    open: false,
  },
});
