import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';

import { setSessionExpiredHandler } from '@/api/interceptors/session-expired.interceptor';
import { AppRoutes } from '@/routes/index';
import { useAuthStore } from '@/stores/useAuthStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function SessionExpiredBridge() {
  const navigate = useNavigate();
  const clear = useAuthStore((state) => state.clear);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      if (window.location.pathname.startsWith('/auth/login')) {
        return;
      }

      clear();
      const returnUrl = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      void navigate(`/auth/login?returnUrl=${returnUrl}`, { replace: true });
    });
  }, [clear, navigate]);

  return null;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionExpiredBridge />
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
