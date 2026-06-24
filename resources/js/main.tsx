import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui';
import { seedIfEmpty } from './data/store';
import '../css/app.css';

seedIfEmpty();

const container = document.getElementById('app');
if (!container) throw new Error('#app element not found');

createRoot(container).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
