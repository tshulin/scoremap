import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Design-system token + font CSS (colors, typography, spacing, radius, shadows,
// Inter faces). styles.css @imports all of them.
import '../_ds/grademax-design-system-faa73b3c-8cbd-4d15-a90c-3c40aa25b10c/styles.css';
import './index.css';

import App from './App.jsx';
import { SyncProvider } from './data/SyncProvider.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <SyncProvider>
        <App />
      </SyncProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
