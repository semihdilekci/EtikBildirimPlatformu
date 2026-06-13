import { CssBaseline, ThemeProvider } from '@mui/material';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/App';
import { theme } from '@/styles/theme';
import '@/styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
