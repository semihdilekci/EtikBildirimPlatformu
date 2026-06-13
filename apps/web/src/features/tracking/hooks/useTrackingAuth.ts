import { useTrackingAuthContext } from '@/features/tracking/context/TrackingContext';

export function useTrackingAuth() {
  return useTrackingAuthContext();
}
