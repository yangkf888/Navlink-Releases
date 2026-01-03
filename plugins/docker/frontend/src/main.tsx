import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from '@/shared/components/common/ErrorBoundary';
import { ConfigProvider } from '@/shared/context/ConfigContext';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ConfigProvider>
      <ErrorBoundary name="Docker App" onReset={() => window.location.reload()}>
        <App />
      </ErrorBoundary>
    </ConfigProvider>
  </React.StrictMode>
);
