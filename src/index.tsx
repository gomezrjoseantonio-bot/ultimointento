import './styles/fiscal-tokens.css';
import '@fontsource/ibm-plex-sans';
import '@fontsource/ibm-plex-mono';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './design-system/v5/tokens.css';
import App from './App';

// Red de seguridad para desarrollo: cualquier promesa no awaited que rechace
// debe quedar en consola para diagnóstico, evitando dobles registros con HMR.
const UNHANDLED_REJECTION_LISTENER_KEY = '__appUnhandledRejectionListenerInstalled__';
const windowWithListenerFlag = window as Window & {
  [UNHANDLED_REJECTION_LISTENER_KEY]?: boolean;
};

if (
  process.env.NODE_ENV === 'development' &&
  !windowWithListenerFlag[UNHANDLED_REJECTION_LISTENER_KEY]
) {
  window.addEventListener('unhandledrejection', (event) => {
    // eslint-disable-next-line no-console
    console.error('[unhandledrejection]', event.reason);
  });
  windowWithListenerFlag[UNHANDLED_REJECTION_LISTENER_KEY] = true;
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(<App />);

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('✅ SW registered successfully:', registration.scope);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                console.log('🔄 New version available. Reload to update.');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.log('❌ SW registration failed:', error);
      });
  });
}