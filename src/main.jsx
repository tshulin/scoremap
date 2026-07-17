import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Design-system token + font CSS (colors, typography, spacing, radius, shadows,
// Inter faces). styles.css @imports all of them.
import '../_ds/grademax-design-system-faa73b3c-8cbd-4d15-a90c-3c40aa25b10c/styles.css';
import './index.css';

import App from './App.jsx';
import { SyncProvider } from './data/SyncProvider.jsx';

// Apply the saved theme before first paint (defaults to dark).
const savedTheme = (() => {
  try {
    return localStorage.getItem('grademax-theme');
  } catch {
    return null;
  }
})();
document.documentElement.setAttribute('data-theme', savedTheme || 'dark');

// Router base = Vite's base path (e.g. /grademax/ on GitHub Pages), so routes
// resolve under the deploy prefix.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <SyncProvider>
        <App />
      </SyncProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
