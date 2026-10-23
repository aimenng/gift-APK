import React from 'react';
import ReactDOM from 'react-dom/client';

// Self-hosted so the app renders identically offline and where fonts.googleapis.com is
// unreachable. Only the latin subsets are bundled (~260 kB total): CJK glyphs come from
// the platform font — Noto Sans CJK on Android, PingFang SC on Apple, Microsoft YaHei on
// Windows — which costs zero bytes and hint better than a bundled webfont. Bundling
// Noto Sans SC itself would have added tens of megabytes to the APK.
import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-800.css';
import '@fontsource/caveat/latin-400.css';
import '@fontsource/caveat/latin-500.css';
import '@fontsource/caveat/latin-600.css';
import '@fontsource/caveat/latin-700.css';

import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);