import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { I18nProvider } from './lib/i18n';
import { ThemeProvider } from './lib/theme';
import './styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('UI root element not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
