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

// ===== PWA DEBUG =====

console.log('Checking Service Worker...');

if ('serviceWorker' in navigator) {
  console.log('Service Worker Supported');

  window.addEventListener('load', () => {
    console.log('Registering SW...');

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('PWA Ready', registration);
      })
      .catch((err) => {
        console.error('SW Error:', err);
      });
  });
} else {
  console.log('Service Worker NOT Supported');
}
