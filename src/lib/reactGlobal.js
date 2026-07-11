// The bound design-system bundle (_ds/.../_ds_bundle.js) is a pre-compiled IIFE
// that references a global `React` (the design references loaded React via a
// UMD <script> tag). Expose the app's React on window BEFORE the bundle runs so
// its components share the exact same React instance (hooks work across the
// boundary). This module is imported first by src/lib/ds.js.
import React from 'react';
import * as ReactDOM from 'react-dom';

if (typeof window !== 'undefined') {
  window.React = React;
  window.ReactDOM = ReactDOM;
}

export default React;
