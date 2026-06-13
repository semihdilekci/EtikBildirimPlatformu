import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type TrackingCredentials = {
  trackingCode: string;
  trackingPassword: string;
};

type TrackingAuthState = {
  credentials: TrackingCredentials | null;
  hasUnreadMessages: boolean;
  setCredentials: (credentials: TrackingCredentials, hasUnreadMessages: boolean) => void;
  clearCredentials: () => void;
  isAuthenticated: boolean;
};

const TrackingContext = createContext<TrackingAuthState | null>(null);

type TrackingProviderProps = {
  children: ReactNode;
};

export function TrackingProvider({ children }: TrackingProviderProps) {
  const [credentials, setCredentialsState] = useState<TrackingCredentials | null>(null);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  const setCredentials = useCallback(
    (nextCredentials: TrackingCredentials, nextHasUnreadMessages: boolean) => {
      setCredentialsState({
        trackingCode: nextCredentials.trackingCode.toUpperCase(),
        trackingPassword: nextCredentials.trackingPassword,
      });
      setHasUnreadMessages(nextHasUnreadMessages);
    },
    [],
  );

  const clearCredentials = useCallback(() => {
    setCredentialsState(null);
    setHasUnreadMessages(false);
  }, []);

  const value = useMemo<TrackingAuthState>(
    () => ({
      credentials,
      hasUnreadMessages,
      setCredentials,
      clearCredentials,
      isAuthenticated: credentials !== null,
    }),
    [clearCredentials, credentials, hasUnreadMessages, setCredentials],
  );

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
}

export function useTrackingAuthContext(): TrackingAuthState {
  const context = useContext(TrackingContext);

  if (!context) {
    throw new Error('useTrackingAuthContext yalnızca TrackingProvider içinde kullanılabilir.');
  }

  return context;
}
