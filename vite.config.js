import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Grademax web app — Vite + React.
// The pages under src/ are the design-reference components recreated as a real
// app. The bound design system lives in _ds/ and is loaded as a side-effect
// bundle (see src/lib/ds.js); its token/font CSS is imported in src/main.jsx.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
});
