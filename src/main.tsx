import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { wsService } from './services/websocket';

// ── Patch wsService with missing V2 subscription methods ─────────────────────
// subscribeToConjunctions and subscribeToNotifications are called by hooks but
// may not be implemented in websocket.ts yet. Patching here ensures they exist
// as no-op stubs before any component mounts, preventing TypeError crashes that
// cause pages to render blank with no visible error.
(function patchWsService() {
  const ws = wsService as any;

  if (typeof ws.subscribeToConjunctions !== 'function') {
    const handlers: Array<(p: unknown) => void> = [];
    ws.subscribeToConjunctions = (handler: (p: unknown) => void) => {
      handlers.push(handler);
      return () => {
        const i = handlers.indexOf(handler);
        if (i >= 0) handlers.splice(i, 1);
      };
    };
    // Internal trigger — call this from your WS message router when ready:
    // wsService._notifyConjunction(payload)
    ws._notifyConjunction = (payload: unknown) => handlers.forEach(h => h(payload));
  }

  if (typeof ws.subscribeToNotifications !== 'function') {
    const handlers: Array<(p: unknown) => void> = [];
    ws.subscribeToNotifications = (handler: (p: unknown) => void) => {
      handlers.push(handler);
      return () => {
        const i = handlers.indexOf(handler);
        if (i >= 0) handlers.splice(i, 1);
      };
    };
    // Internal trigger — call this from your WS message router when ready:
    // wsService._notifyNotification(payload)
    ws._notifyNotification = (payload: unknown) => handlers.forEach(h => h(payload));
  }
})();

// ── Connect WebSocket — errors must never prevent the app from rendering ──────
try {
  wsService.connect();
} catch (e) {
  console.warn('[main] WebSocket connection failed on init:', e);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);