import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    __SBKHUSH_BOOTED__?: boolean;
    __BAZAARPK_BOOTED__?: boolean;
  }
}

const rootEl = document.getElementById('root');

if (rootEl) {
  try {
    createRoot(rootEl).render(<App />);
    window.__SBKHUSH_BOOTED__ = true;
    window.__BAZAARPK_BOOTED__ = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    rootEl.innerHTML =
      '<div style="font-family:sans-serif;padding:24px;max-width:520px;margin:48px auto;border:1px solid #fecdd3;background:#fff1f2;border-radius:12px;color:#881337;">' +
      '<h2 style="margin:0 0 8px;font-size:18px;">Failed to start application</h2>' +
      '<p style="margin:0;font-size:13px;line-height:1.5;">' +
      message.replace(/</g, '&lt;') +
      '</p></div>';
  }
}
