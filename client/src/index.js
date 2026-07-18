import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const resizeObserverError = window.onerror;

window.onerror = function (message, source, lineno, colno, error) {
  if (
    typeof message === "string" &&
    message.includes("ResizeObserver loop completed")
  ) {
    return true;
  }

  if (resizeObserverError) {
    return resizeObserverError(message, source, lineno, colno, error);
  }

  return false;
};

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(<App />);