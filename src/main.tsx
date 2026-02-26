import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { wsService } from './services/websocket';

// Connect WebSocket — errors here must never prevent the app from rendering
try {
  wsService.connect();
} catch (e) {
  console.warn('WebSocket connection failed on init:', e);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
