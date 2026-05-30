import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('App starting...');
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
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => console.log('PWA Ready'))
      .catch(err => console.error('SW Error:', err));
  });
}
