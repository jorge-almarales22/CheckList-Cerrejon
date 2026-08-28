import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// [DIAG] Log temporal: confirma que este bundle (nuevo) se esta ejecutando.
console.log('[DIAG] Bundle app iniciado', new Date().toISOString());

const rootContainer = document.getElementById('root');
if (rootContainer) {
    const root = ReactDOM.createRoot(rootContainer);
    root.render(<App />);
}
