import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './web/web.css';
import { App } from './web/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
